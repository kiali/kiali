package authentication

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
)

// Token built with the debugger at jwt.io. Subject is system:serviceaccount:k8s_user
// {
//  "sub": "jdoe@domain.com",
//  "name": "John Doe",
//  "iat": 1516239022,
//  "nonce": "1ba9b834d08ac81feb34e208402eb18e909be084518c328510940184",
//  "exp": 1311281970
// }

const openIdTestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOjE2MzgzMTY4MDF9.agHBziXM7SDLBKCnA6BvjWenU1n6juL8Fz3go4MSzyw"

/*** Implicit flow tests ***/

func TestOpenIdAuthControllerRejectsImplicitFlow(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewK8SClientMock()
	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != openIdTestToken {
			return nil, errors.New("unexpected token")
		}
		return business.NewWithBackends(k8s, nil, nil), nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.NotNil(t, err)
	assert.Equal(t, err.Error(), "support for OpenID's implicit flow has been removed")

	response := rr.Result()
	assert.Len(t, response.Cookies(), 0)
}

/*** Authorization code flow tests ***/

func TestOpenIdAuthControllerAuthenticatesCorrectlyWithAuthorizationCodeFlow(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewK8SClientMock()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)

	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != openIdTestToken {
			return nil, errors.New("unexpected token")
		}
		return business.NewWithBackends(k8s, nil, nil), nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	//assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Session cookie
	assert.Equal(t, AESSessionCookieName, response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)

	// Redirection to boot the UI
	assert.Equal(t, "/kiali-test/", response.Header.Get("Location"))
}

func TestOpenIdCodeFlowShouldFailWithMissingIdTokenFromOpenIdServer(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"access_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "the IdP did not provide an id_token")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithBadResponseFromTokenEndpoint(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(500)
			_, _ = w.Write([]byte("{ }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "request failed (HTTP response status = 500 Internal Server Error)")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithNonJsonResponse(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("\"id_token\": \"foo\""))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "cannot parse OpenId token response:")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithNonJwtIdToken(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"foo\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "cannot parse received id_token from the OpenId provider")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectMissingAuthorizationCode(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	response := rr.Result()
	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	assert.Len(t, response.Cookies(), 0)

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldFailWithIdTokenWithoutExpiration(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQifQ.ih34Mh3Sao9bnXCjaobfAEO1BnHnuuLBWxihAzwUqw8\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "the received id_token from the OpenId provider has missing the required 'exp' claim")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithIdTokenWithNonNumericExpClaim(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOiJmb28ifQ.wdM3yQPwAXLaqZbVku_fcXpisC3tzES8_UUwjbxSPrc\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "token exp claim is present, but invalid")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectInvalidState(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "badNonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "Request rejected: CSRF mitigation")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectBadStateFormat(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%xp%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "Request rejected: State parameter is invalid")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectMissingState(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	uri := "/api/authenticate?code=f0code"
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	response := rr.Result()
	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	assert.Len(t, response.Cookies(), 0)

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldRejectMissingNonceCookie(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	response := rr.Result()
	assert.Len(t, response.Cookies(), 0)

	// A missing nonce cookie has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldRejectMissingNonceInToken(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTMxMTI4MTk3MH0.xAoq7T-wti__Je1PDuTgNonoVSu059FzpOHsNm26YTg\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "OpenId token rejected: nonce code mismatch")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}
