package handlers

import (
	"encoding/json"
	"github.com/dgrijalva/jwt-go"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
	"github.com/stretchr/testify/assert"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestStrategyLoginAuthentication checks that a user with no active
// session is logged in successfully
func TestStrategyLoginAuthentication(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyLogin
	cfg.Server.Credentials.Username = "foo"
	cfg.Server.Credentials.Passphrase = "bar"
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest("GET", "http://kiali/api/authenticate", nil)
	request.SetBasicAuth("foo", "bar")

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)
	// assert.Equal(t,, http.SameSiteStrictMode, cookie.SameSite) ** Commented out because unsupported in go < 1.11

	assert.NotEmpty(t, cookie.Value)
	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
}

// TestStrategyLoginFails checks that a login attempt is
// rejected if user provides wrong credentials
func TestStrategyLoginFails(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyLogin
	cfg.Server.Credentials.Username = "foo"
	cfg.Server.Credentials.Passphrase = "bar"
	config.Set(cfg)

	// Check wrong user
	request := httptest.NewRequest("GET", "http://kiali/api/authenticate", nil)
	request.SetBasicAuth("jdoe", "bar")

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Len(t, response.Cookies(), 0)

	// Check wrong password
	request = httptest.NewRequest("GET", "http://kiali/api/authenticate", nil)
	request.SetBasicAuth("foo", "baz")

	responseRecorder = httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response = responseRecorder.Result()

	assert.Equal(t, http.StatusUnauthorized, response.StatusCode)
	assert.Len(t, response.Cookies(), 0)
}

// TestStrategyLoginExtend checks that a user with an active session
// received a refreshed token to extend his session time
func TestStrategyLoginExtend(t *testing.T) {
	jwt.TimeFunc = func() time.Time {
		return util.Clock.Now()
	}

	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyLogin
	cfg.Server.Credentials.Username = "foo"
	cfg.Server.Credentials.Passphrase = "bar"
	config.Set(cfg)

	clockTime := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest("GET", "http://kiali/api/authenticate", nil)
	currentToken, _ := config.GenerateToken("joe")
	oldCookie := http.Cookie{
		Name:  config.TokenCookieName,
		Value: currentToken.Token,
	}
	request.AddCookie(&oldCookie)

	clockTime.Add(time.Second * time.Duration(cfg.LoginToken.ExpirationSeconds-10))
	util.Clock = util.ClockMock{Time: clockTime}

	responseRecorder := httptest.NewRecorder()
	Authenticate(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.Equal(t, config.TokenCookieName, cookie.Name)
	assert.True(t, cookie.HttpOnly)
	// assert.Equal(t,, http.SameSiteStrictMode, cookie.SameSite) ** Commented out because unsupported in go < 1.11

	expectedToken, _ := config.GenerateToken("joe")
	assert.NotEmpty(t, cookie.Value)
	assert.Equal(t, expectedToken.Token, cookie.Value)
	assert.Equal(t, clockTime.Add(time.Second*time.Duration(cfg.LoginToken.ExpirationSeconds)), cookie.Expires)
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

// TestMissingSecretFlagPresent checks that the AuthenticationInfo handler
// sets the secretMissing flag if secret is not present when AuthStrategy is "login".
func TestMissingSecretFlagPresent(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyLogin
	cfg.Server.Credentials.Username = ""
	cfg.Server.Credentials.Passphrase = ""
	config.Set(cfg)

	request := httptest.NewRequest("GET", "http://kiali/api/auth/info", nil)

	responseRecorder := httptest.NewRecorder()
	AuthenticationInfo(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)

	var reply map[string]interface{}
	body, _ := ioutil.ReadAll(response.Body)
	json.Unmarshal(body, &reply)

	assert.Contains(t, reply, "secretMissing")
	assert.Equal(t, true, reply["secretMissing"])
}

// TestMissingSecretFlagAbsent checks that the AuthenticationInfo handler
// won't set the secretMissing flag if secret is present.
func TestMissingSecretFlagAbsent(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = config.AuthStrategyLogin
	cfg.Server.Credentials.Username = "foo"
	cfg.Server.Credentials.Passphrase = "bar"
	config.Set(cfg)

	request := httptest.NewRequest("GET", "http://kiali/api/auth/info", nil)

	responseRecorder := httptest.NewRecorder()
	AuthenticationInfo(responseRecorder, request)
	response := responseRecorder.Result()

	assert.Equal(t, http.StatusOK, response.StatusCode)

	var reply map[string]interface{}
	body, _ := ioutil.ReadAll(response.Body)
	json.Unmarshal(body, &reply)

	assert.NotContains(t, reply, "secretMissing")
}
