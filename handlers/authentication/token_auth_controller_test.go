package authentication

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/api/core/v1"
	k8s_errors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
)

// Token built with the debugger at jwt.io. Subject is system:serviceaccount:k8s_user
const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6azhzX3VzZXIifQ.PYnWgochOQsfMInTpJPul7zkDSyMmJwfvJ6nXowITZk"

func TestTokenAuthControllerAuthenticatesCorrectly(t *testing.T) {
	rr, sData, _, _ := createValidSession(t)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	assert.NotNil(t, sData)
	assert.Equal(t, "k8s_user", sData.Username)
	assert.Equal(t, testToken, sData.AuthInfo.Token)
	assert.Equal(t, expectedExpiration, sData.ExpiresOn)

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	response := rr.Result()
	assert.NotEmpty(t, response.Cookies())
	assert.Equal(t, expectedExpiration, response.Cookies()[0].Expires)
}

func TestTokenAuthControllerRejectsUserWithoutPrivilegesInAnyNamespace(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	config.Set(conf)

	// Returning no namespace when a cluster API call is made should have the result of
	// a rejected authentication.
	k8s := kubetest.NewFakeK8sClient()

	requestBody := strings.NewReader("token=Foo")
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	rr := httptest.NewRecorder()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)
	controller, err := NewTokenAuthController(mockClientFactory, cache, conf, discovery)
	require.NoError(t, err)
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.IsType(t, &AuthenticationFailureError{}, err)
	assert.Contains(t, err.Error(), "privileges")

	// Check no cookies are set
	response := rr.Result()
	assert.Empty(t, response.Cookies())
}

func TestTokenAuthControllerRejectsInvalidToken(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	config.Set(conf)

	// Returning a forbidden error when a cluster API call is made should have the result of
	// a rejected authentication.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(forbiddenClient{k8s})
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)
	controller, err := NewTokenAuthController(mockClientFactory, cache, conf, discovery)
	require.NoError(t, err)

	requestBody := strings.NewReader("token=Foo")
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.IsType(t, &AuthenticationFailureError{}, err)
	assert.Contains(t, err.Error(), "token")

	// Check no cookies are set
	response := rr.Result()
	assert.Empty(t, response.Cookies())
}

func TestTokenAuthControllerRejectsEmptyToken(t *testing.T) {
	requestBody := strings.NewReader("token=")
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	k8s := kubetest.NewFakeK8sClient()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)
	controller, err := NewTokenAuthController(mockClientFactory, cache, conf, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "empty")

	// Check no cookies are set
	response := rr.Result()
	assert.Empty(t, response.Cookies())
}

func TestTokenAuthControllerValidatesSessionCorrectly(t *testing.T) {
	rr, _, _, controller := createValidSession(t)
	response := rr.Result()

	request := httptest.NewRequest(http.MethodGet, "/api/get", nil)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	rr = httptest.NewRecorder()
	sData, err := controller.ValidateSession(request, rr)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	session := sData[config.Get().KubernetesConfig.ClusterName]
	require.NotNil(t, session)
	assert.Equal(t, testToken, session.AuthInfo.Token)
	assert.Equal(t, "k8s_user", session.Username)
	assert.Equal(t, time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC), session.ExpiresOn)
}

func TestTokenAuthControllerValidatesSessionWithoutActiveSession(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	config.Set(conf)
	request := httptest.NewRequest(http.MethodGet, "/api/get", nil)

	k8s := kubetest.NewFakeK8sClient()

	rr := httptest.NewRecorder()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)
	controller, err := NewTokenAuthController(mockClientFactory, cache, conf, discovery)
	require.NoError(err)

	sData, err := controller.ValidateSession(request, rr)
	require.ErrorIs(err, ErrSessionNotFound)
	require.Nil(sData)
}

type forbiddenClient struct {
	kubernetes.UserClientInterface
}

func (f forbiddenClient) GetNamespaces(labelSelector string) ([]v1.Namespace, error) {
	return nil, k8s_errors.NewForbidden(schema.GroupResource{Group: "v1", Resource: "namespaces"}, "", errors.New("err"))
}

func TestTokenAuthControllerDoesNotValidateSessionForUserWithMissingPrivileges(t *testing.T) {
	rr, _, _, controller := createValidSession(t)
	response := rr.Result()

	request := httptest.NewRequest(http.MethodGet, "/api/get", nil)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Empty cache that will miss.
	forbiddenClient := &forbiddenClient{kubetest.NewFakeK8sClient()}

	mockClientFactory := kubetest.NewK8SClientFactoryMock(forbiddenClient)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *config.Get())
	controller.clientFactory = mockClientFactory
	controller.kialiCache = cache

	rr = httptest.NewRecorder()
	sData, err := controller.ValidateSession(request, rr)

	assert.Error(t, err)
	assert.Nil(t, sData)
}

func createValidSession(t *testing.T) (*httptest.ResponseRecorder, *UserSessionData, *kubetest.FakeK8sClient, *tokenAuthController) {
	t.Helper()

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	// conf.KubernetesConfig.ClusterName =
	config.Set(conf)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))

	requestBody := strings.NewReader("token=" + testToken)
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	rr := httptest.NewRecorder()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	controller, err := NewTokenAuthController(mockClientFactory, cache, conf, discovery)
	require.NoError(t, err)

	sData, err := controller.Authenticate(request, rr)
	if err != nil {
		t.Fatal(err)
	}
	return rr, sData, k8s, controller
}
