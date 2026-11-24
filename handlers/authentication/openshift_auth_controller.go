package authentication

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
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

var (
	// ErrCannotViewNamespaces is returned when a token authenticates against the cluster
	// but cannot view any namespace. It is a Kubernetes "unauthorized" error so the
	// authentication middleware rejects the request with HTTP 401, mirroring the OpenID
	// strategy's behavior for zero-privilege users.
	ErrCannotViewNamespaces = k8serrors.NewUnauthorized("Cannot view any namespaces. Please read Kiali's RBAC documentation for more details.")
	ErrImpersonationDenied  = errors.New("impersonation denied: privileged identity")
	ErrNotInAllowlist       = errors.New("impersonation denied: not in allowlist")
)

// Kubernetes RBAC has no deny rules — the hardcoded guard and RBAC resourceNames
// serve complementary purposes. The guard blocks known-bad identities (system:*);
// RBAC resourceNames restricts to known-good identities (the allowlist).
func ValidateImpersonationIdentity(username string, groups []string) error {
	if strings.HasPrefix(username, "system:") {
		return fmt.Errorf("%w: identity %q is a privileged system identity", ErrImpersonationDenied, username)
	}
	for _, g := range groups {
		if g == "system:masters" || g == "system:nodes" || strings.HasPrefix(g, "system:serviceaccounts") {
			return fmt.Errorf("%w: identity %q belongs to privileged system group %q", ErrImpersonationDenied, username, g)
		}
	}
	return nil
}

func FilterImpersonationGroups(groups []string, allowedGroups []string, username string) []string {
	if len(allowedGroups) == 0 {
		return groups
	}
	filtered := make([]string, 0, len(groups))
	for _, g := range groups {
		if g == "system:authenticated" || g == "system:authenticated:oauth" {
			filtered = append(filtered, g)
		} else if slices.Contains(allowedGroups, g) {
			filtered = append(filtered, g)
		} else {
			log.Warningf("Impersonation: dropping group %q for user %q (not in allowed_groups)", g, username)
		}
	}
	return filtered
}

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
	clientFactory kubernetes.ClientFactory
	clusters      []string
	conf          *config.Config
	discovery     istio.MeshDiscovery
	// indeterminateMu guards indeterminateValidation: ValidateSession validates
	// the per-cluster sessions concurrently.
	indeterminateMu sync.Mutex
	// indeterminateValidation records, per remote cluster, when its session validation
	// last came back indeterminate (unreachable, stalled). See markIndeterminateValidation.
	indeterminateValidation map[string]time.Time
	kialiCache              cache.KialiCache
	openshiftOAuth          *business.OpenshiftOAuthService
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
		clientFactory:           clientFactory,
		clusters:                maps.Keys(clientFactory.GetSAClients()),
		conf:                    conf,
		discovery:               discovery,
		indeterminateValidation: make(map[string]time.Time),
		kialiCache:              kialiCache,
		openshiftOAuth:          openshiftOAuthService,
		sessionStore:            store,
	}, nil
}

// Authenticate serves GET /api/authenticate for the openshift strategy. The implicit flow it
// once implemented is gone (login goes through the OAuth code flow at /api/auth/redirect),
// so a GET here is a session check, not a login: a valid session - including one that holds
// remote-cluster tokens - is validated and returned; no session yields a 401; an indeterminate
// validation (for example, an unreachable cluster) is returned as an error rather than being
// mislabeled an authentication failure. POST gets an honest 401: openshift login never
// happens through a form post.
func (o *OpenshiftAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	if r.Method != http.MethodGet {
		return nil, &AuthenticationFailureError{
			Reason: "the implicit flow has been removed; log in via the OAuth authorization code flow",
		}
	}

	sessions, err := o.ValidateSession(r, w)
	if err != nil {
		// Confirmed authentication failures are 401s, not server errors: no session at all,
		// or a session terminated because its token can no longer view any namespace.
		if errors.Is(err, ErrSessionNotFound) {
			return nil, &AuthenticationFailureError{Reason: "no valid session"}
		}
		if errors.Is(err, ErrCannotViewNamespaces) {
			return nil, &AuthenticationFailureError{Reason: "the session's token can no longer view any namespace"}
		}
		if errors.Is(err, ErrNotInAllowlist) {
			return nil, &AuthenticationFailureError{HttpStatus: http.StatusForbidden, Reason: "user is not in the impersonation allowlist", Detail: err}
		}
		if errors.Is(err, ErrImpersonationDenied) {
			return nil, &AuthenticationFailureError{Reason: "impersonation denied", Detail: err}
		}
		// A transient validation problem (for example, an unreachable home cluster) is not
		// an authentication failure; return it as a plain error so the handler answers 500
		// with its message instead of a 401.
		return nil, err
	}

	home := o.conf.KubernetesConfig.ClusterName
	if len(sessions) == 0 || sessions[home] == nil {
		return nil, &AuthenticationFailureError{
			Reason: "no valid session",
		}
	}
	return sessions[home], nil
}

// checkTokenCanViewNamespaces verifies that the given token can view at least one
// namespace on the given cluster, mirroring the OpenID strategy's
// verifyOpenIdUserAccess check. Tokens with zero namespace visibility (e.g.
// ServiceAccount tokens without any RoleBinding) must not get a Kiali session.
// The namespace list is cached per token (CacheTokenNamespaceDuration), so the cost
// of this check on per-request session validation is bounded.
//
// The per-cluster lookup is used, not the aggregate GetNamespaces: the aggregate
// follows picker semantics (a remote cluster whose set cannot be computed is
// skipped, yielding an empty list and no error), which would turn a transient
// remote API failure into "zero namespace visibility" and terminate a valid
// session. This lookup propagates the selected cluster's errors, so callers can
// tell "cannot determine" (the returned error) from "definitively zero access"
// (ErrCannotViewNamespaces).
//
// Zero access is concluded ONLY from a computed-empty accessible set, never from
// the error kind of a failed computation: the set computation lists with the
// Kiali ServiceAccount first, so a Forbidden from it says nothing about the
// user's access, and a user whose namespace LIST is denied can still hold
// per-namespace GET access (the computation falls back to per-namespace GETs).
// A user with no visibility at all produces an empty set, not an error.
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
	nsList, err := namespaceService.GetClusterNamespacesForCluster(ctx, cluster)
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
	url, err := o.openshiftOAuth.AuthCodeURL(r.Context(), verifier, cluster)
	if err != nil {
		log.Errorf("Error getting the AuthCodeURL: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	oAuthConfig, err := o.openshiftOAuth.OAuthConfig(r.Context(), cluster)
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

// indeterminateValidationTTL is how long an indeterminate remote validation verdict is
// trusted before the remote is probed again. The graceful-skip branches in ValidateSession
// already proceed without the remote's validation when the cluster answers indeterminately;
// without this window, every request of every session that includes the remote would re-pay
// the full request timeout (10s by default) to re-learn the same verdict - a per-request
// latency floor on every page for exactly the outage blast radius #10545 exists to bound.
// The window only delays re-validation of a session that is being skipped anyway, and a
// successful validation clears the verdict, so a recovered cluster is picked up on the
// first probe after the window.
const indeterminateValidationTTL = 30 * time.Second

// recentlyIndeterminate reports whether the cluster's session validation came back
// indeterminate within the TTL window and has not been cleared by a success since.
func (o *OpenshiftAuthController) recentlyIndeterminate(cluster string) bool {
	o.indeterminateMu.Lock()
	defer o.indeterminateMu.Unlock()
	at, ok := o.indeterminateValidation[cluster]
	return ok && util.Clock.Now().Sub(at) < indeterminateValidationTTL
}

// markIndeterminateValidation records an indeterminate validation verdict for a remote
// cluster. The verdict is transport-level, not token-level - no token can reach an
// unreachable cluster - so a cluster key cannot mis-skip another user's valid session.
// Only remote clusters are ever marked; the home cluster's validation is mandatory and
// fails loud, so it never produces a verdict to trust.
func (o *OpenshiftAuthController) markIndeterminateValidation(cluster string) {
	o.indeterminateMu.Lock()
	defer o.indeterminateMu.Unlock()
	o.indeterminateValidation[cluster] = util.Clock.Now()
}

// clearIndeterminateValidation drops a recorded verdict after a successful validation so
// the cluster is validated normally again immediately.
func (o *OpenshiftAuthController) clearIndeterminateValidation(cluster string) {
	o.indeterminateMu.Lock()
	defer o.indeterminateMu.Unlock()
	delete(o.indeterminateValidation, cluster)
}

// ValidateSession restores a session previously created by the Authenticate function. The user token (access_token)
// is revalidated by re-fetching user info from the cluster, to ensure that the token hasn't been revoked.
// A remote cluster that answered indeterminately on a recent request is not re-probed until
// indeterminateValidationTTL elapses or it answers again (see markIndeterminateValidation).
// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
func (o *OpenshiftAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (UserSessions, error) {
	userSessions := make(UserSessions)

	// homeUserName and homeUserGroups store the verified identity from the home cluster's
	// GetUserInfo call. Used by the impersonation block below.
	var homeUserName string
	var homeUserGroups []string

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
	// The OAuth redirect can supply a query token. Prefer the authorization header
	// and keep query tokens out of logs.
	queryToken := r.URL.Query().Get("oauth_token")
	token := strings.TrimSpace(queryToken)
	headerToken, hasBearer := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if hasBearer {
		token = headerToken
	}
	if hasBearer || queryToken != "" {
		expires := util.Clock.Now().Add(time.Second * time.Duration(o.conf.LoginToken.ExpirationSeconds))
		user, err := o.openshiftOAuth.GetUserInfo(r.Context(), token, o.conf.KubernetesConfig.ClusterName)
		if k8serrors.IsUnauthorized(err) {
			return nil, errors.Join(ErrSessionNotFound, err)
		}
		if err != nil {
			return nil, err
		}

		// The check runs against the raw token, before the impersonation block below
		// (impersonated sessions no longer carry the user's token).
		if err := o.checkTokenCanViewNamespaces(r.Context(), token, o.conf.KubernetesConfig.ClusterName); err != nil {
			return nil, err
		}

		homeUserName = user.Name
		homeUserGroups = user.Groups
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

		// Sessions are validated concurrently: each may cost a live user-info lookup plus
		// a namespace-visibility check, and several unavailable remotes must not stack
		// serially in front of the home handler (each could consume the full request
		// timeout).
		var sessionsMu sync.Mutex
		// Terminations collected by the validation workers: sessionStore.TerminateSession
		// appends Set-Cookie headers to the shared http.ResponseWriter, which is not
		// safe to touch from multiple goroutines - they are applied serially after the
		// workers finish.
		var terminated []string
		validateOne := func(session *SessionData[openshiftSessionPayload]) error {
			// A cluster skipped at startup (definitively broken registration) gets no user
			// client and no validation: the session's token may be perfectly fine - Kiali
			// itself is the problem. Skip it for this request and preserve the cookie; it is
			// retried if Kiali is restarted with a fixed registration.
			if o.clientFactory.IsClusterSkipped(session.Cluster) {
				log.Debugf("Skipping session for cluster [%s]: the cluster is skipped by Kiali because its registration is broken", session.Cluster)
				return nil
			}
			// An indeterminate verdict from a recent request is still trusted: probing the
			// dead remote again would charge this request the full request timeout to
			// re-learn it. Skipping here is exactly what the branches further down already
			// do with the probe's failure in hand - the session is preserved and retried
			// once the window expires or the cluster answers again.
			if session.Cluster != o.conf.KubernetesConfig.ClusterName && o.recentlyIndeterminate(session.Cluster) {
				log.Debugf("Skipping session validation for cluster [%s]: the cluster was recently unreachable or stalled", session.Cluster)
				return nil
			}
			user, err := o.openshiftOAuth.GetUserInfo(r.Context(), session.Payload.AccessToken, session.Cluster)
			if err != nil {
				if k8serrors.IsUnauthorized(err) {
					// The token is invalid, we should clear the session.
					// This could be an old session for a cluster with the same name.
					log.Debug("Token saved in session is unauthorized to this cluster. This could be an old token from another cluster with an unexpired token. Terminating session...")
					sessionsMu.Lock()
					terminated = append(terminated, session.Cluster)
					sessionsMu.Unlock()
					return nil
				}
				if session.Cluster != o.conf.KubernetesConfig.ClusterName {
					// An indeterminate remote (unreachable, stalled) must not fail the whole
					// request - that would make even home-only pages unusable for any session
					// that includes the remote, which is exactly the outage blast radius
					// #10545 exists to bound. Skip the session for this request and preserve
					// its cookie; it is retried on the next request once the cluster recovers.
					o.markIndeterminateValidation(session.Cluster)
					log.Warningf("Skipping session for cluster [%s]: user info could not be determined: %s", session.Cluster, err)
					return nil
				}
				return err
			}
			// The cluster answered: any recorded indeterminate verdict is stale.
			o.clearIndeterminateValidation(session.Cluster)
			// Re-check namespace visibility on every request: this also terminates
			// pre-existing sessions of users whose access has dropped to zero,
			// instead of letting them ride until expiry. Zero access is only
			// actioned when it is positively established (the accessible set was
			// computed and is empty): a lookup that could not be computed (e.g. a
			// transient API failure on a cold cache) is not a zero-access verdict.
			// For a remote cluster such a failure skips the session for the
			// current request — the same graceful degradation as the
			// unauthorized-token branch above, and the session is retried on the
			// next request once the cluster recovers. Returning the error for a
			// remote cluster would fail the whole request, and for
			// authentication-class errors the middleware would then terminate and
			// revoke every session, including the healthy ones. The home cluster
			// keeps the fail-loud behavior: its session is mandatory, so an
			// indeterminate home lookup fails the request (the middleware does
			// not terminate sessions for non-authentication errors, so a
			// transient home failure does not log the user out).
			if err := o.checkTokenCanViewNamespaces(r.Context(), session.Payload.AccessToken, session.Cluster); err != nil {
				if errors.Is(err, ErrCannotViewNamespaces) {
					log.Debug("Token saved in session cannot view any namespace. Terminating session...")
					sessionsMu.Lock()
					terminated = append(terminated, session.Cluster)
					terminatedZeroAccess = true
					if session.Cluster == o.conf.KubernetesConfig.ClusterName {
						terminatedZeroAccessHome = true
					}
					sessionsMu.Unlock()
					return nil
				}
				if session.Cluster == o.conf.KubernetesConfig.ClusterName {
					return err
				}
				// No auth-level caching here, unlike the user-info branch above: the
				// cluster just answered GetUserInfo, so it is reachable and its recovery
				// should be picked up immediately. The repeated cost of a failing
				// namespace-set computation is bounded by the business layer's own
				// negative backoff (kiali_internal.kubernetes_client.namespace_compute_backoff).
				log.Warningf("Skipping session for cluster [%s]: namespace visibility could not be determined: %s", session.Cluster, err)
				return nil
			}
			sessionsMu.Lock()
			if session.Cluster == o.conf.KubernetesConfig.ClusterName {
				homeUserName = user.Name
				homeUserGroups = user.Groups
			}
			userSessions[session.Cluster] = &UserSessionData{
				AuthInfo:  &api.AuthInfo{Token: session.Payload.AccessToken},
				ExpiresOn: session.ExpiresOn,
				SessionID: session.SessionID,
				Username:  user.Name,
			}
			sessionsMu.Unlock()
			return nil
		}

		var sessionsWg sync.WaitGroup
		var validateErr error
		for _, session := range sessions {
			sessionsWg.Add(1)
			go func(session *SessionData[openshiftSessionPayload]) {
				defer sessionsWg.Done()
				err := validateOne(session)
				sessionsMu.Lock()
				defer sessionsMu.Unlock()
				if err != nil && validateErr == nil {
					validateErr = err
				}
			}(session)
		}
		sessionsWg.Wait()
		if validateErr != nil {
			return nil, validateErr
		}
		for _, cluster := range terminated {
			o.sessionStore.TerminateSession(r, w, cluster)
		}
	}

	// When impersonation is enabled, replace all cluster AuthInfo entries with
	// impersonation-based credentials. The user's real OAuth token was used above
	// to verify identity via GetUserInfo; all subsequent business logic API calls
	// will use the SA token + impersonation headers instead.
	if o.conf.Auth.OpenShift.Impersonation.Enabled {
		if homeSession, ok := userSessions[o.conf.KubernetesConfig.ClusterName]; ok && homeUserName != "" {
			groups := make([]string, 0, len(homeUserGroups)+2)
			groups = append(groups, homeUserGroups...)
			if !slices.Contains(groups, "system:authenticated") {
				groups = append(groups, "system:authenticated")
			}
			if !slices.Contains(groups, "system:authenticated:oauth") {
				groups = append(groups, "system:authenticated:oauth")
			}

			if err := ValidateImpersonationIdentity(homeUserName, groups); err != nil {
				log.Warningf("Impersonation rejected for user %q: %v", homeUserName, err)
				return nil, err
			}

			if len(o.conf.Auth.OpenShift.Impersonation.AllowedUsers) > 0 {
				if !slices.Contains(o.conf.Auth.OpenShift.Impersonation.AllowedUsers, homeUserName) {
					log.Warningf("Impersonation denied: user %q is not in allowed_users list", homeUserName)
					return nil, fmt.Errorf("%w: user %q", ErrNotInAllowlist, homeUserName)
				}
			}

			groups = FilterImpersonationGroups(groups, o.conf.Auth.OpenShift.Impersonation.AllowedGroups, homeUserName)

			for _, cluster := range o.clusters {
				existingSessionID := ""
				if existing, ok := userSessions[cluster]; ok {
					existingSessionID = existing.SessionID
				}
				userSessions[cluster] = &UserSessionData{
					// Token is intentionally empty. The SA token (from the remote cluster
					// secret or in-cluster token file) provides authentication; impersonation
					// headers carry the user identity. The client factory handles this.
					AuthInfo: &api.AuthInfo{
						Impersonate:       homeUserName,
						ImpersonateGroups: groups,
					},
					ExpiresOn: homeSession.ExpiresOn,
					SessionID: existingSessionID,
					Username:  homeUserName,
				}
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
		// A confirmed authentication failure (the sessions that existed were rejected),
		// not a server error: Authenticate maps it to a 401.
		return nil, fmt.Errorf("no valid session found: %w", ErrSessionNotFound)
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
		// A skipped cluster has no SA client, so its remote token cannot be deleted - but
		// the local session must still be cleared: an explicit logout that leaves the
		// cookie behind (or fails with 500 because the skipped session is processed last)
		// keeps the user logged in to a cluster Kiali cannot even reach.
		if o.clientFactory.IsClusterSkipped(session.Cluster) {
			log.Debugf("Clearing local session for skipped cluster [%s]; its remote token cannot be revoked", session.Cluster)
			o.sessionStore.TerminateSession(r, w, session.Cluster)
			continue
		}
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
