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
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/slicetest"
)

func fakeOAuthMetadataServer(t *testing.T) *httptest.Server {
	t.Helper()
	// This is known after we create the server.
	// Probably another way of doing this but this works too.
	addr := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/oauth-authorization-server" {
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
		} else if r.URL.Path == "/oauth/token" {
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
	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	_, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
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
	conf.KubernetesConfig.ClusterName = "test-cluster"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	client := kubetest.NewFakeK8sClient(
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
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
	require.NoError(err)

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
	// Now use the one good cookie and create a malformed one then call validate and ensure that the malformed one gets dropped.
	badCookie := &http.Cookie{
		Name:    authentication.SessionCookieName + "-aes",
		Value:   "badvalue",
		Expires: time.Now().Add(1 * time.Hour),
	}

	r = httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w = httptest.NewRecorder()
	r.AddCookie(badCookie)
	r.AddCookie(sessionCookie)

	_, err = authController.ValidateSession(r, w)
	require.NoError(err)

	cookies = w.Result().Cookies()
	require.Len(cookies, 1)

	badCookie = cookies[0]
	require.True(badCookie.MaxAge < 0, "bad cookie should have been dropped")
}

func TestUnauthorizedUserSessionGetsDropped(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "test-cluster"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	client := kubetest.NewFakeK8sClient(
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

	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
	require.NoError(err)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	// TODO: Test without cluster?
	sessionCookie := validSession(t, authController, conf.KubernetesConfig.ClusterName)

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookie)

	_, err = authController.ValidateSession(r, w)
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
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	eastClient := kubetest.NewFakeK8sClient(
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

	eastClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	westClient := kubetest.NewFakeK8sClient(
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
	westClient.UserFake.PrependReactor("get", "users", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, k8serrors.NewUnauthorized("unauthorized")
	})
	westClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.ClientInterface{
		"east": eastClient,
		"west": westClient,
	}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	authController, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
	require.NoError(err)

	// This is a global var that is accessed in inside of the auth controller.
	util.Clock = util.RealClock{}

	sessionCookieEast := validSession(t, authController, "east")
	sessionCookieWest := validSession(t, authController, "west")

	r := httptest.NewRequest("GET", "/api/some/authenticated/url", nil)
	w := httptest.NewRecorder()
	r.AddCookie(sessionCookieEast)
	r.AddCookie(sessionCookieWest)

	_, err = authController.ValidateSession(r, w)
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
	conf.KubernetesConfig.ClusterName = "east"
	conf.LoginToken.SigningKey = "kiali67890123456"

	metadataServer := fakeOAuthMetadataServer(t)

	sha256Prefix := "sha256~"
	h := sha256.Sum256([]byte(strings.TrimPrefix("abc123", sha256Prefix)))
	oauthTokenName := sha256Prefix + base64.RawURLEncoding.EncodeToString(h[0:])
	eastClient := kubetest.NewFakeK8sClient(
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

	eastClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	westClient := kubetest.NewFakeK8sClient(
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
	westClient.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.ClientInterface{
		"east": eastClient,
		"west": westClient,
	}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)
	authController, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
	require.NoError(err)

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
	err = authController.TerminateSession(r, w)
	require.Error(err)

	cookies := w.Result().Cookies()
	require.Len(cookies, 1)
	require.Equal(cookies[0].MaxAge, -1, fmt.Sprintf("cookie: %s should have been dropped.", cookies[0].Name))
}
