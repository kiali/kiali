package handlers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
)

// TestStrategyTokenAuthentication checks that a user with no active
// session is logged in successfully
func TestStrategyTokenAuthentication(t *testing.T) {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(16)
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}})
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(mockClientFactory.Clients, cache, cfg)

	authController := authentication.NewTokenAuthController(authentication.NewCookieSessionPersistor(cfg), mockClientFactory, cache, cfg, discovery)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(cfg, authController)(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, authentication.AESSessionCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)
	assert.NotEmpty(t, cookie.Value)
	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

// TestStrategyTokenFails checks that a login attempt is
// rejected if user provides wrong credentials
func TestStrategyTokenFails(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(16)
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}})
	k8s.OpenShift = true
	rejectClient := &rejectClient{k8s}
	mockClientFactory := kubetest.NewK8SClientFactoryMock(rejectClient)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(mockClientFactory.Clients, cache, cfg)

	authController := authentication.NewTokenAuthController(authentication.NewCookieSessionPersistor(cfg), mockClientFactory, cache, cfg, discovery)
	// Send a request
	form := url.Values{}
	form.Add("token", "dummy")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(cfg, authController)(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Len(t, response.Cookies(), 0)
}

// TestLogoutWhenNoSession checks that the Logout handler
// returns a blank response with no cookies being set when the
// user is not logged in.
func TestLogoutWhenNoSession(t *testing.T) {
	request := httptest.NewRequest("GET", "http://kiali/api/logout", nil)
	responseRecorder := httptest.NewRecorder()

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(mockClientFactory.Clients, cache, conf)
	authController := authentication.NewTokenAuthController(authentication.NewCookieSessionPersistor(conf), mockClientFactory, cache, conf, discovery)

	Logout(conf, authController)(responseRecorder, request)

	response := responseRecorder.Result()
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Zero(t, len(response.Cookies()))
}

// TestLogout checks that the Logout handler
// sets a blank cookie to terminate the user's session
func TestLogout(t *testing.T) {
	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest("GET", "http://kiali/api/logout", nil)
	request.AddCookie(&http.Cookie{
		Name:  config.TokenCookieName,
		Value: "foo",
	})

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(mockClientFactory.Clients, cache, conf)
	authController := authentication.NewTokenAuthController(authentication.NewCookieSessionPersistor(conf), mockClientFactory, cache, conf, discovery)

	responseRecorder := httptest.NewRecorder()
	Logout(conf, authController)(responseRecorder, request)

	response := responseRecorder.Result()
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Equal(t, 1, len(response.Cookies()))

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)
	// assert.Equal(t,, http.SameSiteStrictMode, cookie.SameSite) ** Commented out because unsupported in go < 1.11

	assert.Equal(t, "", cookie.Value)
	assert.True(t, cookie.Expires.Before(clockTime))
}

// TestStrategyHeaderOidcAuthentication checks that a user with no active
// session is logged in successfully with an OIDC header
func TestStrategyHeaderOidcAuthentication(t *testing.T) {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(16)
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	k8s := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}})
	k8s.OpenShift = true
	authController := authentication.NewHeaderAuthController(authentication.NewCookieSessionPersistor(cfg), k8s)

	// OIDC Token
	oidcToken := "eyJraWQiOiJDPU15Q291bnRyeSwgU1Q9U3RhdGUgb2YgQ2x1c3RlciwgTD1NeSBDbHVzdGVyLCBPPU15T3JnLCBPVT1LdWJlcm5ldGVzLCBDTj11bmlzb24tc2FtbDItcnAtc2lnLUM9TXlDb3VudHJ5LCBTVD1TdGF0ZSBvZiBDbHVzdGVyLCBMPU15IENsdXN0ZXIsIE89TXlPcmcsIE9VPUt1YmVybmV0ZXMsIENOPXVuaXNvbi1zYW1sMi1ycC1zaWctMTYwOTQ1MjY2NjA1NyIsImFsZyI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2s4c291LmFwcHMuMTkyLTE2OC0yLTE0OC5uaXAuaW8vYXV0aC9pZHAvazhzSWRwIiwiYXVkIjoia3ViZXJuZXRlcyIsImV4cCI6MTYwOTc1ODQzNywianRpIjoiZUFJS2xibllmc1ZSWkNFb1FERHJCUSIsImlhdCI6MTYwOTc1ODM3NywibmJmIjoxNjA5NzU4MjU3LCJzdWIiOiJtbW9zbGV5IiwibmFtZSI6IiBuYSIsImdyb3VwcyI6WyJDTj1rOHNfbG9naW5fY2t1c3Rlcl9hZG1pbnMsQ049VXNlcnMsREM9ZW50MmsxMixEQz1kb21haW4sREM9Y29tIiwiQ049b3VfYXVkaXRvcnMsQ049VXNlcnMsREM9ZW50MmsxMixEQz1kb21haW4sREM9Y29tIiwiQ049UG9ydGFsIFVzZXJzLENOPVVzZXJzLERDPWVudDJrMTIsREM9ZG9tYWluLERDPWNvbSJdLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtbW9zbGV5IiwiZW1haWwiOiJtYXJjKzExMTFAdHJlbW9sby5pbyJ9.psr0VzpvXD9J2mjoumc9IHICFI4v4NWdFKA2plUW4ehXJyjCf96JlBipbtTmvHJwDGeHoR_cFaHqyfY_PQm65_Y6qBk9gF23BPxGBzjz8jug-SwxwF3U9d3XoxGjXNB2HpmG_tawJlUmwyMaTdu8TtDnAUB5hIOMTFNYrgK8SMhbr6tTohT8SXFnrlegSTiKngNEtYiB-wubQIO8laX6QO3OTx_nkd99-mnu2LE9q-S_Yl0dg3KbyrdYBUO1MPlgh0wy3KOOnfrz910LsqbcSrBHwEGeCO65lNinXFdSXuid3OJOt7it1s5jjx0h-5fYHzrfzrmogWPjlMlhkvQHvw"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(cfg, authController)(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	cookie := response.Cookies()[0]
	assert.Equal(t, authentication.AESSessionCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

// TestStrategyHeaderAuthentication checks that a user with no active
// session is logged in successfully with a header that is NOT OIDC
func TestStrategyHeaderAuthentication(t *testing.T) {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(16)
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	k8s := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}})
	k8s.OpenShift = true
	authController := authentication.NewHeaderAuthController(authentication.NewCookieSessionPersistor(cfg), k8s)

	// OIDC Token
	oidcToken := "not_an_oidc_token"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(cfg, authController)(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	cookie := response.Cookies()[0]
	assert.Equal(t, authentication.AESSessionCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

// TestStrategyHeaderOidcWithImpersonationAuthentication checks that a user with no active
// session is logged in successfully with a header that is NOT OIDC
func TestStrategyHeaderOidcWithImpersonationAuthentication(t *testing.T) {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(16)
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	k8s := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}})
	k8s.OpenShift = true
	authController := authentication.NewHeaderAuthController(authentication.NewCookieSessionPersistor(cfg), k8s)

	// OIDC Token
	oidcToken := "eyJhbGciOiJSUzI1NiIsImtpZCI6Imh1MUIyczUxR2xQbjRBWmJTNHNpWjR6VXY0MkZCcUhGM1g0Q3hjY3B4WU0ifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJvcGVudW5pc29uIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Im9wZW51bmlzb24tb3JjaGVzdHJhLXRva2VuLTV4ZmZwIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6Im9wZW51bmlzb24tb3JjaGVzdHJhIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQudWlkIjoiNWU4NTcwMDItMmIwMy00ODUxLTljNDEtOGM5NGRhZTNhZWQzIiwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50Om9wZW51bmlzb246b3BlbnVuaXNvbi1vcmNoZXN0cmEifQ.eXlVuwZYYF85menphWJEHgSVNL8BTnCQfQiuE3QoJCEKO3Mi-xG1psPMxXnFkgeNlRdu30sejyd23_2ccW2b7q7Ss94o_m3ypWVV95ylGLegQOR8-b4mnysA8W9H1xpDsDii6kqc6k0IkJggUhBqImZHjSxbuvexuNuBmp-E_EOTuALIPmfWH3A7_z6dQEYc6sZ6xcmwBFJ-CuTDTpmYO-FvHvmBKVELpgCkEtMTeaXL3Avjg9KrrZ9T6rMcFfeDlMxNj-8KCEFV3QIiZCzULERuGU1WKKfukmb_sgEm5CshOHfC06ah0dyclZq8ctDPRqPVyRTgF5ZGtA_p4U6RsA"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.Header.Set("Impersonate-User", "mmosley")
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(cfg, authController)(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	cookie := response.Cookies()[0]
	assert.Equal(t, authentication.AESSessionCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

type rejectClient struct{ kubernetes.ClientInterface }

func (r *rejectClient) GetProjects(ctx context.Context, labelSelector string) ([]osproject_v1.Project, error) {
	return nil, fmt.Errorf("Rejecting")
}
