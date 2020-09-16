package handlers

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

type AuthenticationHandler struct {
	saToken string
}

type AuthInfo struct {
	Strategy              string      `json:"strategy"`
	AuthorizationEndpoint string      `json:"authorizationEndpoint,omitempty"`
	LogoutEndpoint        string      `json:"logoutEndpoint,omitempty"`
	LogoutRedirect        string      `json:"logoutRedirect,omitempty"`
	SessionInfo           sessionInfo `json:"sessionInfo"`
	SecretMissing         bool        `json:"secretMissing,omitempty"`
}

type sessionInfo struct {
	Username  string `json:"username,omitempty"`
	ExpiresOn string `json:"expiresOn,omitempty"`
}

// TokenResponse tokenResponse
//
// This is used for returning the token
//
// swagger:model TokenResponse
type TokenResponse struct {
	// The username for the token
	// A string with the user's username
	//
	// example: admin
	// required: true
	Username string `json:"username"`
	// The authentication token
	// A string with the authentication token for the user
	//
	// example: zI1NiIsIsR5cCI6IkpXVCJ9.ezJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNTI5NTIzNjU0fQ.PPZvRGnR6VA4v7FmgSfQcGQr-VD
	// required: true
	Token string `json:"token"`
	// The expired time for the token
	// A string with the Datetime when the token will be expired
	//
	// example: Thu, 07 Mar 2019 17:50:26 +0000
	// required: true
	ExpiresOn string `json:"expiresOn"`
}

func getTokenStringFromRequest(r *http.Request) string {
	tokenString := "" // Default to no token.

	// Token can be provided by a browser in a Cookie or
	// in an authorization HTTP header.
	// The token in the cookie has priority.
	if authCookie, err := r.Cookie(config.TokenCookieName); err != http.ErrNoCookie {
		tokenString = authCookie.Value
	} else if headerValue := r.Header.Get("Authorization"); strings.Contains(headerValue, "Bearer") {
		tokenString = strings.TrimPrefix(headerValue, "Bearer ")
	}

	return tokenString
}

func performOpenshiftAuthentication(w http.ResponseWriter, r *http.Request) bool {
	err := r.ParseForm()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, fmt.Errorf("error parsing form info: %+v", err))
		return false
	}

	token := r.Form.Get("access_token")
	expiresIn := r.Form.Get("expires_in")
	if token == "" || expiresIn == "" {
		RespondWithError(w, http.StatusInternalServerError, "Token is empty or invalid.")
		return false
	}

	expiresInNumber, err := strconv.Atoi(expiresIn)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Token is empty or invalid.", err.Error())
		return false
	}

	expiresOn := time.Now().Add(time.Second * time.Duration(expiresInNumber))

	business, err := getBusiness(r)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error retrieving the OAuth package (getting business layer).", err.Error())
		return false
	}

	user, err := business.OpenshiftOAuth.GetUserInfo(token)
	if err != nil {
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired.", err.Error())
		return false
	}

	tokenClaims := config.IanaClaims{
		SessionId: token,
		StandardClaims: jwt.StandardClaims{
			Subject:   user.Metadata.Name,
			ExpiresAt: expiresOn.Unix(),
			Issuer:    config.AuthStrategyOpenshiftIssuer,
		},
	}
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  expiresOn,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: expiresOn.Format(time.RFC1123Z), Username: user.Metadata.Name})
	return true
}

func performOpenIdAuthentication(w http.ResponseWriter, r *http.Request) bool {
	// Read received HTTP params and check for data completeness
	openIdParams, err := business.ExtractOpenIdCallbackParams(r)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return false
	}

	business.CallbackCleanup(w)

	if checkFailure := business.CheckOpenIdImplicitFlowParams(openIdParams); len(checkFailure) != 0 {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return false
	}

	// CSRF mitigation
	if stateError := business.ValidateOpenIdState(openIdParams); len(stateError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Request rejected: %s", stateError))
		return false
	}

	// Parse the received id_token from the IdP and check nonce code
	if err := business.ParseOpenIdToken(openIdParams); err != nil {
		RespondWithError(w, http.StatusUnauthorized, err.Error())
		return false
	}
	if nonceError := business.ValidateOpenIdNonceCode(openIdParams); len(nonceError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("OpenId token rejected: %s", nonceError))
		return false
	}

	// Check if user trying to login has enough privileges to login
	httpStatus, errMsg, detailedError := business.VerifyOpenIdUserAccess(openIdParams.IdToken)
	if detailedError != nil {
		RespondWithDetailedError(w, httpStatus, errMsg, detailedError.Error())
		return false
	} else if httpStatus != http.StatusOK {
		RespondWithError(w, httpStatus, errMsg)
		return false
	}

	// Now that we know that the OpenId token is valid, build our session cookie
	// and send it to the browser.
	tokenClaims := business.BuildOpenIdJwtClaims(openIdParams)
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  openIdParams.ExpiresOn,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: openIdParams.ExpiresOn.Format(time.RFC1123Z), Username: openIdParams.Subject})
	return true
}

func performTokenAuthentication(w http.ResponseWriter, r *http.Request) bool {
	err := r.ParseForm()

	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error parsing form data from client", err.Error())
		return false
	}

	token := r.Form.Get("token")

	if token == "" {
		RespondWithError(w, http.StatusInternalServerError, "Token is empty.")
		return false
	}

	business, err := business.Get(token)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		return false
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		RespondWithError(w, http.StatusUnauthorized, "Not enough privileges to login")
		return false
	}

	// Now that we know that the ServiceAccount token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	tokenSubject := "token" // Set a default value

	parsedClusterToken, _, err := new(jwt.Parser).ParseUnverified(token, &jwt.StandardClaims{})
	if err == nil {
		tokenSubject = parsedClusterToken.Claims.(*jwt.StandardClaims).Subject
		tokenSubject = strings.TrimPrefix(tokenSubject, "system:serviceaccount:") // Shorten the subject displayed in UI.
	}

	// Build the Kiali token
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	tokenClaims := config.IanaClaims{
		SessionId: token,
		StandardClaims: jwt.StandardClaims{
			Subject:   tokenSubject,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  timeExpire,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: timeExpire.Format(time.RFC1123Z), Username: tokenSubject})
	return true
}

func performOpenshiftLogout(r *http.Request) (int, error) {
	tokenString := getTokenStringFromRequest(r)
	if tokenString == "" {
		// No token on logout, so we assume we're already logged out
		return http.StatusUnauthorized, errors.New("Already logged out")
	}
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
		return http.StatusInternalServerError, err
	} else {
		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, err
		}

		err = business.OpenshiftOAuth.Logout(claims.SessionId)
		if err != nil {
			log.Warning("Could not log out of OpenShift: ", err)
			return http.StatusInternalServerError, err
		}

		return http.StatusNoContent, nil
	}
}

func checkOpenshiftSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.OpenshiftOAuth.GetUserInfo(claims.SessionId)
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warning("Token error: ", err)
	}

	return http.StatusUnauthorized, ""
}

func checkOpenIdSession(w http.ResponseWriter, r *http.Request) (int, string) {
	// First, check presence of a session for the "implicit flow"
	var claims *config.IanaClaims

	tokenString := getTokenStringFromRequest(r)
	if len(tokenString) != 0 {
		var err error = nil
		if claims, err = config.GetTokenClaimsIfValid(tokenString); err != nil {
			log.Warningf("Token is invalid: %s", err.Error())
			return http.StatusUnauthorized, ""
		}
	} else {
		// If not present, check presence of a session for the "authorization code" flow
		var err error = nil
		claims, err = business.GetOpenIdAesSession(r)
		if err != nil {
			log.Warningf("There was an error when decoding the session: %s", err.Error())
			return http.StatusUnauthorized, ""
		}
		if claims == nil {
			log.Warningf("User seems to not be logged in")
			return http.StatusUnauthorized, ""
		}
	}

	// Session ID claim must be present
	if len(claims.SessionId) == 0 {
		log.Warning("Token is invalid: sid claim is required")
		return http.StatusUnauthorized, ""
	}

	business, err := business.Get(claims.SessionId)
	if err != nil {
		log.Warning("Could not get the business layer : ", err)
		return http.StatusInternalServerError, ""
	}

	// Parse the sid claim (id_token) to check that the sub claim matches to the configured "username" claim of the id_token
	parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(claims.SessionId, jwt.MapClaims{})
	if err != nil {
		log.Warning("Cannot parse sid claim of the Kiali token : ", err)
		return http.StatusInternalServerError, ""
	}
	if userClaim, ok := parsedIdToken.Claims.(jwt.MapClaims)[config.Get().Auth.OpenId.UsernameClaim]; ok && claims.Subject != userClaim {
		log.Warning("Kiali token rejected because of subject claim mismatch")
		return http.StatusUnauthorized, ""
	}

	_, err = business.Namespace.GetNamespaces()
	if err == nil {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", claims.Subject)
		return http.StatusOK, claims.SessionId
	}

	log.Warning("Token error: ", err)

	return http.StatusUnauthorized, ""
}

func checkTokenSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.Namespace.GetNamespaces()
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warning("Token error: ", err)
	}

	return http.StatusUnauthorized, ""
}

func NewAuthenticationHandler() (AuthenticationHandler, error) {
	// Read token from the filesystem
	saToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return AuthenticationHandler{}, err
	}
	return AuthenticationHandler{saToken: saToken}, nil
}

func (aHandler AuthenticationHandler) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		conf := config.Get()

		var token string

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			statusCode, token = checkOpenshiftSession(w, r)
		case config.AuthStrategyOpenId:
			statusCode, token = checkOpenIdSession(w, r)
		case config.AuthStrategyToken:
			statusCode, token = checkTokenSession(w, r)
		case config.AuthStrategyAnonymous:
			log.Tracef("Access to the server endpoint is not secured with credentials - letting request come in. Url: [%s]", r.URL.String())
			token = aHandler.saToken
		}

		switch statusCode {
		case http.StatusOK:
			context := context.WithValue(r.Context(), "token", token)
			next.ServeHTTP(w, r.WithContext(context))
		case http.StatusUnauthorized:
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}

func (aHandler AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		context := context.WithValue(r.Context(), "token", "")
		next.ServeHTTP(w, r.WithContext(context))
	})
}

func Authenticate(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		performOpenshiftAuthentication(w, r)
	case config.AuthStrategyOpenId:
		performOpenIdAuthentication(w, r)
	case config.AuthStrategyToken:
		performTokenAuthentication(w, r)
	case config.AuthStrategyAnonymous:
		log.Warning("Authentication attempt with anonymous access enabled.")
	default:
		message := fmt.Sprintf("Cannot authenticate users, because strategy <%s> is unknown.", conf.Auth.Strategy)
		log.Errorf(message)
		RespondWithError(w, http.StatusInternalServerError, message)
	}
}

func AuthenticationInfo(w http.ResponseWriter, r *http.Request) {
	var response AuthInfo

	conf := config.Get()

	response.Strategy = conf.Auth.Strategy

	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		business, err := getBusiness(r)
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error authenticating (getting business layer)", err.Error())
			return
		}

		metadata, err := business.OpenshiftOAuth.Metadata()
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error trying to get OAuth metadata", err.Error())
			return
		}

		response.AuthorizationEndpoint = metadata.AuthorizationEndpoint
		response.LogoutEndpoint = metadata.LogoutEndpoint
		response.LogoutRedirect = metadata.LogoutRedirect
	case config.AuthStrategyOpenId:
		// Do the redirection through an intermediary own endpoint
		response.AuthorizationEndpoint = fmt.Sprintf("%s/api/auth/openid_redirect",
			httputil.GuessKialiURL(r))
	}

	token := getTokenStringFromRequest(r)
	claims, _ := config.GetTokenClaimsIfValid(token)
	if claims == nil && conf.Auth.Strategy == config.AuthStrategyOpenId {
		claims, _ = business.GetOpenIdAesSession(r)
	}

	if claims != nil {
		response.SessionInfo = sessionInfo{
			ExpiresOn: time.Unix(claims.ExpiresAt, 0).Format(time.RFC1123Z),
			Username:  claims.Subject,
		}
	}

	RespondWithJSON(w, http.StatusOK, response)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()

	cookiesToDrop := []string{
		config.TokenCookieName,
		config.TokenCookieName + "-aes",
	}
	for _, cookieName := range cookiesToDrop {
		_, err := r.Cookie(cookieName)

		if err != http.ErrNoCookie {
			tokenCookie := http.Cookie{
				Name:     cookieName,
				Value:    "",
				Expires:  time.Unix(0, 0),
				HttpOnly: true,
				Path:     conf.Server.WebRoot,
				SameSite: http.SameSiteStrictMode,
			}
			http.SetCookie(w, &tokenCookie)
		}
	}

	// We need to perform an extra step to invalidate the user token when using OpenShift OAuth
	if conf.Auth.Strategy == config.AuthStrategyOpenshift {
		code, err := performOpenshiftLogout(r)
		if err != nil {
			RespondWithError(w, code, err.Error())
		} else {
			RespondWithCode(w, code)
		}
	} else {
		RespondWithCode(w, http.StatusNoContent)
	}
}

func OpenIdRedirect(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()

	// This endpoint should be available only when OpenId strategy
	if conf.Auth.Strategy != config.AuthStrategyOpenId {
		RespondWithError(w, http.StatusNotFound, "OpenId strategy is not enabled")
		return
	}

	// Build scopes string
	scopes := strings.Join(business.GetConfiguredOpenIdScopes(), " ")

	// Determine authorization endpoint
	authorizationEndpoint := conf.Auth.OpenId.AuthorizationEndpoint
	if len(authorizationEndpoint) == 0 {
		openIdMetadata, err := business.GetOpenIdMetadata()
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error fetching OpenID provider metadata.", err.Error())
			return
		}
		authorizationEndpoint = openIdMetadata.AuthURL
	}

	// Create a "nonce" code and set a cookie with the code
	// It was chosen 15 chars arbitrarily. Probably, it's not worth to make this value configurable.
	nonceCode, err := util.CryptoRandomString(15)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Random number generator failed")
		return
	}

	nowTime := util.Clock.Now()
	expirationTime := nowTime.Add(time.Duration(conf.Auth.OpenId.AuthenticationTimeout) * time.Second)
	nonceCookie := http.Cookie{
		Expires:  expirationTime,
		HttpOnly: true,
		Name:     business.OpenIdNonceCookieName,
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

	// Use OpenId's "implicit flow" by default. Use "authorization code" flow if possible.
	responseType := "id_token"
	if business.IsOpenIdCodeFlowPossible() {
		responseType = "code"
	}

	// Send redirection to browser
	redirectUri := fmt.Sprintf("%s?client_id=%s&response_type=%s&redirect_uri=%s&scope=%s&nonce=%s&state=%s",
		authorizationEndpoint,
		url.QueryEscape(conf.Auth.OpenId.ClientId),
		responseType,
		url.QueryEscape(httputil.GuessKialiURL(r)),
		url.QueryEscape(scopes),
		url.QueryEscape(fmt.Sprintf("%x", nonceHash)),
		url.QueryEscape(fmt.Sprintf("%x-%s", csrfHash, nowTime.UTC().Format("060102150405"))),
	)
	http.Redirect(w, r, redirectUri, http.StatusFound)
}

func OpenIdCodeFlowHandler(w http.ResponseWriter, r *http.Request) bool {
	// Read received HTTP params and check for data completeness
	openIdParams, err := business.ExtractOpenIdCallbackParams(r)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return true // Return true to mark request as handled (because an error is already being sent back)
	}

	if checkFailure := business.CheckOpenIdAuthorizationCodeFlowParams(openIdParams); len(checkFailure) != 0 {
		log.Infof("Not handling OpenId code flow authentication: %s", checkFailure)
		return false
	}

	// Start handling the callback for OpenId authentication (code flow)
	business.CallbackCleanup(w)

	// CSRF mitigation
	if stateError := business.ValidateOpenIdState(openIdParams); len(stateError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Request rejected: %s", stateError))
		return true
	}

	// Exchange the received code for a token
	if err := business.RequestOpenIdToken(openIdParams, httputil.GuessKialiURL(r)); err != nil {
		RespondWithDetailedError(w, http.StatusForbidden, "failure when retrieving user identity", err.Error())
		return true
	}

	if err := business.ParseOpenIdToken(openIdParams); err != nil {
		RespondWithError(w, http.StatusUnauthorized, err.Error())
		return true
	}

	// Replay attack mitigation
	if nonceError := business.ValidateOpenIdNonceCode(openIdParams); len(nonceError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("OpenId token rejected: %s", nonceError))
		return true
	}

	// Check if user trying to login has enough privileges to login
	httpStatus, errMsg, detailedError := business.VerifyOpenIdUserAccess(openIdParams.IdToken)
	if detailedError != nil {
		RespondWithDetailedError(w, httpStatus, errMsg, detailedError.Error())
		return true
	} else if httpStatus != http.StatusOK {
		RespondWithError(w, httpStatus, errMsg)
		return true
	}

	// Create Kiali's session cookie and set it in the response

	// For the OpenId's "authorization code" flow we don't want
	// any of the session data to be readable even in the browser's
	// developer console. So, we cipher the session data using AES-GCM
	// which allows to leave aside the usage of JWT tokens. So, this
	// builds a bare JSON serialized into a string, cipher it and
	// set a cookie with the ciphered string. Yet, we use the
	// "IanaClaims" type just for convenience to avoid creating new types and
	// to bring some type convergence on types for the auth source code.
	sessionData := business.BuildOpenIdJwtClaims(openIdParams)
	sessionDataJson, err := json.Marshal(sessionData)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error when creating credentials - failed to marshal json", err.Error())
		return true
	}

	// Cipher the session data
	block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error when creating credentials - failed to create cipher", err.Error())
		return true
	}

	aesGcm, err := cipher.NewGCM(block)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error when creating credentials - failed to create gcm", err.Error())
		return true
	}

	aesGcmNonce, err := util.CryptoRandomBytes(aesGcm.NonceSize())
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error when creating credentials - failed to generate random bytes", err.Error())
		return true
	}

	cipherSessionData := aesGcm.Seal(aesGcmNonce, aesGcmNonce, sessionDataJson, nil)
	authCookie := http.Cookie{
		Name:     config.TokenCookieName + "-aes",
		Value:    base64.StdEncoding.EncodeToString(cipherSessionData),
		Expires:  openIdParams.ExpiresOn,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &authCookie)

	// Let's redirect (remove the openid params) to let the Kiali-UI to boot
	conf := config.Get()
	webRoot := conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"
	http.Redirect(w, r, webRootWithSlash, http.StatusFound)

	return true
}
