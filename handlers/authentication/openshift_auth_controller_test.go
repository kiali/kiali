package authentication_test

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	osoauth_v1 "github.com/openshift/api/oauth/v1"
	osuser_v1 "github.com/openshift/api/user/v1"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/slicetest"
)

// fakeNamespace is a namespace object for fake clients. The openshift auth
// controller rejects tokens that cannot view any namespace, so fake clients
// used in positive-path tests must hold at least one namespace.
func fakeNamespace(name string) *corev1.Namespace {
	return &corev1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: name}}
}

// setupOpenshiftAuthController builds an OpenshiftAuthController wired with a
// testing cache and discovery, for tests that exercise session validation.
func setupOpenshiftAuthController(t *testing.T, conf *config.Config, clientFactory *kubetest.K8SClientFactoryMock) *authentication.OpenshiftAuthController {
	t.Helper()
	kialiCache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clientFactory.Clients), kialiCache, conf)
	controller, err := authentication.NewOpenshiftAuthController(conf, clientFactory, kialiCache, discovery)
	require.NoError(t, err)
	return controller
}

func fakeOAuthMetadataServer(t *testing.T) *httptest.Server {
	t.Helper()
	// This is known after we create the server.
	// Probably another way of doing this but this works too.
	addr := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			oAuthResponse := &business.OAuthAuthorizationServer{
				AuthorizationEndpoint: addr + "/oauth/authorize",
				Issuer:                addr,
				TokenEndpoint:         addr + "/oauth/token",
			}
			b, err := json.Marshal(oAuthResponse)
			if err != nil {
				panic("unable to marshal json response for fake oAuthMetadataServer")
			}
			_, _ = w.Write(b)
		case "/oauth/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token": "abc123", "expires_in": 3600, "token_type": "Bearer"}`))
		}
	}))
	addr = server.URL
	t.Cleanup(server.Close)
	return server
}

func TestNewOpenshiftAuthService(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	oAuthClient := &osoauth_v1.OAuthClient{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "kiali-istio-system",
		},
		RedirectURIs: []string{"http://localhost:20001/kiali"},
	}

	metadataServer := fakeOAuthMetadataServer(t)
	client := kubetest.NewFakeK8sClient(oAuthClient)
	client.OpenShift = true
	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	_, err := authentication.NewOpenshiftAuthController(conf, clientFactory, cache.NewTestingCacheWithFactory(t, clientFactory, *conf), nil)
	require.NoError(err)
}

func validSession(t *testing.T, authController *authentication.OpenshiftAuthController, cluster string) *http.Cookie {
	t.Helper()
	require := require.New(t)
	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	// Handlers use the mux methods to pull vars from the request so these need to be included in testing.
	router := mux.NewRouter()
	// First get nonce.
	w := httptest.NewRecorder()
	redirectURL := fmt.Sprintf("/api/auth/redirect/%s", cluster)
	r := httptest.NewRequest("GET", redirectURL, nil)
	router.Methods("GET").Path("/api/auth/redirect/{cluster}").HandlerFunc(authController.OpenshiftAuthRedirect)
	router.ServeHTTP(w, r)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)
	nonce := cookies[0]

	w = httptest.NewRecorder()
	form := url.Values{}
	form.Add("code", "anycode")
	callbackURL := fmt.Sprintf("/api/auth/callback/%s", cluster)
	r = httptest.NewRequest("POST", callbackURL, strings.NewReader(form.Encode()))
	r.AddCookie(nonce)
	r.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	router.Methods("POST").Path("/api/auth/callback/{cluster}").HandlerFunc(authController.OpenshiftAuthCallback)
	router.ServeHTTP(w, r)

	cookies = w.Result().Cookies()
	require.Len(cookies, 2)
	sessionCookie := slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return c.Name == authentication.SessionCookieName+"-"+cluster
	})
	nonceCookie := slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return c.Name == fmt.Sprintf("%s-nonce-%s", authentication.SessionCookieName, cluster)
	})
	// TODO: Should this assertion be here or in another test?
	require.True(nonceCookie.MaxAge < 0, "nonce cookie should have been dropped")

	return sessionCookie
}

func TestOpenshiftAuthController(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "test-cluster"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	client := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	)
	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	client.OpenShift = true
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	// First get nonce.
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/auth/redirect", nil)
	authController.OpenshiftAuthRedirect(w, r)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)
	nonce := cookies[0]

	w = httptest.NewRecorder()
	form := url.Values{}
	form.Add("code", "anycode")
	r = httptest.NewRequest("POST", "/api/auth/callback", strings.NewReader(form.Encode()))
	r.AddCookie(nonce)
	r.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	authController.OpenshiftAuthCallback(w, r)

	cookies = w.Result().Cookies()
	require.Len(cookies, 2)
	sessionCookie := slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return strings.HasPrefix(c.Name, authentication.SessionCookieName) && !strings.Contains(c.Name, "nonce")
	})
	nonceCookie := slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return strings.Contains(c.Name, "nonce")
	})
	require.True(nonceCookie.MaxAge < 0, "nonce cookie should have been dropped")
	// Need to make sure that one is the session and one is the dropped nonce.
	// Now use the one good cookie and create a malformed one then call validate.
	// Note: The malformed cookie will be ignored (not returned as a valid session)
	// but NOT actively dropped. This is intentional because we cannot distinguish
	// between a malformed cookie and a valid chunk cookie - dropping cookies that
	// fail to decrypt would corrupt chunked sessions.
	// See: https://github.com/kiali/kiali/issues/8990
	badCookie := &http.Cookie{
		Name:    authentication.SessionCookieName + "-malformed",
		Value:   "badvalue",
		Expires: time.Now().Add(1 * time.Hour),
	}

	r = httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w = httptest.NewRecorder()
	r.AddCookie(badCookie)
	r.AddCookie(sessionCookie)

	_, err := authController.ValidateSession(r, w)
	require.NoError(err)

	// Malformed cookies are no longer dropped in ReadAllSessions to avoid
	// corrupting chunked sessions. The malformed cookie is simply ignored.
	cookies = w.Result().Cookies()
	require.Len(cookies, 0, "no cookies should be dropped; malformed cookies are ignored, not dropped")
}

func TestUnauthorizedUserSessionGetsDropped(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "test-cluster"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	client := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	)
	client.UserFake.PrependReactor("get", "users", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, k8serrors.NewUnauthorized("unauthorized")
	})
	client.OpenShift = true

	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	// TODO: Test without cluster?
	sessionCookie := validSession(t, authController, conf.KubernetesConfig.ClusterName)

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookie)

	_, err := authController.ValidateSession(r, w)
	require.Error(err)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)

	sessionCookie = cookies[0]
	require.True(sessionCookie.MaxAge < 0, "bad cookie should have been dropped")
}

// Multicluster.
func TestMulticlusterUnauthorizedUserSessionGetsDropped(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	eastClient := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	)
	eastClient.OpenShift = true

	eastClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	westClient := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	)
	westClient.OpenShift = true
	westClient.UserFake.PrependReactor("get", "users", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, k8serrors.NewUnauthorized("unauthorized")
	})
	westClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.UserClientInterface{
		"east": eastClient,
		"west": westClient,
	}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	sessionCookieEast := validSession(t, authController, "east")
	sessionCookieWest := validSession(t, authController, "west")

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookieEast)
	r.AddCookie(sessionCookieWest)

	_, err := authController.ValidateSession(r, w)
	require.NoError(err)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)

	sessionCookieWest = slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return c.Name == authentication.SessionCookieName+"-west"
	})

	require.True(sessionCookieWest.MaxAge < 0, "west session should be dropped")
}

func TestTerminateSession(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	sha256Prefix := "sha256~"
	h := sha256.Sum256([]byte(strings.TrimPrefix("abc123", sha256Prefix)))
	oauthTokenName := sha256Prefix + base64.RawURLEncoding.EncodeToString(h[0:])
	eastClient := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
		&osoauth_v1.OAuthAccessToken{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: oauthTokenName,
			},
		},
	)
	eastClient.OpenShift = true

	eastClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	westClient := kubetest.NewFakeK8sClient(
		fakeNamespace("bookinfo"),
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	)
	westClient.OpenShift = true
	westClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.UserClientInterface{
		"east": eastClient,
		"west": westClient,
	}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)
	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	sessionCookieEast := validSession(t, authController, "east")
	sessionCookieWest := validSession(t, authController, "west")

	westClient.OAuthFake.PrependReactor("delete", "oauthaccesstokens", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, k8serrors.NewUnauthorized("unauthorized")
	})

	r := httptest.NewRequest("GET", "/api/logout", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookieEast)
	r.AddCookie(sessionCookieWest)

	// Should result in an error and also a dropped session.
	err := authController.TerminateSession(r, w)
	require.Error(err)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)
	require.Equal(cookies[0].MaxAge, -1, fmt.Sprintf("cookie: %s should have been dropped.", cookies[0].Name))
}

// newOpenshiftAuthTestClient builds a fake OpenShift client for the zero-access
// tests. When withNamespace is true the client holds a namespace the user can
// view; otherwise the token authenticates (GetUserInfo succeeds via the "~"
// user) but the user cannot view any namespace.
func newOpenshiftAuthTestClient(t *testing.T, metadataServer *httptest.Server, withNamespace bool) *kubetest.FakeK8sClient {
	t.Helper()
	objects := []runtime.Object{
		&osoauth_v1.OAuthClient{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "kiali-istio-system",
			},
			RedirectURIs: []string{"http://localhost:20001/kiali"},
		},
		&osuser_v1.User{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "~", // tilde means user for this token
			},
		},
	}
	if withNamespace {
		objects = append(objects, fakeNamespace("bookinfo"))
	}
	client := kubetest.NewFakeK8sClient(objects...)
	client.OpenShift = true
	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	return client
}

func TestValidateSessionBearerTokenZeroNamespaceAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)
	client := newOpenshiftAuthTestClient(t, metadataServer, false)
	clients := map[string]kubernetes.UserClientInterface{"east": client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	r := httptest.NewRequest("GET", "/api/namespaces", nil)
	r.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()

	_, err := authController.ValidateSession(r, w)
	require.Error(err)
	require.ErrorIs(err, authentication.ErrCannotViewNamespaces)
}

func TestValidateSessionOauthTokenParamZeroNamespaceAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)
	client := newOpenshiftAuthTestClient(t, metadataServer, false)
	clients := map[string]kubernetes.UserClientInterface{"east": client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	// The oauth_token URL parameter is a separate copy of the bearer-token
	// validation inside ValidateSession, not a funnel into it: it needs its
	// own test so a future refactor cannot patch one branch and miss the other.
	r := httptest.NewRequest("GET", "/api/namespaces?oauth_token=test-token", nil)
	w := httptest.NewRecorder()

	_, err := authController.ValidateSession(r, w)
	require.Error(err)
	require.ErrorIs(err, authentication.ErrCannotViewNamespaces)
}

func TestValidateSessionCookieSessionZeroNamespaceAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	// A client with namespace access creates the session...
	withAccessClient := newOpenshiftAuthTestClient(t, metadataServer, true)
	withAccessClient.Token = "with-access"
	clients := map[string]kubernetes.UserClientInterface{"east": withAccessClient}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	sessionCookie := validSession(t, authController, "east")

	// ...then the user's access drops to zero (e.g. RoleBindings removed): the
	// token still authenticates but can no longer view any namespace.
	zeroAccessClient := newOpenshiftAuthTestClient(t, metadataServer, false)
	zeroAccessClient.Token = "zero-access"
	clientFactory.SetClients(map[string]kubernetes.UserClientInterface{"east": zeroAccessClient})

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookie)

	_, err := authController.ValidateSession(r, w)
	require.Error(err)
	require.ErrorIs(err, authentication.ErrCannotViewNamespaces)

	// The zero-access session must be terminated, not ride until expiry.
	cookies := w.Result().Cookies()
	dropped := slicetest.FindOrFail(t, cookies, func(c *http.Cookie) bool {
		return c.Name == authentication.SessionCookieName+"-east"
	})
	require.True(dropped.MaxAge < 0, "zero-access session should have been dropped")
}

func TestValidateSessionBearerTokenWithAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)
	client := newOpenshiftAuthTestClient(t, metadataServer, true)
	clients := map[string]kubernetes.UserClientInterface{"east": client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	r := httptest.NewRequest("GET", "/api/namespaces", nil)
	r.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()

	sessions, err := authController.ValidateSession(r, w)
	require.NoError(err)
	require.Len(sessions, 1)
	require.Equal("test-token", sessions["east"].AuthInfo.Token)
}

func TestOpenshiftAuthCallbackZeroNamespaceAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)
	client := newOpenshiftAuthTestClient(t, metadataServer, false)
	clients := map[string]kubernetes.UserClientInterface{"east": client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	// First get the nonce, then complete the OAuth code flow. The code exchange
	// succeeds (the fake OAuth server always returns a token), but the token
	// cannot view any namespace: the login must be rejected and no session
	// created. Note the check lives in OpenshiftAuthCallback, not Authenticate
	// (the latter is dead code that always errors).
	router := mux.NewRouter()
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/auth/redirect/east", nil)
	router.Methods("GET").Path("/api/auth/redirect/{cluster}").HandlerFunc(authController.OpenshiftAuthRedirect)
	router.ServeHTTP(w, r)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)
	nonce := cookies[0]

	w = httptest.NewRecorder()
	form := url.Values{}
	form.Add("code", "anycode")
	r = httptest.NewRequest("POST", "/api/auth/callback/east", strings.NewReader(form.Encode()))
	r.AddCookie(nonce)
	r.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	router.Methods("POST").Path("/api/auth/callback/{cluster}").HandlerFunc(authController.OpenshiftAuthCallback)
	router.ServeHTTP(w, r)

	result := w.Result()
	require.Equal(http.StatusFound, result.StatusCode)

	location, err := url.Parse(result.Header.Get("Location"))
	require.NoError(err)
	require.Contains(location.Query().Get("openshift_error"), "Cannot view any namespaces")

	// No session cookie must have been created.
	for _, c := range result.Cookies() {
		require.NotEqual(authentication.SessionCookieName+"-east", c.Name,
			"no session should be created for a zero-access user")
	}
}

// TestValidateSessionMulticlusterPartialZeroAccess ensures that losing namespace
// access on ONE cluster only terminates that cluster's session: the request must
// still succeed with the healthy sessions instead of failing (which would make
// the authentication middleware terminate and revoke every session, logging the
// user out of the entire multi-cluster setup).
func TestValidateSessionMulticlusterPartialZeroAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	eastClient := newOpenshiftAuthTestClient(t, metadataServer, true)
	eastClient.Token = "east-user"
	westClient := newOpenshiftAuthTestClient(t, metadataServer, true)
	westClient.Token = "west-user"
	clients := map[string]kubernetes.UserClientInterface{"east": eastClient, "west": westClient}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	sessionCookieEast := validSession(t, authController, "east")
	sessionCookieWest := validSession(t, authController, "west")

	// The user's access on the west cluster drops to zero (e.g. RoleBindings
	// removed): the token still authenticates but can no longer view any
	// namespace there. The east session stays healthy.
	zeroAccessWest := newOpenshiftAuthTestClient(t, metadataServer, false)
	zeroAccessWest.Token = "west-zero-access"
	clientFactory.SetClients(map[string]kubernetes.UserClientInterface{
		"east": eastClient,
		"west": zeroAccessWest,
	})

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookieEast)
	r.AddCookie(sessionCookieWest)

	sessions, err := authController.ValidateSession(r, w)
	require.NoError(err, "the request must succeed with the healthy east session")
	require.Len(sessions, 1)
	require.NotNil(sessions["east"])
	require.Nil(sessions["west"])

	// Only the west session cookie must have been dropped.
	for _, c := range w.Result().Cookies() {
		if c.Name == authentication.SessionCookieName+"-west" {
			require.True(c.MaxAge < 0, "zero-access west session should have been dropped")
		}
		require.NotEqual(authentication.SessionCookieName+"-east", c.Name,
			"the healthy east session must not be dropped")
	}
}

// TestValidateSessionMulticlusterHomeZeroAccess ensures that losing namespace
// access on the mandatory HOME cluster is reported as an authentication failure
// (401) rather than a persistent HTTP 500: the request fails with the specific
// zero-access reason, and a follow-up request carrying only the healthy remote
// cookie is also rejected as an authentication error instead of 500ing forever.
func TestValidateSessionMulticlusterHomeZeroAccess(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenshift
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	eastClient := newOpenshiftAuthTestClient(t, metadataServer, true)
	eastClient.Token = "east-user"
	westClient := newOpenshiftAuthTestClient(t, metadataServer, true)
	westClient.Token = "west-user"
	clients := map[string]kubernetes.UserClientInterface{"east": eastClient, "west": westClient}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController := setupOpenshiftAuthController(t, conf, clientFactory)

	util.Clock = util.RealClock{}

	sessionCookieEast := validSession(t, authController, "east")
	sessionCookieWest := validSession(t, authController, "west")

	// The user's access on the HOME cluster (east) drops to zero; the remote
	// west session stays healthy.
	zeroAccessEast := newOpenshiftAuthTestClient(t, metadataServer, false)
	zeroAccessEast.Token = "east-zero-access"
	clientFactory.SetClients(map[string]kubernetes.UserClientInterface{
		"east": zeroAccessEast,
		"west": westClient,
	})

	// First request (both cookies): the home session is terminated for zero
	// access; the request must fail with the 401-mapped zero-access reason, not
	// a generic "no valid session found for home cluster" 500.
	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookieEast)
	r.AddCookie(sessionCookieWest)

	_, err := authController.ValidateSession(r, w)
	require.Error(err)
	require.ErrorIs(err, authentication.ErrCannotViewNamespaces)

	// The east session cookie must have been dropped; the west cookie must not.
	for _, c := range w.Result().Cookies() {
		if c.Name == authentication.SessionCookieName+"-east" {
			require.True(c.MaxAge < 0, "zero-access home session should have been dropped")
		}
		require.NotEqual(authentication.SessionCookieName+"-west", c.Name,
			"the healthy remote session must not be dropped by this branch")
	}

	// Follow-up request carrying only the remote cookie: the home session is
	// simply absent, and the mandatory home-cluster check must reject the
	// request as an authentication error (401 class), not a persistent 500.
	r = httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w = httptest.NewRecorder()
	r.AddCookie(sessionCookieWest)

	_, err = authController.ValidateSession(r, w)
	require.Error(err)
	require.ErrorIs(err, authentication.ErrSessionNotFound)
}
