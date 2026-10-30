package authentication

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/exp/maps"
	"golang.org/x/oauth2"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// ErrCannotViewNamespaces is returned when a token authenticates against the cluster
// but cannot view any namespace. It is a Kubernetes "unauthorized" error so the
// authentication middleware rejects the request with HTTP 401, mirroring the OpenID
// strategy's behavior for zero-privilege users.
var ErrCannotViewNamespaces = k8serrors.NewUnauthorized("Cannot view any namespaces. Please read Kiali's RBAC documentation for more details.")

// openshiftSessionPayload holds the data that will be persisted in the SessionStore
// in order to be able to maintain the session of the user across requests.
type openshiftSessionPayload struct {
	oauth2.Token
}

// OpenshiftAuthController contains the backing logic to implement
// Kiali's "openshift" authentication strategy. This authentication
// strategy is basically an implementation of OAuth's authorization
// code flow with the specifics of OpenShift.
//
// Alternatively, it is possible that 3rd-parties are controlling
// the session. For these cases, Kiali can receive an OpenShift token
// via the "Authorization" HTTP Header or via the "oauth_token"
// URL parameter. Token received from 3rd parties are not persisted
// with the active Kiali's persistor, because that would collide and
// replace an existing Kiali session. So, it is assumed that the 3rd-party
// has its own persistence system (similarly to how 'header' auth works).
type OpenshiftAuthController struct {
	clientFactory  kubernetes.ClientFactory
	clusters       []string
	conf           *config.Config
	discovery      istio.MeshDiscovery
	kialiCache     cache.KialiCache
	openshiftOAuth *business.OpenshiftOAuthService
	// SessionStore persists the session between HTTP requests.
	sessionStore SessionPersistor[openshiftSessionPayload]
}

func extractClusterName(r *http.Request, conf *config.Config) string {
	vars := mux.Vars(r)
	cluster := vars["cluster"]
	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}
	return cluster
}

// NewOpenshiftAuthController initializes a new controller for handling OpenShift authentication.
// The OAuth service created inside the constructor will make a request to the OpenShift OAuth server
// to gather OAuth metadata.
func NewOpenshiftAuthController(conf *config.Config, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, discovery istio.MeshDiscovery) (*OpenshiftAuthController, error) {
	openshiftOAuthService, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clientFactory.GetSAClients(), clientFactory)
	if err != nil {
		log.Errorf("Error creating OpenshiftOAuthService: %v", err)
		return nil, err
	}

	store, err := NewCookieSessionPersistor[openshiftSessionPayload](conf)
	if err != nil {
		return nil, err
	}

	return &OpenshiftAuthController{
		clientFactory:  clientFactory,
		clusters:       maps.Keys(clientFactory.GetSAClients()),
		conf:           conf,
		discovery:      discovery,
		kialiCache:     kialiCache,
		openshiftOAuth: openshiftOAuthService,
		sessionStore:   store,
	}, nil
}

// Authenticate is not implemented for the openshift auth strategy because kiali no longer supports the implicit flow.
func (o *OpenshiftAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	return nil, fmt.Errorf("support for OAuth's implicit flow has been removed")
}

// checkTokenCanViewNamespaces verifies that the given token can view at least one
// namespace on the given cluster, mirroring the OpenID strategy's
// verifyOpenIdUserAccess check. Tokens with zero namespace visibility (e.g.
// ServiceAccount tokens without any RoleBinding) must not get a Kiali session.
// The namespace list is cached per token (CacheTokenNamespaceDuration), so the cost
// of this check on per-request session validation is bounded.
func (o *OpenshiftAuthController) checkTokenCanViewNamespaces(ctx context.Context, token, cluster string) error {
	authInfo := &api.AuthInfo{Token: token}
	userClient, err := o.clientFactory.GetClient(authInfo, cluster)
	if err != nil {
		return fmt.Errorf("unable to create a Kubernetes client from the auth token: %w", err)
	}
	userClients := map[string]kubernetes.UserClientInterface{cluster: userClient}

	namespaceService := business.NewNamespaceService(o.kialiCache, o.conf, o.discovery, o.clientFactory.GetSAClients(), userClients)

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := namespaceService.GetNamespaces(ctx)
	if err != nil {
		return err
	}

	if len(nsList) == 0 {
		return ErrCannotViewNamespaces
	}

	return nil
}

// OpenshiftAuthCallback will attempt to extract the nonce cookie and the code from the request.
func (o *OpenshiftAuthController) OpenshiftAuthCallback(w http.ResponseWriter, r *http.Request) {
	webRoot := o.conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"

	cluster := extractClusterName(r, o.conf)
	nonceCookie, err := r.Cookie(nonceCookieName(cluster))
	if err != nil {
		log.Debugf("Not handling OAuth code flow authentication: could not get the nonce cookie: %v", err)
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape(err.Error()), cluster), http.StatusFound)
		return
	}

	code := r.FormValue("code")
	if code == "" {
		log.Debug("Not handling OAuth code flow authentication: code not present in response from OAuth server")
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape("code not present in response from OAuth server"), cluster), http.StatusFound)
		return
	}

	tok, err := o.openshiftOAuth.Exchange(r.Context(), code, nonceCookie.Value, cluster)
	if err != nil {
		log.Errorf("Authentication rejected: Unable to exchange the code for a token: %v", err)
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape(err.Error()), cluster), http.StatusFound)
		return
	}

	// Reject the login if the token cannot view any namespace (mirrors the OpenID
	// strategy's login-time check).
	if err := o.checkTokenCanViewNamespaces(r.Context(), tok.AccessToken, cluster); err != nil {
		log.Errorf("Authentication rejected: %v", err)
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape(err.Error()), cluster), http.StatusFound)
		return
	}

	sessionData, err := NewSessionData(cluster, config.AuthStrategyOpenshift, tok.Expiry, &openshiftSessionPayload{Token: *tok})
	if err != nil {
		log.Errorf("Authentication rejected: Could not create the session data: %v", err)
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape(err.Error()), cluster), http.StatusFound)
		return
	}

	if err := o.sessionStore.CreateSession(r, w, *sessionData); err != nil {
		log.Errorf("Authentication rejected: Could not create the session: %v", err)
		http.Redirect(w, r, fmt.Sprintf("%s?openshift_error=%s&cluster=%s", webRootWithSlash, url.QueryEscape(err.Error()), cluster), http.StatusFound)
		return
	}

	// Delete the nonce cookie since we no longer need it.
	deleteNonceCookie := http.Cookie{
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		MaxAge:   -1,
		Name:     nonceCookieName(cluster),
		Path:     o.conf.Server.WebRoot,
		Secure:   nonceCookie.Secure,
		SameSite: http.SameSiteStrictMode,
		Value:    "",
	}
	http.SetCookie(w, &deleteNonceCookie)

	// Use the authorization code that is pushed to the redirect
	// Let's redirect (remove the openid params) to let the Kiali-UI to boot
	http.Redirect(w, r, webRootWithSlash, http.StatusFound)
}

// OpenshiftAuthRedirect redirects the user to the OpenShift OAuth server to start the OAuth flow.
// This is necessary to save the verifier in the nonce cookie before redirecting to the OpenShift OAuth server.
func (o *OpenshiftAuthController) OpenshiftAuthRedirect(w http.ResponseWriter, r *http.Request) {
	cluster := extractClusterName(r, o.conf)
	verifier := oauth2.GenerateVerifier() // Store in the session cookie

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	url, err := o.openshiftOAuth.AuthCodeURL(verifier, cluster)
	if err != nil {
		log.Errorf("Error getting the AuthCodeURL: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	oAuthConfig, err := o.openshiftOAuth.OAuthConfig(cluster)
	if err != nil {
		log.Errorf("Error getting the OAuthConfig: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// If redirect url is https, then we can assume that the endpoint is accepting https traffic
	// and the cookie should be secure.
	secureFlag := o.conf.IsServerHTTPS() || strings.HasPrefix(url, "https:")

	nowTime := util.Clock.Now()
	expirationTime := nowTime.Add(time.Duration(oAuthConfig.TokenAgeInSeconds) * time.Second)

	// nonce cookie stores the verifier.
	nonceCookie := http.Cookie{
		Expires:  expirationTime,
		HttpOnly: true,
		Secure:   secureFlag,
		Name:     nonceCookieName(cluster),
		Path:     o.conf.Server.WebRoot,
		// TODO: Can this be strict?
		SameSite: http.SameSiteLaxMode,
		Value:    verifier,
	}

	log.Tracef("Adding nonce and redirecting to: %s", url)
	http.SetCookie(w, &nonceCookie)
	http.Redirect(w, r, url, http.StatusFound)
}

// ValidateSession restores a session previously created by the Authenticate function. The user token (access_token)
// is revalidated by re-fetching user info from the cluster, to ensure that the token hasn't been revoked.
// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
func (o *OpenshiftAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (UserSessions, error) {
	userSessions := make(UserSessions)

	// terminatedZeroAccess tracks whether at least one session was terminated in
	// this request because its token can no longer view any namespace, and
	// terminatedZeroAccessHome whether that session was the mandatory home
	// cluster's. See the cookie-session branch below and the home-cluster check
	// at the end of validation.
	terminatedZeroAccess := false
	terminatedZeroAccessHome := false

	// In OpenShift auth, it is possible that a session is started by a 3rd party. If that's the case, Kiali
	// can receive the OpenShift token of the session via HTTP Headers of via a URL Query string parameter.
	// HTTP Headers have priority over URL parameters. If a token is received via some of these means,
	// then the received session has priority over the Kiali initiated session (stored in cookies).
	// Note: 3rd-party sessions don't have a Kiali session ID (SessionID will be empty).
	if authHeader := r.Header.Get("Authorization"); len(authHeader) != 0 && strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		expires := util.Clock.Now().Add(time.Second * time.Duration(o.conf.LoginToken.ExpirationSeconds))
		user, err := o.openshiftOAuth.GetUserInfo(r.Context(), token, o.conf.KubernetesConfig.ClusterName)
		if err != nil {
			return nil, err
		}

		// The check runs against the raw token.
		if err := o.checkTokenCanViewNamespaces(r.Context(), token, o.conf.KubernetesConfig.ClusterName); err != nil {
			return nil, err
		}

		userSessions[o.conf.KubernetesConfig.ClusterName] = &UserSessionData{
			AuthInfo:  &api.AuthInfo{Token: token},
			ExpiresOn: expires,
			SessionID: "",
			Username:  user.Name,
		}
		// WARNING: Reading the bearer token from a URL query parameter exposes it in proxy/access
		// logs, browser history, and Referer headers. This path exists because OpenShift's OAuth
		// server redirects back with the token as a query parameter. Operators should configure
		// their proxy/ingress to strip or mask the oauth_token parameter from access logs.
	} else if authToken := r.URL.Query().Get("oauth_token"); len(authToken) != 0 {
		token := strings.TrimSpace(authToken)
		expires := util.Clock.Now().Add(time.Second * time.Duration(o.conf.LoginToken.ExpirationSeconds))
		user, err := o.openshiftOAuth.GetUserInfo(r.Context(), token, o.conf.KubernetesConfig.ClusterName)
		if err != nil {
			return nil, err
		}

		// This is a separate copy of the bearer-token validation, not a funnel into
		// it: it needs its own namespace-access check.
		if err := o.checkTokenCanViewNamespaces(r.Context(), token, o.conf.KubernetesConfig.ClusterName); err != nil {
			return nil, err
		}

		userSessions[o.conf.KubernetesConfig.ClusterName] = &UserSessionData{
			AuthInfo:  &api.AuthInfo{Token: token},
			ExpiresOn: expires,
			SessionID: "",
			Username:  user.Name,
		}
	} else {
		sessions, err := o.sessionStore.ReadAllSessions(r, w)
		if err != nil {
			return nil, err
		}

		for _, session := range sessions {
			user, err := o.openshiftOAuth.GetUserInfo(r.Context(), session.Payload.AccessToken, session.Cluster)
			if err != nil {
				if k8serrors.IsUnauthorized(err) {
					// The token is invalid, we should clear the session.
					// This could be an old session for a cluster with the same name.
					log.Debug("Token saved in session is unauthorized to this cluster. This could be an old token from another cluster with an unexpired token. Terminating session...")
					o.sessionStore.TerminateSession(r, w, session.Cluster)
					continue
				}
				return nil, err
			}
			// Re-check namespace visibility on every request: this also terminates
			// pre-existing sessions of users whose access has dropped to zero,
			// instead of letting them ride until expiry. Only the affected
			// cluster's session is terminated and validation continues with the
			// remaining (healthy) sessions: returning the error here would fail
			// the whole request, and the authentication middleware would then
			// terminate and revoke every session, including the healthy ones,
			// logging the user out of the entire multi-cluster setup because one
			// remote cluster lost access. (Same graceful degradation as the
			// unauthorized-token branch above.)
			if err := o.checkTokenCanViewNamespaces(r.Context(), session.Payload.AccessToken, session.Cluster); err != nil {
				if errors.Is(err, ErrCannotViewNamespaces) {
					log.Debug("Token saved in session cannot view any namespace. Terminating session...")
					o.sessionStore.TerminateSession(r, w, session.Cluster)
					terminatedZeroAccess = true
					if session.Cluster == o.conf.KubernetesConfig.ClusterName {
						terminatedZeroAccessHome = true
					}
					continue
				}
				return nil, err
			}
			userSessions[session.Cluster] = &UserSessionData{
				AuthInfo:  &api.AuthInfo{Token: session.Payload.AccessToken},
				ExpiresOn: session.ExpiresOn,
				SessionID: session.SessionID,
				Username:  user.Name,
			}
		}
	}

	// TODO: Handle case where user does not have access to kiali's home cluster.
	if len(userSessions) == 0 {
		if terminatedZeroAccess {
			// Every session was terminated because its token can no longer view
			// any namespace: report the specific, 401-mapped reason instead of a
			// generic "no valid session found" (which would surface as a 500).
			return nil, ErrCannotViewNamespaces
		}
		return nil, fmt.Errorf("no valid session found")
	}

	// TODO: Eventually we shouldn't need this check if the user can somehow login to a cluster without logging into the home cluster.
	// Will probably require selecting which cluster to login to in the UI.
	if homeClusterUserSession, ok := userSessions[o.conf.KubernetesConfig.ClusterName]; !ok {
		// The home cluster session is mandatory: without it the user cannot use
		// Kiali at all. Report an authentication error (HTTP 401) rather than a
		// generic 500, so the UI handles it as session expiry and the middleware
		// can terminate any remaining remote sessions. A plain error here would
		// 500 on every request (including follow-up requests that only carry the
		// remote cookie), leaving the UI stuck on failing pages with no logout
		// path. When the home session was terminated in this request because its
		// token can no longer view any namespace, report the specific reason.
		if terminatedZeroAccessHome {
			return nil, ErrCannotViewNamespaces
		}
		return nil, fmt.Errorf("session %w: no valid session found for home cluster", ErrSessionNotFound)
	} else {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Set("Kiali-User", homeClusterUserSession.Username)
	}

	return userSessions, nil
}

// TerminateSession session created by the Authenticate function.
// To properly clean the session, the OpenShift access_token is revoked/deleted by making a call
// to the relevant OpenShift API. If this process fails, the session is not cleared and an error
// is returned.
// The cleanup is done assuming the access_token was issued to be used only in Kiali.
func (o *OpenshiftAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	sessions, err := o.sessionStore.ReadAllSessions(r, w)
	if err != nil {
		return err
	}

	for _, session := range sessions {
		err = o.openshiftOAuth.Logout(r.Context(), session.Payload.AccessToken, session.Cluster)
		if err != nil {
			err = TerminateSessionError{
				Message:    fmt.Sprintf("Could not log out of OpenShift: %v", err),
				HttpStatus: http.StatusInternalServerError,
			}
			log.Debugf("Unable to terminate session: %v", err)
		} else {
			o.sessionStore.TerminateSession(r, w, session.Cluster)
		}
	}

	if err != nil {
		return err
	}

	return nil
}
