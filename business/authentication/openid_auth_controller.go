package authentication

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/go-jose/go-jose"
	"github.com/go-jose/go-jose/jwt"
	"github.com/gorilla/mux"
	"golang.org/x/sync/singleflight"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

const (
	// OpenIdNonceCookieName is the cookie name used to store a nonce code
	// when user is starting authentication with the external server. This code
	// is used to mitigate replay attacks.
	OpenIdNonceCookieName = config.TokenCookieName + "-openid-nonce"

	// OpenIdServerCAFile is a certificate file used to connect to the OpenID server.
	// This is for cases when the authentication server is using TLS with a self-signed
	// certificate.
	OpenIdServerCAFile = "/kiali-cabundle/openid-server-ca.crt"
)

// cachedOpenIdKeySet stores the metadata obtained from the /.well-known/openid-configuration
// endpoint of the OpenId server. Once the metadata is obtained for the first time, subsequent
// retrievals are served from this cached value rather than doing another request to the
// metadata endpoint of the OpenId server.
var cachedOpenIdMetadata *openIdMetadata

// cachedOpenIdKeySet stores the public key sets used for verification of the received
// id_tokens from the OpenId server. Its purpose is to prevent repeated queries to the JWKS
// endpoint of the OpenId server. However, since the keys can rotate, this is refreshed
// each time an id_token is signed with a key that is not present in the cached key set.
var cachedOpenIdKeySet *jose.JSONWebKeySet

// openIdFlightGroup is used to synchronize different threads of different HTTP requests so
// that only one request active to the metadata or jwks endpoints of the OpenId server. This
// prevents fetching the same data twice at the same time.
var openIdFlightGroup singleflight.Group

// openIdMetadata is a helper struct to parse the response from the metadata
// endpoint /.well-known/openid-configuration of the OpenID server.
// This was borrowed from https://github.com/coreos/go-oidc/blob/8d771559cf6e5111c9b9159810d0e4538e7cdc82/oidc.go
// and some additional fields were added.
type openIdMetadata struct {
	Issuer      string   `json:"issuer"`
	AuthURL     string   `json:"authorization_endpoint"`
	TokenURL    string   `json:"token_endpoint"`
	JWKSURL     string   `json:"jwks_uri"`
	UserInfoURL string   `json:"userinfo_endpoint"`
	Algorithms  []string `json:"id_token_signing_alg_values_supported"`

	// Some extra fields
	ScopesSupported        []string `json:"scopes_supported"`
	ResponseTypesSupported []string `json:"response_types_supported"`
}

// oidcSessionPayload is a helper type used as session data storage. An instance
// of this type is used with the SessionPersistor for session creation and persistance.
type oidcSessionPayload struct {
	// Subject is the resolved name of the user that logged into Kiali.
	Subject string `json:"subject,omitempty"`

	// Token is the string provided by the OpenId server. It can be the id_token or
	// the access_token, depending on the Kiali configuration. If RBAC is enabled,
	// this is the token that can be used against the Kubernetes API.
	Token string `json:"token,omitempty"`
}

// badOidcRequest is a helper type implementing Go's error interface. It's used to assist in
// error handling on the OpenId authentication flow. Since authentication is initiated via
// Kiali's web_root, it is hard to differentiate between an auth callback versus a first user
// request to Kiali. So, if this error is raised, it indicates that the authentication
// is not going to be handled and the http request should be passed to the next handler in
// the chain of the web_root endpoint.
type badOidcRequest struct {
	// Detail contains the description of the error.
	Detail string
}

// Error returns the text representation of an badOidcRequest error.
func (e badOidcRequest) Error() string {
	return e.Detail
}

// OpenIdAuthController contains the backing logic to implement
// Kiali's "openid" authentication strategy. Only
// the authorization code flow is implemented.
//
// RBAC is supported, although it requires that the cluster is configured
// with OpenId integration. Thus, it is possible to turn off RBAC
// for simpler setups.
type OpenIdAuthController struct {
	// businessInstantiator is a function that returns an already initialized
	// business layer. Normally, it should be set to the business.Get function.
	// For tests, it can be set to something else that returns a compatible API.
	businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)

	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

// NewOpenIdAuthController initializes a new controller for handling openid authentication, with the
// given persistor and the given businessInstantiator. The businessInstantiator can be nil and
// the initialized contoller will use the business.Get function.
func NewOpenIdAuthController(persistor SessionPersistor, businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)) *OpenIdAuthController {
	if businessInstantiator == nil {
		businessInstantiator = business.Get
	}

	return &OpenIdAuthController{
		businessInstantiator: businessInstantiator,
		SessionStore:         persistor,
	}
}

// Authenticate was the entry point to handle OpenId authentication using the implicit flow. Support
// for the implicit flow has been removed. This is left here, because the "Authenticate" function is required
// by the AuthController interface which must be implemented by all auth controllers. So, this simply
// returns an error.
func (c OpenIdAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	return nil, fmt.Errorf("support for OpenID's implicit flow has been removed")
}

// GetAuthCallbackHandler returns a http handler for authentication requests done to Kiali's web_root.
// This handler catches callbacks from the OpenId server. If it cannot be determined that the request
// is a callback from the authentication server, the request is passed to the fallbackHandler.
func (c OpenIdAuthController) GetAuthCallbackHandler(fallbackHandler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c.authenticateWithAuthorizationCodeFlow(r, w, fallbackHandler)
	})
}

// PostRoutes adds the additional endpoints needed on the Kiali's router
// in order to properly enable OpenId authentication. Only one new route is added to
// do a redirection from Kiali to the OpenId server to initiate authentication.
func (c OpenIdAuthController) PostRoutes(router *mux.Router) {
	// swagger:route GET /auth/openid_redirect auth openidRedirect
	// ---
	// Endpoint to redirect the browser of the user to the authentication
	// endpoint of the configured OpenId provider.
	//
	//     Consumes:
	//     - application/json
	//
	//     Produces:
	//     - application/html
	//
	//     Schemes: http, https
	//
	// responses:
	//      500: internalError
	//      200: noContent
	router.
		Methods("GET").
		Path("/api/auth/openid_redirect").
		Name("OpenIdRedirect").
		HandlerFunc(c.redirectToAuthServerHandler)
}

// ValidateSession restores a session previously created by the Authenticate function. A sanity check of
// the id_token is performed if Kiali is not configured to use the access_token. Also, if RBAC is enabled,
// a privilege check is performed to verify that the user still has privileges to use Kiali.
// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
func (c OpenIdAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	// Restore a previously started session.
	sPayload := oidcSessionPayload{}
	sData, err := c.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		log.Warningf("Could not read the session: %v", err)
		return nil, nil
	}
	if sData == nil {
		return nil, nil
	}

	// The OpenId token must be present in the session
	if len(sPayload.Token) == 0 {
		log.Warning("Session is invalid: the OIDC token is absent")
		return nil, nil
	}

	conf := config.Get()

	// If the id_token is being used to make calls to the cluster API, it's known that
	// this token is a JWT and some of its structure; so, it's possible to do some sanity
	// checks on the token. However, if the access_token is being used, this token is opaque
	// and these sanity checks must be skipped.
	if conf.Auth.OpenId.ApiToken != "access_token" {
		// Parse the sid claim (id_token) to check that the sub claim matches to the configured "username" claim of the id_token
		parsedOidcToken, err := jwt.ParseSigned(sPayload.Token)
		if err != nil {
			log.Warningf("Cannot parse sid claim of the OIDC token!: %v", err)
			return nil, fmt.Errorf("cannot parse sid claim of the OIDC token: %w", err)
		}

		var claims map[string]interface{} // generic map to store parsed token
		err = parsedOidcToken.UnsafeClaimsWithoutVerification(&claims)
		if err != nil {
			log.Warningf("Cannot parse the payload of the id_token: %v", err)
			return nil, fmt.Errorf("cannot parse the payload of the id_token: %w", err)
		}

		if userClaim, ok := claims[config.Get().Auth.OpenId.UsernameClaim]; ok && sPayload.Subject != userClaim {
			log.Warning("Kiali token rejected because of subject claim mismatch")
			return nil, nil
		}
	}

	var token string
	if !conf.Auth.OpenId.DisableRBAC {
		// If RBAC is ENABLED, check that the user has privileges on the cluster.
		bs, err := business.Get(&api.AuthInfo{Token: sPayload.Token})
		if err != nil {
			log.Warningf("Could not get the business layer!!: %v", err)
			return nil, fmt.Errorf("could not get the business layer: %w", err)
		}

		_, err = bs.Namespace.GetNamespaces(r.Context())
		if err != nil {
			log.Warningf("Token error!: %v", err)
			return nil, nil
		}

		token = sPayload.Token
	} else {
		// If RBAC is off, it's assumed that the kubernetes cluster will reject the OpenId token.
		// Instead, we use the Kiali token and this has the side effect that all users will share the
		// same privileges.
		token, err = kubernetes.GetKialiTokenForHomeCluster()
		if err != nil {
			return nil, fmt.Errorf("error reading the Kiali ServiceAccount token: %w", err)
		}
	}

	// Internal header used to propagate the subject of the request for audit purposes
	r.Header.Add("Kiali-User", sPayload.Subject)

	return &UserSessionData{
		ExpiresOn: sData.ExpiresOn,
		Username:  sPayload.Subject,
		AuthInfo:  &api.AuthInfo{Token: token},
	}, nil
}

// TerminateSession unconditionally terminates any existing session without any validation.
func (c OpenIdAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	c.SessionStore.TerminateSession(r, w)
	return nil
}

// authenticateWithAuthorizationCodeFlow is the entry point to handle OpenId authentication using the authorization
// code flow. The HTTP request should contain "code" and "state" as URL parameters. Kiali will exchange the code
// for a token by contacting the OpenId server. If RBAC is enabled, the id_token should be valid to be used in the
// Kubernetes API (thus, privileges are verified to allow login); else, only token validity is checked and users will
// share the same privileges.
// An AuthenticationFailureError is returned if the authentication failed. Any
// other kind of error means that something unexpected happened.
func (c OpenIdAuthController) authenticateWithAuthorizationCodeFlow(r *http.Request, w http.ResponseWriter, fallbackHandler http.Handler) {
	conf := config.Get()
	webRoot := conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"

	flow := openidFlowHelper{businessInstantiator: c.businessInstantiator}
	flow.
		extractOpenIdCallbackParams(r).
		checkOpenIdAuthorizationCodeFlowParams().
		// We cannot do a cleanup if we are not handling the auth here. So,
		// the callbackCleanup func cannot be called before checkOpenIdAuthorizationCodeFlowParams().
		// It may sound reasonable to do a cleanup as early as possible (i.e. delete cookies), however
		// if we do it, we break the "implicit" flow, because the requried cookies will no longer exist.
		callbackCleanup(w).
		validateOpenIdState().
		requestOpenIdToken(httputil.GuessKialiURL(r)).
		parseOpenIdToken().
		validateOpenIdNonceCode().
		checkAllowedDomains().
		checkUserPrivileges().
		createSession(r, w, c.SessionStore)

	if flow.Error != nil {
		if err, ok := flow.Error.(*badOidcRequest); ok {
			log.Debugf("Not handling OpenId code flow authentication: %s", err.Detail)
			fallbackHandler.ServeHTTP(w, r)
		} else {
			if flow.ShouldTerminateSession {
				c.SessionStore.TerminateSession(r, w)
			}
			log.Warningf("Authentication rejected: %s", flow.Error.Error())
			http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(flow.Error.Error())), http.StatusFound)
		}
		return
	}

	// Let's redirect (remove the openid params) to let the Kiali-UI to boot
	http.Redirect(w, r, webRootWithSlash, http.StatusFound)
}

// redirectToAuthServerHandler prepares the redirection to initiate authentication with an OpenId Server.
// It finds what's the authentication endpoint of the OpenId server to redirect the user to. Then, creates
// the "nonce" and the "state" codes and forms the final URL to reply with a "302 Found" HTTP status and
// post the redirection in a "Location" HTTP header, with the needed parameters given the OpenId server
// capabilities. A Cookie is set to store the source of the calculated codes and be able to verify the
// authentication intent when the OpenId server calls back.
func (c OpenIdAuthController) redirectToAuthServerHandler(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()

	// This endpoint should be available only if OpenId strategy is configured
	if conf.Auth.Strategy != config.AuthStrategyOpenId {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("OpenId strategy is not enabled"))
		return
	}

	// Kiali only supports the authorization code flow.
	if !isOpenIdCodeFlowPossible() {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusNotImplemented)
		_, _ = w.Write([]byte("Cannot start authentication because it is not possible to use OpenId's authorization code flow. Check Kiali logs for more details."))
		return
	}

	// Build scopes string
	scopes := strings.Join(getConfiguredOpenIdScopes(), " ")

	// Determine authorization endpoint
	authorizationEndpoint := conf.Auth.OpenId.AuthorizationEndpoint
	if len(authorizationEndpoint) == 0 {
		openIdMetadata, err := getOpenIdMetadata()
		if err != nil {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("Error fetching OpenID provider metadata: " + err.Error()))
			return
		}
		authorizationEndpoint = openIdMetadata.AuthURL
	}

	// Create a "nonce" code and set a cookie with the code
	// It was chosen 15 chars arbitrarily. Probably, it's not worth to make this value configurable.
	nonceCode, err := util.CryptoRandomString(15)
	if err != nil {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("Random number generator failed"))
		return
	}

	nowTime := util.Clock.Now()
	expirationTime := nowTime.Add(time.Duration(conf.Auth.OpenId.AuthenticationTimeout) * time.Second)
	nonceCookie := http.Cookie{
		Expires:  expirationTime,
		HttpOnly: true,
		Name:     OpenIdNonceCookieName,
		Path:     conf.Server.WebRoot,
		SameSite: http.SameSiteLaxMode,
		Value:    nonceCode,
	}
	http.SetCookie(w, &nonceCookie)

	// Instead of sending the nonce code to the IdP, send a cryptographic hash.
	// This way, if an attacker manages to steal the id_token returned by the IdP, he still
	// needs to craft the cookie (which is hopefully very, very hard to do).
	nonceHash := sha256.Sum224([]byte(nonceCode))

	// OpenID spec recommends the use of "state" parameter. Although it's just a recommendation,
	// some identity providers have chosen to require the "state" parameter, effectively blocking
	// authentication with Kiali.
	// The state parameter is to mitigate CSRF attacks. Mitigation is usually done with
	// a token and it's implementation *could* be similar to the nonce code, but this would
	// require a second cookie.
	// To reduce the usage of cookies, let's use the already generated nonce as a session_id,
	// and the "nowTime" to generate a hash and use it as CSRF token. The Kiali's signing key is also used to
	// add a component that is not traveling over the network.
	// Although this "binds" the id_token returned by the IdP with the CSRF mitigation, this should be OK
	// because we are including a "secret" key (i.e. should an attacker steal the nonce code, he still needs to know
	// the Kiali's signing key).
	csrfHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", nonceCode, nowTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Send redirection to browser
	responseType := "code" // Request for the "authorization code" flow
	redirectUri := fmt.Sprintf("%s?client_id=%s&response_type=%s&redirect_uri=%s&scope=%s&nonce=%s&state=%s",
		authorizationEndpoint,
		url.QueryEscape(conf.Auth.OpenId.ClientId),
		responseType,
		url.QueryEscape(httputil.GuessKialiURL(r)),
		url.QueryEscape(scopes),
		url.QueryEscape(fmt.Sprintf("%x", nonceHash)),
		url.QueryEscape(fmt.Sprintf("%x-%s", csrfHash, nowTime.UTC().Format("060102150405"))),
	)

	if len(conf.Auth.OpenId.AdditionalRequestParams) > 0 {
		urlParams := make([]string, 0, len(conf.Auth.OpenId.AdditionalRequestParams))
		for k, v := range conf.Auth.OpenId.AdditionalRequestParams {
			urlParams = append(urlParams, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(v)))
		}
		redirectUri = fmt.Sprintf("%s&%s", redirectUri, strings.Join(urlParams, "&"))
	}

	http.Redirect(w, r, redirectUri, http.StatusFound)
}

// openidFlowHelper is a helper type to implement both the authorization code and the implicit
// flows of the OpenId specification. This is mainly for de-duplicating code. Previously, the same
// code was copied on two functions: one to handle implicit flow and one to handle authorization
// code flow. The differences were mainly because of the way error handling is done on each flow (one
// had to return an http response with a JSON error, while the other did http redirects). This helper
// uses Go errors and let the caller do the appropriate response, depending on the situation.
// Fields in this struct are filled and read as needed.
type openidFlowHelper struct {
	// AccessToken stores the access_token returned by the OpenId server, if Kiali is
	// configured to use it instead of the id_token.
	AccessToken string

	// Code is the authorization code provided during the callback of the authorization code flow.
	Code string

	// ExpiresOn is the expiration time of the id_token.
	ExpiresOn time.Time

	// IdToken is the identity token provided by the OpenId server, either during the callback
	// of the implicit flow, or on the request to exchange the authorization code.
	IdToken string

	// Nonce is the code used to mitigate replay attacks. It's read from an HTTP Cookie.
	Nonce string

	// NonceHash is the sha256 hash of the nonce code. It is calculated after reading the nonce from its http cookie.
	NonceHash []byte

	// ParsedIdToken is the parsed form of the id_token, since it's known that it is a JWT.
	ParsedIdToken *jwt.JSONWebToken

	// IdTokenPayload holds the claims part of the id_token.
	IdTokenPayload map[string]interface{}

	// State is the code used to mitigate CSRF attacks.
	State string

	// Subject is the resolved username of the person that authenticated through an OpenId server.
	Subject string

	// UseAccessToken stores whether to use the OpenId access_token against the cluster API instead
	// of the id_token.
	UseAccessToken bool

	// Error is nil unless there was an error during some phase of the authentication. A non-nil
	// value cancels the authentication request.
	Error error

	// ShouldTerminateSession is set to a true value if an existing user session should be terminated
	// as a consequence of a failure of a new authentication attempt (i.e if the Error field is not nil).
	ShouldTerminateSession bool

	// businessInstantiator is a function that returns an already initialized
	// business layer. Normally, it should be set to the business.Get function.
	// For tests, it can be set to something else that returns a compatible API.
	businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)
}

// callbackCleanup deletes the nonce cookie that was generated during the redirection from Kiali to
// the OpenId server to initiate authentication (see OpenIdAuthController.redirectToAuthServerHandler).
func (p *openidFlowHelper) callbackCleanup(w http.ResponseWriter) *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	// Delete the nonce cookie since we no longer need it.
	deleteNonceCookie := http.Cookie{
		Name:     OpenIdNonceCookieName,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
		Value:    "",
	}
	http.SetCookie(w, &deleteNonceCookie)

	return p
}

// extractOpenIdCallbackParams reads callback parameters from the HTTP request, once the OpenId server
// redirects back to Kiali with the credentials. It also reads the nonce cookie with the code generated
// during the initial redirection from Kiali to the OpenId Server (see OpenIdAuthController.redirectToAuthServerHandler).
func (p *openidFlowHelper) extractOpenIdCallbackParams(r *http.Request) *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	var err error

	// Get the nonce code hash
	var nonceCookie *http.Cookie
	if nonceCookie, err = r.Cookie(OpenIdNonceCookieName); err == nil {
		p.Nonce = nonceCookie.Value

		hash := sha256.Sum224([]byte(nonceCookie.Value))
		p.NonceHash = make([]byte, sha256.Size224)
		copy(p.NonceHash, hash[:])
	}

	// Parse/fetch received form data
	err = r.ParseForm()
	if err != nil {
		err = &AuthenticationFailureError{
			HttpStatus: http.StatusBadRequest,
			Reason:     "failed to read OpenId callback params",
			Detail:     fmt.Errorf("error parsing form info: %w", err),
		}
	} else {
		// Read relevant form data parameters
		p.Code = r.Form.Get("code")
		p.State = r.Form.Get("state")
	}

	p.Error = err

	return p
}

// checkOpenIdAuthorizationCodeFlowParams verifies that the callback parameters for the authorization
// code flow are all present, as required by Kiali.
func (p *openidFlowHelper) checkOpenIdAuthorizationCodeFlowParams() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}
	if p.NonceHash == nil {
		p.Error = &badOidcRequest{Detail: "no nonce code present - login window may have timed out"}
	}
	if p.State == "" {
		p.Error = &badOidcRequest{Detail: "state parameter is empty or invalid"}
	}

	if p.Code == "" {
		p.Error = &badOidcRequest{Detail: "no authorization code is present"}
	}

	return p
}

// checkAllowedDomains verifies that the "hd" or the "email" claims of the id_token (with
// priority for the "hd" claim) contain a domain from a list of predefined domains that
// are allowed to login into Kiali.
//
// The list of allowed domains can be specified in the
// Kiali CR and is useful for public auth servers that accept credentials from any
// of their registered users (from any organization), even if Kiali was registered under a
// specific organization account.
func (p *openidFlowHelper) checkAllowedDomains() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	conf := config.Get()

	if len(conf.Auth.OpenId.AllowedDomains) > 0 {
		if err := checkDomain(p.IdTokenPayload, conf.Auth.OpenId.AllowedDomains); err != nil {
			p.Error = &AuthenticationFailureError{Reason: err.Error()}
		}
	}

	return p
}

// checkUserPrivileges verifies the privileges of the OpenId token, or validity of the token,
// depending if RBAC is enabled.
//
// If RBAC is enabled, either the id_token or the access_token (as specified by the api_token in
// the config) is tested against the cluster API to check if the user has enough privileges
// to log in to Kiali.
//
// If RBAC is disabled, then only validity of the id_token is verified (see validateOpenIdTokenInHouse).
func (p *openidFlowHelper) checkUserPrivileges() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	conf := config.Get()
	p.UseAccessToken = false
	if conf.Auth.OpenId.DisableRBAC {
		// When RBAC is on, we delegate some validations to the Kubernetes cluster. However, if RBAC is off
		// the token must be fully validated, as we no longer pass the OpenId token to the cluster API server.
		// Since the configuration indicates RBAC is off, we do the validations:
		err := validateOpenIdTokenInHouse(p)
		if err != nil {
			p.Error = &AuthenticationFailureError{
				HttpStatus: http.StatusForbidden,
				Reason:     "the OpenID token was rejected",
				Detail:     err,
			}
			return p
		}
	} else {
		// Check if user trying to login has enough privileges to login. This check is only done if
		// config indicates that RBAC is on. For cases where RBAC is off, we simply assume that the
		// Kiali ServiceAccount token should have enough privileges and skip this privilege check.
		apiToken := p.IdToken
		if conf.Auth.OpenId.ApiToken == "access_token" {
			apiToken = p.AccessToken
			p.UseAccessToken = true
		}
		httpStatus, errMsg, detailedError := verifyOpenIdUserAccess(apiToken, p.businessInstantiator)
		if httpStatus != http.StatusOK {
			p.Error = &AuthenticationFailureError{
				HttpStatus: httpStatus,
				Reason:     errMsg,
				Detail:     detailedError,
			}
			return p
		}
	}

	return p
}

// createSession asks the SessionPersistor to start a session.
func (p *openidFlowHelper) createSession(r *http.Request, w http.ResponseWriter, sessionStore SessionPersistor) *oidcSessionPayload {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return nil
	}

	sPayload := buildSessionPayload(p)
	err := sessionStore.CreateSession(r, w, config.AuthStrategyOpenId, p.ExpiresOn, sPayload)
	if err != nil {
		p.Error = err
	}

	return sPayload
}

// parseOpenIdToken parses the OpenId id_token which is a JWT. This is to extract it's claims
// and be able to process them in later steps of the authentication flow.
func (p *openidFlowHelper) parseOpenIdToken() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	// Parse the received id_token from the IdP (it is a JWT token) without validating its signature
	parsedOidcToken, err := jwt.ParseSigned(p.IdToken)
	if err != nil {
		p.Error = &AuthenticationFailureError{
			Reason: "cannot parse received id_token from the OpenId provider",
			Detail: err,
		}
		p.ShouldTerminateSession = true
		return p
	}
	p.ParsedIdToken = parsedOidcToken

	var claims map[string]interface{} // generic map to store parsed token
	err = parsedOidcToken.UnsafeClaimsWithoutVerification(&claims)
	if err != nil {
		p.Error = &AuthenticationFailureError{
			Reason: "cannot parse the payload of the id_token from the OpenId provider",
			Detail: err,
		}
		p.ShouldTerminateSession = true
		return p
	}
	p.IdTokenPayload = claims

	// Extract expiration date from the OpenId token
	if expClaim, ok := claims["exp"]; !ok {
		p.Error = &AuthenticationFailureError{
			Reason: "the received id_token from the OpenId provider has missing the required 'exp' claim",
		}
		p.ShouldTerminateSession = true
		return p
	} else {
		// If the expiration date is present on the claim, we use that
		expiresInNumber, err := parseTimeClaim(expClaim)
		if err != nil {
			p.Error = &AuthenticationFailureError{
				Reason: "token exp claim is present, but invalid",
				Detail: err,
			}
			p.ShouldTerminateSession = true
			return p
		}

		p.ExpiresOn = time.Unix(expiresInNumber, 0)
	}

	// Extract the name of the user from the id_token. The "subject" is passed to the front-end to be displayed.
	p.Subject = "OpenId User" // Set a default value
	if userClaim, ok := claims[config.Get().Auth.OpenId.UsernameClaim]; ok && len(userClaim.(string)) > 0 {
		p.Subject = userClaim.(string)
	}

	return p
}

// validateOpenIdNonceCode checks that the nonce hash that is present in the id_token is the right
// hash, given the nonce code present in the http cookie.
//
// This is the replay attack mitigation.
func (p *openidFlowHelper) validateOpenIdNonceCode() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	// Parse the received id_token from the IdP and check nonce code
	nonceHashHex := fmt.Sprintf("%x", p.NonceHash)
	if nonceClaim, ok := p.IdTokenPayload["nonce"]; !ok || nonceHashHex != nonceClaim.(string) {
		p.Error = &AuthenticationFailureError{
			HttpStatus: http.StatusForbidden,
			Reason:     "OpenId token rejected: nonce code mismatch",
		}
	}
	return p
}

// validateOpenIdState verifies that the "state" parameter passed during the callback to Kiali
// has the expected value, given the value of the nonce cookie and Kiali's signing key.
//
// This is the CSRF attack mitigation.
func (p *openidFlowHelper) validateOpenIdState() *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	state := p.State

	separator := strings.LastIndexByte(state, '-')
	if separator != -1 {
		csrfToken, timestamp := state[:separator], state[separator+1:]
		csrfHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", p.Nonce, timestamp, config.GetSigningKey())))

		if fmt.Sprintf("%x", csrfHash) != csrfToken {
			p.Error = &AuthenticationFailureError{
				HttpStatus: http.StatusForbidden,
				Reason:     "Request rejected: CSRF mitigation",
			}
		}
	} else {
		p.Error = &AuthenticationFailureError{
			HttpStatus: http.StatusForbidden,
			Reason:     "Request rejected: State parameter is invalid",
		}
	}

	return p
}

// requestOpenIdToken makes a request to the OpenId server to exchange the received code (of the
// authorization code flow) with a proper identity token (id_token) and an access_token (if applicable).
func (p *openidFlowHelper) requestOpenIdToken(redirect_uri string) *openidFlowHelper {
	// Do nothing if there was an error in previous flow steps.
	if p.Error != nil {
		return p
	}

	oidcMeta, err := getOpenIdMetadata()
	if err != nil {
		p.Error = err
		return p
	}

	cfg := config.Get().Auth.OpenId

	httpClient, err := createHttpClient(oidcMeta.TokenURL)
	if err != nil {
		p.Error = fmt.Errorf("failure when creating http client to request open id token: %w", err)
		return p
	}

	// Exchange authorization code for a token
	requestParams := url.Values{}
	requestParams.Set("code", p.Code)
	requestParams.Set("grant_type", "authorization_code")
	requestParams.Set("redirect_uri", redirect_uri)
	if len(cfg.ClientSecret) == 0 {
		requestParams.Set("client_id", cfg.ClientId)
	}

	tokenRequest, err := http.NewRequest(http.MethodPost, oidcMeta.TokenURL, strings.NewReader(requestParams.Encode()))
	if err != nil {
		p.Error = fmt.Errorf("failure when creating the token request: %w", err)
		return p
	}

	if len(cfg.ClientSecret) > 0 {
		tokenRequest.SetBasicAuth(url.QueryEscape(cfg.ClientId), url.QueryEscape(cfg.ClientSecret))
	}

	tokenRequest.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	response, err := httpClient.Do(tokenRequest)
	if err != nil {
		p.Error = fmt.Errorf("failure when requesting token from IdP: %w", err)
		return p
	}

	defer response.Body.Close()
	rawTokenResponse, err := io.ReadAll(response.Body)
	if err != nil {
		p.Error = fmt.Errorf("failed to read token response from IdP: %w", err)
		return p
	}

	if response.StatusCode != 200 {
		log.Debugf("OpenId token request failed with response: %s", string(rawTokenResponse))
		p.Error = fmt.Errorf("request failed (HTTP response status = %s)", response.Status)
		return p
	}

	// Parse token response
	var tokenResponse struct {
		IdToken     string `json:"id_token"`
		AccessToken string `json:"access_token"`
	}

	err = json.Unmarshal(rawTokenResponse, &tokenResponse)
	if err != nil {
		p.Error = fmt.Errorf("cannot parse OpenId token response: %w", err)
		return p
	}

	if len(tokenResponse.IdToken) == 0 {
		p.Error = errors.New("the IdP did not provide an id_token")
		return p
	}

	p.IdToken = tokenResponse.IdToken
	p.AccessToken = tokenResponse.AccessToken
	return p
}

// buildSessionPayload returns a struct that should be used as a payload for a call to SessionPersistor.CreateSession.
// It contains enough data to restore a session started with the OpenId auth strategy.
func buildSessionPayload(openIdParams *openidFlowHelper) *oidcSessionPayload {
	token := openIdParams.IdToken
	if openIdParams.UseAccessToken {
		token = openIdParams.AccessToken
	}

	return &oidcSessionPayload{
		Token:   token,
		Subject: openIdParams.Subject,
	}
}

// checkDomain verifies that the "hd" or the "email" claims in tokenClaims contain a domain
// from the provided list in allowedDomains (with priority for the "hd" domain).
//
// See also: openidFlowHelper.checkAllowedDomains.
func checkDomain(tokenClaims map[string]interface{}, allowedDomains []string) error {
	var hostedDomain string
	foundDomain := false
	if v, ok := tokenClaims["hd"]; ok {
		hostedDomain = v.(string)
	} else {
		// domains like gmail.com don't have the hosted domain (hd) on claims
		// fields, so we try to get the domain on email claim
		var email string
		if v, ok := tokenClaims["email"]; ok {
			email = v.(string)
		}
		splitedEmail := strings.Split(email, "@")
		if len(splitedEmail) < 2 {
			return fmt.Errorf("cannot detect hosted domain on OpenID for the email %s ", email)
		}
		hostedDomain = splitedEmail[1]
	}
	for _, d := range allowedDomains {
		if hostedDomain == d {
			foundDomain = true
			break
		}
	}
	if !foundDomain {
		return fmt.Errorf("domain %s not allowed to login", hostedDomain)
	}
	return nil
}

// createHttpClient is a helper for creating and configuring an http client that is ready
// to do requests to the url in toUrl, which should be and endpoint of the OpenId server.
func createHttpClient(toUrl string) (*http.Client, error) {
	cfg := config.Get().Auth.OpenId
	parsedUrl, err := url.Parse(toUrl)
	if err != nil {
		return nil, err
	}

	// Check if there is a user-configured custom certificate for the OpenID Server. Read it, if it exists
	var cafile []byte
	if _, customCaErr := os.Stat(OpenIdServerCAFile); customCaErr == nil {
		var caReadErr error
		if cafile, caReadErr = os.ReadFile(OpenIdServerCAFile); caReadErr != nil {
			return nil, fmt.Errorf("failed to read the OpenId CA certificate: %w", caReadErr)
		}
	} else if !errors.Is(customCaErr, os.ErrNotExist) {
		log.Warningf("Unable to read the provided OpenID Server CA file (%s). Ignoring...", customCaErr.Error())
	}

	httpTransport := &http.Transport{}
	if cfg.InsecureSkipVerifyTLS || cafile != nil {
		var certPool *x509.CertPool
		if cafile != nil {
			certPool = x509.NewCertPool()
			if ok := certPool.AppendCertsFromPEM(cafile); !ok {
				return nil, fmt.Errorf("supplied OpenId CA file cannot be parsed")
			}
		}

		httpTransport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: cfg.InsecureSkipVerifyTLS,
			RootCAs:            certPool,
		}
	}

	if cfg.HTTPProxy != "" || cfg.HTTPSProxy != "" {
		proxyFunc := getProxyForUrl(parsedUrl, cfg.HTTPProxy, cfg.HTTPSProxy)
		httpTransport.Proxy = proxyFunc
	}

	httpClient := http.Client{
		Timeout:   time.Second * 10,
		Transport: httpTransport,
	}

	return &httpClient, nil
}

// isOpenIdCodeFlowPossible determines if the "authorization code" flow can be used
// to do user authentication.
func isOpenIdCodeFlowPossible() bool {
	// Kiali's signing key length must be 16, 24 or 32 bytes in order to be able to use
	// encoded cookies.
	switch len(config.GetSigningKey()) {
	case 16, 24, 32:
	default:
		log.Warningf("Cannot use OpenId authorization code flow because signing key is not 16, 24 nor 32 bytes long")
		return false
	}

	// IdP provider's metadata must list "code" in it's supported response types
	metadata, err := getOpenIdMetadata()
	if err != nil {
		// On error, just inform that code flow is not possible
		log.Warningf("Error when fetching OpenID provider's metadata: %s", err.Error())
		return false
	}

	for _, v := range metadata.ResponseTypesSupported {
		if v == "code" {
			return true
		}
	}

	log.Warning("Cannot use the authorization code flow because the OpenID provider does not support the 'code' response type")

	return false
}

// getConfiguredOpenIdScopes gets the list of scopes set in Kiali configuration making sure
// that the mandatory "openid" scope is present in the returned list.
func getConfiguredOpenIdScopes() []string {
	cfg := config.Get().Auth.OpenId
	scopes := cfg.Scopes

	isOpenIdScopePresent := false
	for _, s := range scopes {
		if s == "openid" {
			isOpenIdScopePresent = true
			break
		}
	}

	if !isOpenIdScopePresent {
		scopes = append(scopes, "openid")
	}

	return scopes
}

// getJwkFromKeySet retrieves the Key with the specified keyId from the OpenId server. The key
// is used to verify the signature an id_token.
//
// The OpenId server publishes "key sets" which rotate constantly. This function fetches the currently
// published key set and returns the key with the matching keyId, if found.
//
// The retrieved key sets are cached to prevent flooding the OpenId server. Key sets are
// refreshed as needed, when the requested keyId is not available in the cached key set.
//
// See also getOpenIdJwks, validateOpenIdTokenInHouse.
func getJwkFromKeySet(keyId string) (*jose.JSONWebKey, error) {
	// Helper function to find a key with a certain key id in a key-set.
	findJwkFunc := func(kid string, jwks *jose.JSONWebKeySet) *jose.JSONWebKey {
		for _, key := range jwks.Keys {
			if key.KeyID == kid {
				return &key
			}
		}
		return nil
	}

	if cachedOpenIdKeySet != nil {
		// If key-set is cached, try to find the key in the cached key-set
		foundKey := findJwkFunc(keyId, cachedOpenIdKeySet)
		if foundKey != nil {
			return foundKey, nil
		}
	}

	// If key-set is not cached, or if the requested key was not found in the
	// cached key-set, then fetch/refresh the key-set from the OpenId provider
	keySet, err := getOpenIdJwks()
	if err != nil {
		return nil, err
	}

	// Try to find the key in the fetched key-set
	foundKey := findJwkFunc(keyId, keySet)

	// "foundKey" can be nil. That's acceptable if the key-set does not contain the requested key id
	return foundKey, nil
}

// getOpenIdJwks fetches the currently published key set from the OpenId server.
// It's better to use the getJwkFromKeySet function rather than this one.
func getOpenIdJwks() (*jose.JSONWebKeySet, error) {
	fetchedKeySet, fetchError, _ := openIdFlightGroup.Do("jwks", func() (interface{}, error) {
		oidcMetadata, err := getOpenIdMetadata()
		if err != nil {
			return nil, err
		}

		// Create HTTP client
		httpClient, err := createHttpClient(oidcMetadata.JWKSURL)
		if err != nil {
			return nil, fmt.Errorf("failed to create http client to fetch OpenId JWKS document: %w", err)
		}

		// Fetch Keys document
		response, err := httpClient.Get(oidcMetadata.JWKSURL)
		if err != nil {
			return nil, err
		}

		defer response.Body.Close()
		if response.StatusCode != 200 {
			return nil, fmt.Errorf("cannot fetch OpenId JWKS document (HTTP response status = %s)", response.Status)
		}

		// Parse the Keys document
		var oidcKeys jose.JSONWebKeySet

		rawMetadata, err := io.ReadAll(response.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read OpenId JWKS document: %s", err.Error())
		}

		err = json.Unmarshal(rawMetadata, &oidcKeys)
		if err != nil {
			return nil, fmt.Errorf("cannot parse OpenId JWKS document: %s", err.Error())
		}

		cachedOpenIdKeySet = &oidcKeys // Store the keyset in a "cache"
		return cachedOpenIdKeySet, nil
	})

	if fetchError != nil {
		return nil, fetchError
	}

	return fetchedKeySet.(*jose.JSONWebKeySet), nil
}

// getOpenIdMetadata fetches the OpenId metadata using the configured Issuer URI and
// downloading the metadata from the well-known path '/.well-known/openid-configuration'. Some
// validations are performed and the parsed metadata is returned. Since the metadata should be
// rare to change, the retrieved metadata is cached on first call and subsequent calls return
// the cached metadata.
func getOpenIdMetadata() (*openIdMetadata, error) {
	if cachedOpenIdMetadata != nil {
		return cachedOpenIdMetadata, nil
	}

	fetchedMetadata, fetchError, _ := openIdFlightGroup.Do("metadata", func() (interface{}, error) {
		cfg := config.Get().Auth.OpenId

		// Remove trailing slash from issuer URI, if needed
		trimmedIssuerUri := strings.TrimRight(cfg.IssuerUri, "/")

		httpClient, err := createHttpClient(trimmedIssuerUri)
		if err != nil {
			return nil, fmt.Errorf("failed to create http client to fetch OpenId Metadata: %w", err)
		}

		// Fetch IdP metadata
		response, err := httpClient.Get(trimmedIssuerUri + "/.well-known/openid-configuration")
		if err != nil {
			return nil, err
		}

		defer response.Body.Close()
		if response.StatusCode != 200 {
			return nil, fmt.Errorf("cannot fetch OpenId Metadata (HTTP response status = %s)", response.Status)
		}

		// Parse JSON document
		var metadata openIdMetadata

		rawMetadata, err := io.ReadAll(response.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read OpenId Metadata: %s", err.Error())
		}

		err = json.Unmarshal(rawMetadata, &metadata)
		if err != nil {
			return nil, fmt.Errorf("cannot parse OpenId Metadata: %s", err.Error())
		}

		// Validate issuer == issuerUri
		if metadata.Issuer != cfg.IssuerUri {
			return nil, fmt.Errorf("mismatch between the configured issuer_uri (%s) and the exposed Issuer URI in OpenId provider metadata (%s)", cfg.IssuerUri, metadata.Issuer)
		}

		// Validate there is an authorization endpoint
		if len(metadata.AuthURL) == 0 {
			return nil, errors.New("the OpenID provider does not expose an authorization endpoint")
		}

		// Log warning if OpenId provider informs that some of the configured scopes are not supported
		// It's possible to try authentication. If metadata is right, the error will be evident to the user when trying to login.
		scopes := getConfiguredOpenIdScopes()
		for _, scope := range scopes {
			isScopeSupported := false
			for _, supportedScope := range metadata.ScopesSupported {
				if scope == supportedScope {
					isScopeSupported = true
					break
				}
			}

			if !isScopeSupported {
				log.Warning("Configured OpenID provider informs some of the configured scopes are unsupported. Users may not be able to login.")
				break
			}
		}

		// Return parsed metadata
		cachedOpenIdMetadata = &metadata
		return cachedOpenIdMetadata, nil
	})

	if fetchError != nil {
		return nil, fetchError
	}

	return fetchedMetadata.(*openIdMetadata), nil
}

// getProxyForUrl returns a function which, in turn, returns the URL of the proxy server that should
// be used to reach the targetURL. Both httpProxy and httpsProxy are URLs of proxy servers (can be the same).
// The httpProxy is used if the targetURL has the plain HTTP protocol. The httpsProxy is used if the targetURL
// has the secure HTTPS protocol.
//
// Proxies are used for environments where the cluster does not have direct access to the internet and
// all out-of-cluster/non-internal traffic is required to go through a proxy server.
func getProxyForUrl(targetURL *url.URL, httpProxy string, httpsProxy string) func(req *http.Request) (*url.URL, error) {
	return func(req *http.Request) (*url.URL, error) {
		var proxyUrl *url.URL
		var err error

		if httpProxy != "" && targetURL.Scheme == "http" {
			proxyUrl, err = url.Parse(httpProxy)
		} else if httpsProxy != "" && targetURL.Scheme == "https" {
			proxyUrl, err = url.Parse(httpsProxy)
		}

		if err != nil {
			return nil, err
		}

		return proxyUrl, nil
	}
}

// parseTimeClaim parses the "exp" claim of a JWT token.
//
// As it turns out, the response from time claims can be either a f64 and
// a json.Number. With this, we take care of it, converting to the int64
// that we need to use timestamps in go.
func parseTimeClaim(claimValue interface{}) (int64, error) {
	var err error
	parsedTime := int64(0)

	switch exp := claimValue.(type) {
	case float64:
		// This can not fail
		parsedTime = int64(exp)
	case json.Number:
		// This can fail, so we short-circuit if we get an invalid value.
		parsedTime, err = exp.Int64()
		if err != nil {
			return 0, err
		}
	default:
		return 0, errors.New("the 'exp' claim of the OpenId token has invalid type")
	}

	return parsedTime, nil
}

// validateOpenIdTokenInHouse checks that the id_token provided by the OpenId server
// is valid. Its claims are validated to check that the expected values are present.
// If the claims look OK, the signature is checked against the key sets published by
// the OpenId server.
func validateOpenIdTokenInHouse(openIdParams *openidFlowHelper) error {
	oidCfg := config.Get().Auth.OpenId
	oidMetadata, err := getOpenIdMetadata()
	if err != nil {
		return err
	}

	// Check iss claim matches fetched metadata at discovery
	if issuerClaim, ok := openIdParams.IdTokenPayload["iss"].(string); !ok || issuerClaim != oidMetadata.Issuer {
		return fmt.Errorf("the OpenId token has unexpected issuer claim; got iss = '%s'", issuerClaim)
	}

	// Check the aud claim contains our client-id
	if audienceClaim, ok := openIdParams.IdTokenPayload["aud"]; !ok {
		return errors.New("the OpenId token has no aud claim")
	} else {
		switch ac := audienceClaim.(type) {
		case string:
			if oidCfg.ClientId != ac {
				return fmt.Errorf("the OpenId token is not targeted for Kiali; got aud = '%s'", audienceClaim)
			}
		case []string:
			if len(ac) != 1 {
				return fmt.Errorf("the OpenId token was rejected because it has more than one audience; got aud = %v", audienceClaim)
			}
			if oidCfg.ClientId != ac[0] {
				return fmt.Errorf("the OpenId token is not targeted for Kiali; got []aud = '%v'", audienceClaim)
			}
		default:
			return fmt.Errorf("the OpenId token has an unexpected audience claim; got '%v'", audienceClaim)
		}
	}

	if len(openIdParams.ParsedIdToken.Headers) != 1 {
		return fmt.Errorf("the OpenId token has unexpected number of headers [%d]", len(openIdParams.ParsedIdToken.Headers))
	}

	// Currently, we only support tokens with an RSA signature with SHA-256, which is the default in the OIDC spec
	if openIdParams.ParsedIdToken.Headers[0].Algorithm != "RS256" {
		return fmt.Errorf("the OpenId token has unexpected alg header claim; got alg = '%s'", openIdParams.ParsedIdToken.Headers[0].Algorithm)
	}

	// Check iat (issued at) claim
	if iatClaim, ok := openIdParams.IdTokenPayload["iat"]; !ok {
		return errors.New("the OpenId token has no iat claim or is invalid")
	} else {
		parsedIat, parseErr := parseTimeClaim(iatClaim)
		if parseErr != nil {
			return fmt.Errorf("the OpenId token has an invalid iat claim: %w", parseErr)
		}
		if parsedIat == 0 {
			// This is weird. This would mean an invalid type
			return fmt.Errorf("the OpenId token has an invalid value in the iat claim; got '%v'", iatClaim)
		}

		// Let's do the minimal check to ensure that the token wasn't issued in the future
		// we add a little offset to "now" to add one minute tolerance
		iatTime := time.Unix(parsedIat, 0)
		nowTime := util.Clock.Now().Add(60 * time.Second)
		if iatTime.After(nowTime) {
			return fmt.Errorf("we don't like people living in the future - enjoy the present!; iat = '%d'", parsedIat)
		}
	}

	// Check exp (expiration time) claim
	// The OIDC spec says: "The current time MUST be before the time represented by the exp Claim"
	// No tolerance for this check.
	if !util.Clock.Now().Before(openIdParams.ExpiresOn) {
		return fmt.Errorf("the OpenId token has expired; exp = '%s'", openIdParams.ExpiresOn.String())
	}

	// There are other claims that could be checked, but are not verified here:
	//   - nonce: This should be verified regardless if RBAC is on/off. So, it's verified in
	//       another part of the authentication flow.
	//   - acr: we are not asking for this claim at authorization, so the IdP doesn't
	//       need to provide it nor we need to verify it.
	//   - auth_time: we are not asking for this claim at authorization, so the IdP doesn't
	//	     need to provide it nor we need to verify it.

	// If execution flow reached this point, all claims look valid, but that won't guarantee that
	// the id_token hasn't been tampered. So, we check the signature to find if
	// the token is genuine
	if kidHeader := openIdParams.ParsedIdToken.Headers[0].KeyID; len(kidHeader) == 0 {
		return errors.New("the OpenId token is missing the kid header claim")
	} else {
		if jws, parseErr := jose.ParseSigned(openIdParams.IdToken); parseErr != nil {
			return fmt.Errorf("error when parsing the OpenId token: %w", parseErr)
		} else {
			if len(jws.Signatures) == 0 {
				return errors.New("an unsigned OpenId token is not acceptable")
			}

			matchingKey, findKeyErr := getJwkFromKeySet(kidHeader)
			if findKeyErr != nil {
				return fmt.Errorf("something went wrong when trying to find the key that signed the OpenId token: %w", findKeyErr)
			}
			if matchingKey == nil {
				return errors.New("the OpenId token is signed with an unknown key")
			}

			_, signVerifyErr := jws.Verify(matchingKey)
			if signVerifyErr != nil {
				return fmt.Errorf("the signature of the OpenId token is invalid: %w", signVerifyErr)
			}
		}
	}

	return nil
}

// verifyOpenIdUserAccess checks that the provided token has enough privileges on the cluster to
// allow a login to Kiali.
func verifyOpenIdUserAccess(token string, businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)) (int, string, error) {
	// Create business layer using the id_token
	bsLayer, err := businessInstantiator(&api.AuthInfo{Token: token})
	if err != nil {
		return http.StatusInternalServerError, "Error instantiating the business layer", err
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := bsLayer.Namespace.GetNamespaces(context.TODO())
	if err != nil {
		return http.StatusUnauthorized, "Token is not valid or is expired", err
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		return http.StatusUnauthorized, "Cannot view any namespaces. Please read Kiali's RBAC documentation for more details.", nil
	}

	return http.StatusOK, "", nil
}
