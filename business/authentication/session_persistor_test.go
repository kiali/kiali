package authentication

import (
	"encoding/base64"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
	"github.com/stretchr/testify/assert"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCreateSession(t *testing.T) {
	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-app"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	config.Set(cfg)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	payload := struct {
		FirstField string `json:"firstField,omitempty"`
	}{
		FirstField: "Foo",
	}

	rr := httptest.NewRecorder()

	persistor := CookieSessionPersistor{}
	err := persistor.CreateSession(nil, rr, "test", expiresTime, payload)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.True(t, cookie.HttpOnly)
	assert.Equal(t, config.TokenCookieName+"-aes", cookie.Name)
	assert.Equal(t, "/kiali-app", cookie.Path)
	assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	assert.Equal(t, expiresTime, cookie.Expires)

	// Unfortunately, the internals of the CreateSession is using a "nonce" to encrypt data.
	// This means that the output is not predictable. The only thing is possible to test here
	// is to check that the returned cookie won't have a plain text payload on it (which is the "Foo" text).
	decodedB64Cookie, err := base64.StdEncoding.DecodeString(response.Cookies()[0].Value)
	assert.Nil(t, err)
	assert.NotContains(t, cookie.Value, "Foo")
	assert.NotContains(t, string(decodedB64Cookie), "Foo")
}

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

	persistor := CookieSessionPersistor{}

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, config.TokenCookieName, response.Cookies()[0].Name)
	assert.Empty(t, response.Cookies()[0].Value)
	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
}

func TestTerminateSessionClearsAesSession(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    config.TokenCookieName + "-aes",
		Value:   "",
		Expires: time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC),
	}
	request.AddCookie(&cookie)

	persistor := CookieSessionPersistor{}

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[0].Name)
	assert.Empty(t, response.Cookies()[0].Value)
	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
}

func TestTerminateSessionClearsAesSessionWithOneChunk(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	expireTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    config.TokenCookieName + "-aes",
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

	persistor := CookieSessionPersistor{}

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[0].Name)
	assert.Equal(t, config.TokenCookieName+"-chunks", response.Cookies()[1].Name)

	for i := 0; i < 2; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}

func TestTerminateSessionClearsAesSessionWithTwoChunks(t *testing.T) {
	c := config.NewConfig()
	c.Server.WebRoot = "/kiali-app"
	config.Set(c)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	expireTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    config.TokenCookieName + "-aes",
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

	persistor := CookieSessionPersistor{}

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr)

	response := rr.Result()
	assert.Len(t, response.Cookies(), 3)
	assert.Equal(t, config.TokenCookieName+"-aes-1", response.Cookies()[0].Name)
	assert.Equal(t, config.TokenCookieName+"-aes", response.Cookies()[1].Name)
	assert.Equal(t, config.TokenCookieName+"-chunks", response.Cookies()[2].Name)

	for i := 0; i < 3; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}
