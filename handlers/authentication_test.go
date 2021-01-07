package handlers

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

type dummyHandler struct {
}

func (t dummyHandler) ServeHTTP(http.ResponseWriter, *http.Request) {}

// TestStrategyTokenAuthentication checks that a user with no active
// session is logged in successfully
func TestStrategyTokenAuthentication(t *testing.T) {
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(10)
	cfg.KubernetesConfig.CacheEnabled = false
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Mock K8S API to accept credentials
	mockK8s(false)

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.PostForm = form

	// Add a stale token to the request. Authentication should succeed even if a stale
	// session is present. This prevents the user form manually clean browser cookies.
	currentToken, _ := config.GenerateToken("dummy")
	oldCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: currentToken.Token,
	}
	request.AddCookie(&oldCookie)

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	// Build the token that we known we should receive
	newToken, _ := config.GetSignedTokenString(config.IanaClaims{
		SessionId: "foo",
		StandardClaims: jwt.StandardClaims{
			Subject:   "token",
			ExpiresAt: clockTime.Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds)).Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	})

	assert.Equal(t, cookie.Value, newToken)
	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

// TestStrategyTokenInvalidSignature checks that an altered JWT token is
// rejected as a valid authentication
func TestStrategyTokenInvalidSignature(t *testing.T) {
	// Set some config values to a known state
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(10)
	config.Set(cfg)

	// Mock the clock
	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}
	jwt.TimeFunc = func() time.Time {
		return util.Clock.Now()
	}

	// First generate a "valid" token.
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(cfg.LoginToken.ExpirationSeconds))
	tokenClaims := config.IanaClaims{
		SessionId: "dummy",
		StandardClaims: jwt.StandardClaims{
			Subject:   "dummy",
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}

	// This `tokenString` should be valid for Kiali server because we generated
	// it using the right functions. It's also already signed.
	tokenString, _ := config.GetSignedTokenString(tokenClaims)

	// Let's create a hacked token with a mutated payload. The header and signature of the
	// token will be kept unchanged.

	// Build custom claims
	timeExpire = util.Clock.Now().Add(time.Second * time.Duration(60)) // 1 minute expiration from now
	customClaims := config.IanaClaims{
		SessionId: "dummy",
		StandardClaims: jwt.StandardClaims{
			Subject:   "dummy",
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}

	// Get JSON string of our customized claims
	jsonValue, err := json.Marshal(customClaims)
	assert.Nil(t, err)

	// Hack the token.
	tokenEntries := strings.Split(tokenString, ".")
	tokenEntries[1] = jwt.EncodeSegment(jsonValue) // Second entry is the payload
	tokenString = strings.Join(tokenEntries, ".")

	// Now that we have a "hacked" token with a new expiration date, lets
	// use it to invoke the authentication handler (which is invoked on all protected endpoints).

	// Build the request with the cookie
	maliciousRequest := httptest.NewRequest("GET", "http://kiali/api/foo", nil)
	hackedCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: tokenString,
	}
	maliciousRequest.AddCookie(&hackedCookie)

	// Setup authentication handler
	authenticationHandler, _ := NewAuthenticationHandler()
	handler := authenticationHandler.Handle(new(dummyHandler))

	// Run the malicious request
	maliciousResponseRecorder := httptest.NewRecorder()
	handler.ServeHTTP(maliciousResponseRecorder, maliciousRequest)
	hackedResponse := maliciousResponseRecorder.Result()

	// Server should return an unauthorized response code.
	// Body should be the text explanation of the HTTP error
	body, _ := ioutil.ReadAll(hackedResponse.Body)
	assert.Equal(t, http.StatusUnauthorized, hackedResponse.StatusCode)
	assert.Equal(t, fmt.Sprintln(http.StatusText(http.StatusUnauthorized)), string(body))
}

// TestStrategyTokenValidatesExpiration checks that the Kiali back-end is
// correctly checking the expiration time of the Kiali token.
//
// Assuming that a malicious user has stolen the Kiali token of a user,
// that user may use it to make requests to the Kiali API. The expiration
// date of the token and the browser's cookie should be in sync. But a malicious
// user may want to create his own cookie and use with the stolen token. Because
// of this, the Kiali backend must check the expiration Claim of the JWT token.
func TestStrategyTokenValidatesExpiration(t *testing.T) {
	// Set some config values to a known state
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(10)
	config.Set(cfg)

	// Mock the clock
	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}
	jwt.TimeFunc = func() time.Time {
		return util.Clock.Now()
	}

	// Let's create a valid but expired token.
	timeExpire := util.Clock.Now().Add(-time.Second * time.Duration(1)) // Expiration time is one second in the past
	customClaims := config.IanaClaims{
		SessionId: "dummy",
		StandardClaims: jwt.StandardClaims{
			Subject:   "foo",
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}

	token, _ := config.GetSignedTokenString(customClaims)

	// Let's simulate a request with the expired token
	request := httptest.NewRequest("GET", "http://kiali/api/foo", nil)
	cookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: token,
	}
	request.AddCookie(&cookie)

	authenticationHandler, _ := NewAuthenticationHandler()
	handler := authenticationHandler.Handle(new(dummyHandler))

	responseRecorder := httptest.NewRecorder()
	handler.ServeHTTP(responseRecorder, request)
	response := responseRecorder.Result()

	// Server should return an unauthorized response code.
	// Body should be the text explanation of the HTTP error
	body, _ := ioutil.ReadAll(response.Body)
	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Equal(t, fmt.Sprintln(http.StatusText(http.StatusUnauthorized)), string(body))
}

// TestStrategyTokenMissingUser checks that the Kiali back-end is ensuring
// that the username field is populated in the Kiali auth token.
func TestStrategyTokenMissingUser(t *testing.T) {
	// Set some config values to a known state
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.KubernetesConfig.CacheEnabled = false
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(10)
	config.Set(cfg)
	mockK8s(false)

	// Mock the clock
	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}
	jwt.TimeFunc = func() time.Time {
		return util.Clock.Now()
	}

	// Let's create a valid token without SessionId.
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(1))
	customClaims := config.IanaClaims{
		StandardClaims: jwt.StandardClaims{
			Subject:   "foo",
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}

	token, _ := config.GetSignedTokenString(customClaims)

	// Let's simulate a request
	request := httptest.NewRequest("GET", "http://kiali/api/foo", nil)
	cookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: token,
	}
	request.AddCookie(&cookie)

	authenticationHandler, _ := NewAuthenticationHandler()
	handler := authenticationHandler.Handle(new(dummyHandler))

	responseRecorder := httptest.NewRecorder()
	handler.ServeHTTP(responseRecorder, request)
	response := responseRecorder.Result()

	// Server should return an unauthorized response code.
	// Body should be the text explanation of the HTTP error
	body, _ := ioutil.ReadAll(response.Body)
	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Equal(t, fmt.Sprintln(http.StatusText(http.StatusUnauthorized)), string(body))
}

// TestStrategyTokenMissingExpiration checks that the Kiali back-end is ensuring
// that the expiration date claim is populated in the Kiali auth token.
func TestStrategyTokenMissingExpiration(t *testing.T) {
	// Set some config values to a known state
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyToken
	cfg.LoginToken.SigningKey = util.RandomString(10)
	config.Set(cfg)

	// Let's create a valid token that does not expire.
	customClaims := config.IanaClaims{
		StandardClaims: jwt.StandardClaims{
			Subject: "foo",
			// ExpiresAt: timeExpire.Unix(),
			Issuer: config.AuthStrategyTokenIssuer,
		},
	}

	token, _ := config.GetSignedTokenString(customClaims)

	// Let's simulate a request
	request := httptest.NewRequest("GET", "http://kiali/api/foo", nil)
	cookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: token,
	}
	request.AddCookie(&cookie)

	authenticationHandler, _ := NewAuthenticationHandler()
	handler := authenticationHandler.Handle(new(dummyHandler))

	responseRecorder := httptest.NewRecorder()
	handler.ServeHTTP(responseRecorder, request)
	response := responseRecorder.Result()

	// Server should return an unauthorized response code.
	// Body should be the text explanation of the HTTP error
	body, _ := ioutil.ReadAll(response.Body)
	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Equal(t, fmt.Sprintln(http.StatusText(http.StatusUnauthorized)), string(body))
}

// TestStrategyTokenFails checks that a login attempt is
// rejected if user provides wrong credentials
func TestStrategyTokenFails(t *testing.T) {
	cfg := config.NewConfig()
	cfg.KubernetesConfig.CacheEnabled = false
	cfg.Auth.Strategy = config.AuthStrategyToken
	config.Set(cfg)

	// Mock k8s API to reject authentication
	mockK8s(true)

	// Send a request
	form := url.Values{}
	form.Add("token", "dummy")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.PostForm = form

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
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
	Logout(responseRecorder, request)

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

	responseRecorder := httptest.NewRecorder()
	Logout(responseRecorder, request)

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
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(10)
	cfg.KubernetesConfig.CacheEnabled = false
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Mock K8S API to accept credentials
	mockK8s(false)

	// OIDC Token
	oidcToken := "eyJraWQiOiJDPU15Q291bnRyeSwgU1Q9U3RhdGUgb2YgQ2x1c3RlciwgTD1NeSBDbHVzdGVyLCBPPU15T3JnLCBPVT1LdWJlcm5ldGVzLCBDTj11bmlzb24tc2FtbDItcnAtc2lnLUM9TXlDb3VudHJ5LCBTVD1TdGF0ZSBvZiBDbHVzdGVyLCBMPU15IENsdXN0ZXIsIE89TXlPcmcsIE9VPUt1YmVybmV0ZXMsIENOPXVuaXNvbi1zYW1sMi1ycC1zaWctMTYwOTQ1MjY2NjA1NyIsImFsZyI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2s4c291LmFwcHMuMTkyLTE2OC0yLTE0OC5uaXAuaW8vYXV0aC9pZHAvazhzSWRwIiwiYXVkIjoia3ViZXJuZXRlcyIsImV4cCI6MTYwOTc1ODQzNywianRpIjoiZUFJS2xibllmc1ZSWkNFb1FERHJCUSIsImlhdCI6MTYwOTc1ODM3NywibmJmIjoxNjA5NzU4MjU3LCJzdWIiOiJtbW9zbGV5IiwibmFtZSI6IiBuYSIsImdyb3VwcyI6WyJDTj1rOHNfbG9naW5fY2t1c3Rlcl9hZG1pbnMsQ049VXNlcnMsREM9ZW50MmsxMixEQz1kb21haW4sREM9Y29tIiwiQ049b3VfYXVkaXRvcnMsQ049VXNlcnMsREM9ZW50MmsxMixEQz1kb21haW4sREM9Y29tIiwiQ049UG9ydGFsIFVzZXJzLENOPVVzZXJzLERDPWVudDJrMTIsREM9ZG9tYWluLERDPWNvbSJdLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtbW9zbGV5IiwiZW1haWwiOiJtYXJjKzExMTFAdHJlbW9sby5pbyJ9.psr0VzpvXD9J2mjoumc9IHICFI4v4NWdFKA2plUW4ehXJyjCf96JlBipbtTmvHJwDGeHoR_cFaHqyfY_PQm65_Y6qBk9gF23BPxGBzjz8jug-SwxwF3U9d3XoxGjXNB2HpmG_tawJlUmwyMaTdu8TtDnAUB5hIOMTFNYrgK8SMhbr6tTohT8SXFnrlegSTiKngNEtYiB-wubQIO8laX6QO3OTx_nkd99-mnu2LE9q-S_Yl0dg3KbyrdYBUO1MPlgh0wy3KOOnfrz910LsqbcSrBHwEGeCO65lNinXFdSXuid3OJOt7it1s5jjx0h-5fYHzrfzrmogWPjlMlhkvQHvw"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.PostForm = form

	// Add a stale token to the request. Authentication should succeed even if a stale
	// session is present. This prevents the user form manually clean browser cookies.
	currentToken, _ := config.GenerateToken("dummy")
	oldCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: currentToken.Token,
	}
	request.AddCookie(&oldCookie)

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)

	fromCookie, _, err := new(jwt.Parser).ParseUnverified(cookie.Value, &config.IanaClaims{})
	if err != nil {
		assert.FailNow(t, err.Error())
	}

	claimFromCookie := fromCookie.Claims.(*config.IanaClaims)

	assert.Equal(t, "mmosley", claimFromCookie.Subject)
	assert.Equal(t, config.AuthStrategyHeaderIssuer, claimFromCookie.Issuer)
	assert.True(t, IsValidUUID(claimFromCookie.SessionId))
}

// TestStrategyHeaderAuthentication checks that a user with no active
// session is logged in successfully with a header that is NOT OIDC
func TestStrategyHeaderAuthentication(t *testing.T) {
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(10)
	cfg.KubernetesConfig.CacheEnabled = false
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Mock K8S API to accept credentials
	mockK8s(false)

	// OIDC Token
	oidcToken := "not_an_oidc_token"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.PostForm = form

	// Add a stale token to the request. Authentication should succeed even if a stale
	// session is present. This prevents the user form manually clean browser cookies.
	currentToken, _ := config.GenerateToken("dummy")
	oldCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: currentToken.Token,
	}
	request.AddCookie(&oldCookie)

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)

	fromCookie, _, err := new(jwt.Parser).ParseUnverified(cookie.Value, &config.IanaClaims{})
	if err != nil {
		assert.FailNow(t, err.Error())
	}

	claimFromCookie := fromCookie.Claims.(*config.IanaClaims)

	assert.Equal(t, "not_an_oidc_token", claimFromCookie.Subject)
	assert.Equal(t, config.AuthStrategyHeaderIssuer, claimFromCookie.Issuer)
	assert.True(t, IsValidUUID(claimFromCookie.SessionId))
}

// TestStrategyHeaderOidcWithImpersonationAuthentication checks that a user with no active
// session is logged in successfully with a header that is NOT OIDC
func TestStrategyHeaderOidcWithImpersonationAuthentication(t *testing.T) {
	rand.Seed(time.Now().UnixNano())
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyHeader
	cfg.LoginToken.SigningKey = util.RandomString(10)
	cfg.KubernetesConfig.CacheEnabled = false
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Mock K8S API to accept credentials
	mockK8s(false)

	// OIDC Token
	oidcToken := "eyJhbGciOiJSUzI1NiIsImtpZCI6Imh1MUIyczUxR2xQbjRBWmJTNHNpWjR6VXY0MkZCcUhGM1g0Q3hjY3B4WU0ifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJvcGVudW5pc29uIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Im9wZW51bmlzb24tb3JjaGVzdHJhLXRva2VuLTV4ZmZwIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6Im9wZW51bmlzb24tb3JjaGVzdHJhIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQudWlkIjoiNWU4NTcwMDItMmIwMy00ODUxLTljNDEtOGM5NGRhZTNhZWQzIiwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50Om9wZW51bmlzb246b3BlbnVuaXNvbi1vcmNoZXN0cmEifQ.eXlVuwZYYF85menphWJEHgSVNL8BTnCQfQiuE3QoJCEKO3Mi-xG1psPMxXnFkgeNlRdu30sejyd23_2ccW2b7q7Ss94o_m3ypWVV95ylGLegQOR8-b4mnysA8W9H1xpDsDii6kqc6k0IkJggUhBqImZHjSxbuvexuNuBmp-E_EOTuALIPmfWH3A7_z6dQEYc6sZ6xcmwBFJ-CuTDTpmYO-FvHvmBKVELpgCkEtMTeaXL3Avjg9KrrZ9T6rMcFfeDlMxNj-8KCEFV3QIiZCzULERuGU1WKKfukmb_sgEm5CshOHfC06ah0dyclZq8ctDPRqPVyRTgF5ZGtA_p4U6RsA"

	// Create request
	form := url.Values{}
	form.Add("token", "foo")
	request := httptest.NewRequest("POST", "http://kiali/api/authenticate", nil)
	request.Header.Set("Authorization", "Bearer "+oidcToken)
	request.Header.Set("Impersonate-User", "mmosley")
	request.PostForm = form

	// Add a stale token to the request. Authentication should succeed even if a stale
	// session is present. This prevents the user form manually clean browser cookies.
	currentToken, _ := config.GenerateToken("dummy")
	oldCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: currentToken.Token,
	}
	request.AddCookie(&oldCookie)

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)

	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)

	fromCookie, _, err := new(jwt.Parser).ParseUnverified(cookie.Value, &config.IanaClaims{})
	if err != nil {
		assert.FailNow(t, err.Error())
	}

	claimFromCookie := fromCookie.Claims.(*config.IanaClaims)

	assert.Equal(t, "mmosley", claimFromCookie.Subject)
	assert.Equal(t, config.AuthStrategyHeaderIssuer, claimFromCookie.Issuer)
	assert.True(t, IsValidUUID(claimFromCookie.SessionId))
}

func mockK8s(reject bool) {
	kubernetes.KialiToken = "notrealtoken"
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, prom)

	if reject {
		k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{}, fmt.Errorf("Rejecting"))
	} else {
		k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "tutorial",
				},
			},
		}, nil)
	}
}

func IsValidUUID(uuid string) bool {
	r := regexp.MustCompile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$")
	return r.MatchString(uuid)
}
