package authentication

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// Token built with the debugger at jwt.io. Subject is system:serviceaccount:k8s_user
//{
//"sub": "jdoe@domain.com",
//"name": "John Doe",
//"iat": 1516239022,
//"nonce": "1ba9b834d08ac81feb34e208402eb18e909be084518c328510940184",
//"exp": 1311281970
//}
const openIdTestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOjE2MzgzMTY4MDF9.agHBziXM7SDLBKCnA6BvjWenU1n6juL8Fz3go4MSzyw"

/*** Implicit flow tests ***/

func TestOpenIdAuthControllerAuthenticatesCorrectlyWithImplicitFlow(t *testing.T) {
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

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	assert.Equal(t, "jdoe@domain.com", sData.Username)
	assert.Equal(t, openIdTestToken, sData.Token)
	assert.True(t, expectedExpiration.Equal(sData.ExpiresOn))

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Session cookie
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
}

func TestOpenIdImplicitFlowShouldRejectMissingToken(t *testing.T) {
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

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("state=%x-%s", stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "Token is empty or invalid.", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectTokenWithoutExpiration(t *testing.T) {
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

	// same as openIdTestToken but without the "exp" claim
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQifQ.ih34Mh3Sao9bnXCjaobfAEO1BnHnuuLBWxihAzwUqw8"

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "the received id_token from the OpenId provider has missing the required 'exp' claim", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectTokenWithNonNumericExpClaim(t *testing.T) {
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

	// same as openIdTestToken but with the claim exp=foo
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOiJmb28ifQ.wdM3yQPwAXLaqZbVku_fcXpisC3tzES8_UUwjbxSPrc"

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "token exp claim is present, but invalid: the 'exp' claim of the OpenId token has invalid type", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectRequestWithInvalidState(t *testing.T) {
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

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "badNonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "Request rejected: CSRF mitigation", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectRequestWithBadStateFormat(t *testing.T) {
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

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x+%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "Request rejected: State parameter is invalid", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectRequestWithMissingState(t *testing.T) {
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

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s", openIdTestToken))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "State parameter is empty or invalid.", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectRequestWithMissingNonceCookie(t *testing.T) {
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

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "No nonce code present. Login window timed out.", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowShouldRejectRequestWithMissingNonceInToken(t *testing.T) {
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

	// same as openIdTestToken, but without the nonce claim.
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTMxMTI4MTk3MH0.xAoq7T-wti__Je1PDuTgNonoVSu059FzpOHsNm26YTg"

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		return nil, errors.New("business instantiator shouldn't have been called")
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.Equal(t, "OpenId token rejected: nonce code mismatch", err.Error())

	// Check cookies
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowRejectsTokenWithoutDomainIfAllowedDomainsAreConfigured(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.AllowedDomains = []string{
		"foo.com",
	}
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Failf(t, "business instantiator shouldn't have been called", "")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Equal(t, "cannot detect hosted domain on OpenID for the email  ", err.Error())
	assert.Nil(t, sData)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowRejectsTokenWithoutAnAllowedDomainInEmailClaim(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.AllowedDomains = []string{
		"foo.com",
	}
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Same as openIdTestToken, but with an added email=jdoe@domain.com claim
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJlbWFpbCI6Impkb2VAZG9tYWluLmNvbSIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwibm9uY2UiOiIxYmE5YjgzNGQwOGFjODFmZWIzNGUyMDg0MDJlYjE4ZTkwOWJlMDg0NTE4YzMyODUxMDk0MDE4NCIsImV4cCI6MTYzODMxNjgwMX0.8oA-SgrQveJgmzCVOCrAQyQlswYwlWMAuUvGMJ8T748"
	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Failf(t, "business instantiator shouldn't have been called", "")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Equal(t, "domain domain.com not allowed to login", err.Error())
	assert.Nil(t, sData)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowRejectsTokenWithoutAnAllowedDomainInHdClaim(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.AllowedDomains = []string{
		"foo.com",
	}
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Same as openIdTestToken, but with added email=jdoe@foo.com and hd=domail.com claim
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJlbWFpbCI6Impkb2VAZm9vLmNvbSIsImhkIjoiZG9tYWluLmNvbSIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwibm9uY2UiOiIxYmE5YjgzNGQwOGFjODFmZWIzNGUyMDg0MDJlYjE4ZTkwOWJlMDg0NTE4YzMyODUxMDk0MDE4NCIsImV4cCI6MTYzODMxNjgwMX0.LambAMoRezERKTUfZBgCb5h-DEVEW2enQOVxnieG8K4"
	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Failf(t, "business instantiator shouldn't have been called", "")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Equal(t, "domain domain.com not allowed to login", err.Error())
	assert.Nil(t, sData)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
}

func TestOpenIdImplicitFlowAllowsLoginWithAllowedDomainInHdClaim(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.AllowedDomains = []string{
		"domain.com",
	}
	config.Set(cfg)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewK8SClientMock()
	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Same as openIdTestToken, but with added email=jdoe@foo.com and hd=domail.com claim
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJlbWFpbCI6Impkb2VAZm9vLmNvbSIsImhkIjoiZG9tYWluLmNvbSIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwibm9uY2UiOiIxYmE5YjgzNGQwOGFjODFmZWIzNGUyMDg0MDJlYjE4ZTkwOWJlMDg0NTE4YzMyODUxMDk0MDE4NCIsImV4cCI6MTYzODMxNjgwMX0.LambAMoRezERKTUfZBgCb5h-DEVEW2enQOVxnieG8K4"
	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != oidcToken {
			return nil, errors.New("unexpected token")
		}
		return business.NewWithBackends(k8s, nil, nil), nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	assert.Equal(t, "jdoe@domain.com", sData.Username)
	assert.Equal(t, oidcToken, sData.Token)
	assert.True(t, expectedExpiration.Equal(sData.ExpiresOn))

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Session cookie
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
}

func TestOpenIdImplicitFlowAllowsLoginWithAllowedDomainInEmailClaim(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.AllowedDomains = []string{
		"domain.com",
	}
	config.Set(cfg)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewK8SClientMock()
	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Same as openIdTestToken, but with an added email=jdoe@domain.com claim
	oidcToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJlbWFpbCI6Impkb2VAZG9tYWluLmNvbSIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwibm9uY2UiOiIxYmE5YjgzNGQwOGFjODFmZWIzNGUyMDg0MDJlYjE4ZTkwOWJlMDg0NTE4YzMyODUxMDk0MDE4NCIsImV4cCI6MTYzODMxNjgwMX0.8oA-SgrQveJgmzCVOCrAQyQlswYwlWMAuUvGMJ8T748"
	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", oidcToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != oidcToken {
			return nil, errors.New("unexpected token")
		}
		return business.NewWithBackends(k8s, nil, nil), nil
	})

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	assert.Equal(t, "jdoe@domain.com", sData.Username)
	assert.Equal(t, oidcToken, sData.Token)
	assert.True(t, expectedExpiration.Equal(sData.ExpiresOn))

	// Simply check that some cookie is set and has the right expiration. Testing cookie content is left to the session_persistor_test.go
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Session cookie
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
}

/*** Authorization code flow tests ***/

func TestOpenIdAuthControllerAuthenticatesCorrectlyWithAuthorizationCodeFlow(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))

			w.WriteHeader(200)
			w.Write([]byte("{ \"id_token\": \"" + openIdTestToken + "\" }"))
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
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Session cookie
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[1].Name)
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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("{ \"access_token\": \"" + openIdTestToken + "\" }"))
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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(500)
			w.Write([]byte("{ }"))
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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("\"id_token\": \"foo\""))
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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("{ \"id_token\": \"foo\" }"))
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

func TestOpenIdCodeFlowShouldFailWithIdTokenWithoutExpiration(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQifQ.ih34Mh3Sao9bnXCjaobfAEO1BnHnuuLBWxihAzwUqw8\" }"))
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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOiJmb28ifQ.wdM3yQPwAXLaqZbVku_fcXpisC3tzES8_UUwjbxSPrc\" }"))
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

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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
			w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTMxMTI4MTk3MH0.xAoq7T-wti__Je1PDuTgNonoVSu059FzpOHsNm26YTg\" }"))
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

	// nonce cookie cleanup// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
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

	uri := fmt.Sprintf("/api/authenticate?code=f0code")
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

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}
