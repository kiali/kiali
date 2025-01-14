package authentication

import (
	"context"
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
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

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
	clusters       []string
	conf           *config.Config
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
func NewOpenshiftAuthController(conf *config.Config, clientFactory kubernetes.ClientFactory) (*OpenshiftAuthController, error) {
	openshiftOAuthService, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clientFactory.GetSAClients(), clientFactory, business.OAuthServerCAFile)
	if err != nil {
		log.Errorf("Error creating OpenshiftOAuthService: %v", err)
		return nil, err
	}

	store, err := NewCookieSessionPersistor[openshiftSessionPayload](conf)
	if err != nil {
		return nil, err
	}

	return &OpenshiftAuthController{
		conf:           conf,
		openshiftOAuth: openshiftOAuthService,
		sessionStore:   store,
		clusters:       maps.Keys(clientFactory.GetSAClients()),
	}, nil
}

// Authenticate is not implemented for the openshift auth strategy because kiali no longer supports the implicit flow.
func (o *OpenshiftAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	return nil, fmt.Errorf("support for OAuth's implicit flow has been removed")
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

	// In OpenShift auth, it is possible that a session is started by a 3rd party. If that's the case, Kiali
	// can receive the OpenShift token of the session via HTTP Headers of via a URL Query string parameter.
	// HTTP Headers have priority over URL parameters. If a token is received via some of these means,
	// then the received session has priority over the Kiali initiated session (stored in cookies).
	if authHeader := r.Header.Get("Authorization"); len(authHeader) != 0 && strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		expires := util.Clock.Now().Add(time.Second * time.Duration(o.conf.LoginToken.ExpirationSeconds))
		user, err := o.openshiftOAuth.GetUserInfo(r.Context(), token, o.conf.KubernetesConfig.ClusterName)
		if err != nil {
			return nil, err
		}

		userSessions[o.conf.KubernetesConfig.ClusterName] = &UserSessionData{
			ExpiresOn: expires,
			Username:  user.Name,
			AuthInfo:  &api.AuthInfo{Token: token},
		}
	} else if authToken := r.URL.Query().Get("oauth_token"); len(authToken) != 0 {
		token := strings.TrimSpace(authToken)
		expires := util.Clock.Now().Add(time.Second * time.Duration(o.conf.LoginToken.ExpirationSeconds))
		user, err := o.openshiftOAuth.GetUserInfo(r.Context(), token, o.conf.KubernetesConfig.ClusterName)
		if err != nil {
			return nil, err
		}

		userSessions[o.conf.KubernetesConfig.ClusterName] = &UserSessionData{
			ExpiresOn: expires,
			Username:  user.Name,
			AuthInfo:  &api.AuthInfo{Token: token},
		}
	} else {
		sessions, err := o.sessionStore.ReadAllSessions(r, w)
		if err != nil {
			return nil, err
		}

		for _, session := range sessions {
			user, err := o.openshiftOAuth.GetUserInfo(r.Context(), session.Payload.AccessToken, session.Key)
			if err != nil {
				if k8serrors.IsUnauthorized(err) {
					// The token is invalid, we should clear the session.
					// This could be an old session for a cluster with the same name.
					log.Debug("Token saved in session is unauthorized to this cluster. This could be an old token from another cluster with an unexpired token. Terminating session...")
					o.sessionStore.TerminateSession(r, w, session.Key)
					continue
				}
				return nil, err
			}
			userSessions[session.Key] = &UserSessionData{
				ExpiresOn: session.ExpiresOn,
				Username:  user.Name,
				AuthInfo:  &api.AuthInfo{Token: session.Payload.AccessToken},
			}
		}
	}

	// TODO: Handle case where user does not have access to kiali's home cluster.
	if len(userSessions) == 0 {
		return nil, fmt.Errorf("no valid session found")
	}

	// TODO: Eventually we shouldn't need this check if the user can somehow login to a cluster without logging into the home cluster.
	// Will probably require selecting which cluster to login to in the UI.
	if homeClusterUserSession, ok := userSessions[o.conf.KubernetesConfig.ClusterName]; !ok {
		return nil, fmt.Errorf("no valid session found for home cluster")
	} else {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", homeClusterUserSession.Username)
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
		err = o.openshiftOAuth.Logout(r.Context(), session.Payload.AccessToken, session.Key)
		if err != nil {
			err = TerminateSessionError{
				Message:    fmt.Sprintf("Could not log out of OpenShift: %v", err),
				HttpStatus: http.StatusInternalServerError,
			}
			log.Debugf("Unable to terminate session: %v", err)
		} else {
			o.sessionStore.TerminateSession(r, w, session.Key)
		}
	}

	if err != nil {
		return err
	}

	return nil
}
