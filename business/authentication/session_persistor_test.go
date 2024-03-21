package authentication

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

type testSessionPayload struct {
	FirstField string `json:"firstField,omitempty"`
}

// TestSecureFlag tests that the cookie Secure flag is set to true when using HTTPS.
func TestSecureFlag(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-app"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	cfg.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "Foo",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.True(t, cookie.HttpOnly)
	assert.True(t, cfg.IsServerHTTPS())
	assert.True(t, cookie.Secure)
}

// TestCreateSessionNoChunks tests that the CookieSessionPersistor correctly
// sets one cookie if the payload of a session fits in one browser cookie
func TestCreateSessionNoChunks(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-app"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "Foo",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.True(t, cookie.HttpOnly)
	assert.False(t, cfg.IsServerHTTPS())
	assert.False(t, cookie.Secure)
	assert.Equal(t, AESSessionCookieName, cookie.Name)
	assert.Equal(t, "/kiali-app", cookie.Path)
	assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	assert.Equal(t, expiresTime, cookie.Expires)

	// Unfortunately, the internals of the CreateSession is using a "nonce" to encrypt data.
	// This means that the output is not predictable. The only thing is possible to test here
	// is to check that the returned cookie won't have a plain text payload on it (which is the "Foo" text).
	decodedB64Cookie, err := base64.StdEncoding.DecodeString(response.Cookies()[0].Value)
	assert.Nil(t, err)
	payloadJson, err1 := json.Marshal(payload)
	assert.Nil(t, err1)
	// sometimes (randomly) the result of "nonce" encrypted data can contain the plain text, so avoiding "NotContains" direct assertion here and checking the JSON
	assert.NotEqual(t, cookie.Value, "Foo")
	assert.NotEqual(t, string(decodedB64Cookie), "Foo")
	assert.NotContains(t, string(decodedB64Cookie), string(payloadJson))
	assert.NotContains(t, cookie.Value, string(payloadJson))
}

// TestCreateSessionWithChunks tests that the CookieSessionPersistor correctly
// sets the needed browser cookies if the payload does not fit in one browser cookie.
func TestCreateSessionWithChunks(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-app"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	// Create a long enough payload to overflow our maximum size of a cookie.
	payload := testSessionPayload{
		FirstField: strings.Repeat("1234567890", SessionCookieMaxSize/len("1234567890")),
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 3)
	assert.Equal(t, AESSessionCookieName, response.Cookies()[0].Name)
	assert.Equal(t, config.TokenCookieName+"-aes-1", response.Cookies()[1].Name)
	assert.Equal(t, config.TokenCookieName+"-chunks", response.Cookies()[2].Name)
	assert.Equal(t, "2", response.Cookies()[2].Value)

	for _, cookie := range response.Cookies() {
		assert.True(t, cookie.HttpOnly)
		assert.False(t, cookie.Secure)
		assert.Equal(t, "/kiali-app", cookie.Path)
		assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
		assert.Equal(t, expiresTime, cookie.Expires)
	}
}

// TestCreateSessionRejectsNilPayload tests that the CookieSessionPersistor rejects
// creating a session if a nil payload is passed.
func TestCreateSessionRejectsNilPayload(t *testing.T) {
	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(config.NewConfig())
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, nil)

	response := rr.Result()

	assert.NotNil(t, err)
	assert.Len(t, response.Cookies(), 0)
}

// TestCreateSessionRejectsEmptyStrategy tests that the CookieSessionPersistor rejects
// creating a session if an empty strategy is passed.
func TestCreateSessionRejectsEmptyStrategy(t *testing.T) {
	payload := testSessionPayload{
		FirstField: "1234567890",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(config.NewConfig())
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "", expiresTime, payload)

	response := rr.Result()

	assert.NotNil(t, err)
	assert.Len(t, response.Cookies(), 0)
}

// TestCreateSessionRejectsExpireTimeInThePast tests that the CookieSessionPersistor rejects
// creating a session if the indicated expiration time is already in the past.
func TestCreateSessionRejectsExpireTimeInThePast(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 1, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "1234567890",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(config.NewConfig())
	expiresTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)

	response := rr.Result()

	assert.NotNil(t, err)
	assert.Len(t, response.Cookies(), 0)
}

// TestReadSessionWithNoActiveSession tests that the CookieSessionPersistor does not emit
// an error when restoring a session if the HTTP request contains no active session.
func TestReadSessionWithNoActiveSession(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)

	var payload testSessionPayload
	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(config.NewConfig())
	sData, err := persistor.ReadSession(request, rr, payload)

	assert.Nil(t, sData)
	assert.Nil(t, err)
}

// TestReadSessionWithSingleCookie tests that the CookieSessionPersistor correctly
// restores a session that fit in a single browser cookie.
func TestReadSessionWithSingleCookie(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = "test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "FooBar",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)
	assert.Nil(t, err)

	response := rr.Result()

	// Create a request containing the cookies of the response
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	assert.Len(t, response.Cookies(), 1)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Read/restore the session.
	rr = httptest.NewRecorder()
	restoredPayload := testSessionPayload{}
	sData, err := persistor.ReadSession(request, rr, &restoredPayload)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	assert.Equal(t, expiresTime, sData.ExpiresOn)
	assert.Equal(t, "test", sData.Strategy)
	assert.Equal(t, "FooBar", restoredPayload.FirstField)
}

// TestReadSessionWithTwoCookies tests that the CookieSessionPersistor correctly
// restores a session that didn't fit in a single browser cookie.
func TestReadSessionWithTwoCookies(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = "test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payloadStr := strings.Repeat("FooBar", SessionCookieMaxSize/len("FooBar"))
	payload := testSessionPayload{
		FirstField: payloadStr,
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)
	assert.Nil(t, err)

	response := rr.Result()

	// Create a request containing the cookies of the response
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	assert.Len(t, response.Cookies(), 3)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Read/restore the session.
	rr = httptest.NewRecorder()
	restoredPayload := testSessionPayload{}
	sData, err := persistor.ReadSession(request, rr, &restoredPayload)

	assert.Nil(t, err)
	assert.NotNil(t, sData)
	assert.Equal(t, expiresTime, sData.ExpiresOn)
	assert.Equal(t, "test", sData.Strategy)
	assert.Equal(t, payloadStr, restoredPayload.FirstField)
}

// TestReadSessionRejectsExpired tests that the CookieSessionPersistor does
// not restore a session that is already expired.
func TestReadSessionRejectsExpired(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = "test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "FooBar",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)
	assert.Nil(t, err)

	response := rr.Result()

	// Create a request containing the cookies of the response
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Go to the future
	util.Clock = util.ClockMock{Time: expiresTime}

	// Read/restore the session.
	rr = httptest.NewRecorder()
	restoredPayload := testSessionPayload{}
	sData, err := persistor.ReadSession(request, rr, &restoredPayload)

	assert.Nil(t, err)
	assert.Nil(t, sData)
	assert.Empty(t, restoredPayload.FirstField)
}

// TestReadSessionRejectsDifferentStrategy tests that the CookieSessionPersistor does
// not restore a session that was created with a strategy different from the currently configured one.
func TestReadSessionRejectsDifferentStrategy(t *testing.T) {
	cfg := config.NewConfig()
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "FooBar",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)
	assert.Nil(t, err)

	response := rr.Result()

	// Create a request containing the cookies of the response
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Read/restore the session.
	rr = httptest.NewRecorder()
	restoredPayload := testSessionPayload{}
	sData, err := persistor.ReadSession(request, rr, &restoredPayload)

	assert.Nil(t, err)
	assert.Nil(t, sData)
	assert.Empty(t, restoredPayload.FirstField)
}

// TestReadSessionRejectsDifferentSigningKey tests that the CookieSessionPersistor does
// not restore a session that was created with an old Kiali signing key
func TestReadSessionRejectsDifferentSigningKey(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Auth.Strategy = "test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	payload := testSessionPayload{
		FirstField: "FooBar",
	}

	rr := httptest.NewRecorder()
	persistor := NewCookieSessionPersistor(cfg)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)
	assert.Nil(t, err)

	response := rr.Result()

	// Create a request containing the cookies of the response
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, c := range response.Cookies() {
		request.AddCookie(c)
	}

	// Set a new signing key
	cfg.LoginToken.SigningKey = "kiali-----------"
	config.Set(cfg)

	// Read/restore the session.
	rr = httptest.NewRecorder()
	restoredPayload := testSessionPayload{}
	sData, err := persistor.ReadSession(request, rr, &restoredPayload)

	assert.NotNil(t, err) // When the signing key does not match, an error is generated.
	assert.Nil(t, sData)
	assert.Empty(t, restoredPayload.FirstField)
}

// TestTerminateSessionClearsNonAesSession tests that the CookieSessionPersistor correctly clears
// a session that was created with the old JWT method.
func TestTerminateSessionClearsNonAesSession(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    config.TokenCookieName,
		Value:   "",
		Expires: time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC),
	}
	request.AddCookie(&cookie)

	persistor := NewCookieSessionPersistor(c)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, config.TokenCookieName, response.Cookies()[0].Name)
	assert.Empty(t, response.Cookies()[0].Value)
	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
}

// TestTerminateSessionClearsAesSession tests that the CookieSessionPersistor correctly clears
// a session that is using encrypted cookies with the AES-GCM algorithm where no "-chunks" cookie is set.
func TestTerminateSessionClearsAesSession(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    AESSessionCookieName,
		Value:   "",
		Expires: time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC),
	}
	request.AddCookie(&cookie)

	persistor := NewCookieSessionPersistor(c)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, AESSessionCookieName, response.Cookies()[0].Name)
	assert.Empty(t, response.Cookies()[0].Value)
	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
}

// TestTerminateSessionClearsAesSessionWithOneChunk tests that the CookieSessionPersistor correctly
// clears a session where the payload fit in a single browser cookie, yet the "-chunks" cookie is set.
func TestTerminateSessionClearsAesSessionWithOneChunk(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	expireTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    AESSessionCookieName,
		Value:   "",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    config.TokenCookieName + "-chunks",
		Value:   "1",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)

	persistor := NewCookieSessionPersistor(c)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, AESSessionCookieName, response.Cookies()[0].Name)
	assert.Equal(t, config.TokenCookieName+"-chunks", response.Cookies()[1].Name)

	for i := 0; i < 2; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}

// TestTerminateSessionClearsAesSessionWithTwoChunks tests that the CookieSessionPersistor correctly
// clears a session where the payload didn't fit in a single browser cookie.
func TestTerminateSessionClearsAesSessionWithTwoChunks(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	expireTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    AESSessionCookieName,
		Value:   "",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    config.TokenCookieName + "-chunks",
		Value:   "2",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    config.TokenCookieName + "-aes-1",
		Value:   "x",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)

	persistor := NewCookieSessionPersistor(c)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 3)
	assert.Equal(t, config.TokenCookieName+"-aes-1", response.Cookies()[0].Name)
	assert.Equal(t, AESSessionCookieName, response.Cookies()[1].Name)
	assert.Equal(t, config.TokenCookieName+"-chunks", response.Cookies()[2].Name)

	for i := 0; i < 3; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}
