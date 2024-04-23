package authentication

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

type testSessionPayload struct {
	FirstField string `json:"firstField,omitempty"`
}

// TestSecureFlag tests that the cookie Secure flag is set to true when using HTTPS.
func TestSecureFlag(t *testing.T) {
	require := require.New(t)
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
	persistor, err := NewCookieSessionPersistor[testSessionPayload](cfg)
	require.NoError(err)

	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	session, err := NewSessionData("test", cfg.Auth.Strategy, expiresTime, &payload)
	require.NoError(err)
	err = persistor.CreateSession(nil, rr, *session)

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
	require := require.New(t)
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
	persistor, err := NewCookieSessionPersistor[testSessionPayload](cfg)
	require.NoError(err)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	session, err := NewSessionData("", cfg.Auth.Strategy, expiresTime, &payload)
	require.NoError(err)
	err = persistor.CreateSession(nil, rr, *session)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.True(t, cookie.HttpOnly)
	assert.False(t, cfg.IsServerHTTPS())
	assert.False(t, cookie.Secure)
	assert.Equal(t, SessionCookieName, cookie.Name)
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
	persistor, err := NewCookieSessionPersistor[testSessionPayload](cfg)
	require.NoError(t, err)
	expiresTime := time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC)
	session, err := NewSessionData("", cfg.Auth.Strategy, expiresTime, &payload)
	require.NoError(t, err)
	err = persistor.CreateSession(nil, rr, *session)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 3)
	assert.Equal(t, SessionCookieName, response.Cookies()[0].Name)
	assert.Equal(t, SessionCookieName+"-1", response.Cookies()[1].Name)
	assert.Equal(t, SessionCookieName+"-chunks", response.Cookies()[2].Name)
	assert.Equal(t, "2", response.Cookies()[2].Value)

	for _, cookie := range response.Cookies() {
		assert.True(t, cookie.HttpOnly)
		assert.False(t, cookie.Secure)
		assert.Equal(t, "/kiali-app", cookie.Path)
		assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
		assert.Equal(t, expiresTime, cookie.Expires)
	}
}

func TestNewSessionData(t *testing.T) {
	util.Clock = util.ClockMock{Time: time.Now()}
	oneDayFromNow := time.Now().Add(time.Hour * 24)
	cases := map[string]struct {
		expectErr bool
		expiresOn time.Time
		key       string
		payload   *testSessionPayload
		strategy  string
	}{
		"nil payload is rejected": {
			expectErr: true,
			payload:   nil,
			strategy:  config.AuthStrategyToken,
			expiresOn: oneDayFromNow,
		},
		"empty strategy is rejected": {
			expectErr: true,
			payload:   &testSessionPayload{},
			strategy:  "",
			expiresOn: oneDayFromNow,
		},
		"expriation time in the past that has already expired is rejected": {
			expectErr: true,
			payload:   &testSessionPayload{},
			strategy:  config.AuthStrategyToken,
			expiresOn: time.Now().Add(-time.Hour),
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			_, err := NewSessionData(tc.key, tc.strategy, tc.expiresOn, tc.payload)
			if tc.expectErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}
		})
	}
}

// TestReadSessionWithNoActiveSessionReturnsErrSessionNotFound tests that the CookieSessionPersistor does not emit
// an error when restoring a session if the HTTP request contains no active session.
func TestReadSessionWithNoActiveSessionReturnsErrSessionNotFound(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)

	rr := httptest.NewRecorder()
	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)
	sData, err := persistor.ReadSession(request, rr, "non-existant-key")

	require.Nil(sData)
	require.ErrorIs(err, ErrSessionNotFound)
}

// TODO: combine with createValidSession?
func newValidSessionCookies(t *testing.T, persistor SessionPersistor[testSessionPayload], key string, strategy string, expirationTime time.Time, payload testSessionPayload) []*http.Cookie {
	t.Helper()
	rr := httptest.NewRecorder()
	session, err := NewSessionData(key, strategy, expirationTime, &payload)
	require.NoError(t, err)
	err = persistor.CreateSession(nil, rr, *session)
	require.NoError(t, err)

	response := rr.Result()
	require.Greater(t, len(response.Cookies()), 0)

	return response.Cookies()
}

func TestReadSession(t *testing.T) {
	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	cases := map[string]struct {
		expectErr      bool
		expirationTime time.Time
		key            string
		payload        *testSessionPayload
		strategy       string
	}{
		"session that fits into a single browser cookie is restored correctly": {
			payload: &testSessionPayload{
				FirstField: "FooBar",
			},
			expirationTime: now.Add(time.Hour),
			key:            "test",
			strategy:       "test",
		},
		"session that does not fit into a single browser cookie is restored correctly": {
			payload: &testSessionPayload{
				FirstField: strings.Repeat("FooBar", SessionCookieMaxSize/len("FooBar")),
			},
			expirationTime: now.Add(time.Hour),
			key:            "test",
			strategy:       "test",
		},
		"session that was created with a strategy different from the currently configured one is rejected": {
			expectErr: true,
			payload: &testSessionPayload{
				FirstField: "FooBar",
			},
			expirationTime: now.Add(time.Hour),
			key:            "test",
			strategy:       "new-strategy-different-from-conf",
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			conf := config.NewConfig()
			conf.LoginToken.SigningKey = "kiali67890123456"
			conf.Auth.Strategy = "test"

			persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
			require.NoError(err)

			request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
			for _, cookie := range newValidSessionCookies(t, persistor, tc.key, tc.strategy, tc.expirationTime, *tc.payload) {
				request.AddCookie(cookie)
			}

			rr := httptest.NewRecorder()
			sData, err := persistor.ReadSession(request, rr, tc.key)
			if tc.expectErr {
				require.Error(err)
				// Errors should result in dropping cookies with bad sessions in them except not found errors.
				if !errors.Is(err, ErrSessionNotFound) {
					for _, cookie := range rr.Result().Cookies() {
						require.True(cookie.MaxAge < 0, "cookie should be expired")
					}
				}
			} else {
				require.NoError(err)
				require.NotNil(sData)
				require.Equal(tc.payload, sData.Payload)
				require.True(sData.ExpiresOn.Equal(tc.expirationTime), "expiration time does not match")
				require.Equal(tc.strategy, sData.Strategy)
			}
		})
	}
}

// // TestReadSessionRejectsDifferentSigningKey tests that the CookieSessionPersistor does
// // not restore a session that was created with an old Kiali signing key
func TestReadSessionRejectsDifferentSigningKey(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = "test"
	conf.LoginToken.SigningKey = "kiali67890123456"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	payload := testSessionPayload{
		FirstField: "FooBar",
	}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, cookie := range newValidSessionCookies(t, persistor, "test", "test", now.Add(time.Hour), payload) {
		request.AddCookie(cookie)
	}

	conf.LoginToken.SigningKey = "kiali-----------"
	persistor, err = NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	rr := httptest.NewRecorder()
	sData, err := persistor.ReadSession(request, rr, "test")
	require.Error(err)
	// Errors should result in dropping cookies with bad sessions in them except not found errors.
	for _, cookie := range rr.Result().Cookies() {
		require.True(cookie.MaxAge < 0, "cookie should be expired")
	}
	require.Nil(sData)
}

// TestTerminateSessionClearsNonAesSession tests that the CookieSessionPersistor correctly clears
// a session that was created with the old JWT method.
func TestTerminateSessionClearsNonAesSession(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Server.WebRoot = "/kiali-app"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    SessionCookieName,
		Value:   "",
		Expires: now.Add(time.Hour),
	}
	request.AddCookie(&cookie)

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr, "")

	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, SessionCookieName, response.Cookies()[0].Name)
	assert.Empty(t, response.Cookies()[0].Value)
	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
}

// TestTerminateSessionClearsAesSession tests that the CookieSessionPersistor correctly clears
// a session that is using encrypted cookies with the AES-GCM algorithm where no "-chunks" cookie is set.
// TODO: Test with key
// func TestTerminateSessionClearsAesSession(t *testing.T) {
// 	c := config.NewConfig()
// 	c.Server.WebRoot = "/kiali-app"
// 	config.Set(c)

// 	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
// 	util.Clock = util.ClockMock{Time: clockTime}

// 	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
// 	cookie := http.Cookie{
// 		Name:    SessionCookieName,
// 		Value:   "",
// 		Expires: time.Date(2021, 12, 1, 1, 0, 0, 0, time.UTC),
// 	}
// 	request.AddCookie(&cookie)

// 	persistor := NewCookieSessionPersistor(c)

// 	rr := httptest.NewRecorder()
// 	persistor.TerminateSession(request, rr)

// 	response := rr.Result()
// 	assert.Len(t, response.Cookies(), 1)
// 	assert.Equal(t, AESSessionCookieName, response.Cookies()[0].Name)
// 	assert.Empty(t, response.Cookies()[0].Value)
// 	assert.True(t, response.Cookies()[0].Expires.Before(util.Clock.Now()))
// 	assert.Equal(t, "/kiali-app", response.Cookies()[0].Path)
// }

// TestTerminateSessionClearsAesSessionWithOneChunk tests that the CookieSessionPersistor correctly
// clears a session where the payload fit in a single browser cookie, yet the "-chunks" cookie is set.
func TestTerminateSessionClearsAesSessionWithOneChunk(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	expireTime := now.Add(time.Hour)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    SessionCookieName,
		Value:   "",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    NumberOfChunksCookieName,
		Value:   "1",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr, "")

	response := rr.Result()
	require.Len(response.Cookies(), 2)
	assert.Equal(t, SessionCookieName, response.Cookies()[0].Name)
	assert.Equal(t, NumberOfChunksCookieName, response.Cookies()[1].Name)

	for i := 0; i < 2; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}

// TestTerminateSessionClearsAesSessionWithTwoChunks tests that the CookieSessionPersistor correctly
// clears a session where the payload didn't fit in a single browser cookie.
func TestTerminateSessionClearsAesSessionWithTwoChunks(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	expireTime := now.Add(time.Hour)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	cookie := http.Cookie{
		Name:    SessionCookieName + "-aes",
		Value:   "",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    NumberOfChunksCookieName,
		Value:   "2",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    SessionCookieName + "-aes-1",
		Value:   "x",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	rr := httptest.NewRecorder()
	persistor.TerminateSession(request, rr, "")

	response := rr.Result()
	require.Len(response.Cookies(), 3)
	// Sort by name to ensure the order is correct
	cookies := response.Cookies()
	slices.SortStableFunc(cookies, func(a, b *http.Cookie) int {
		return strings.Compare(a.Name, b.Name)
	})
	assert.Equal(t, SessionCookieName+"-aes", response.Cookies()[0].Name)
	assert.Equal(t, NumberOfChunksCookieName, response.Cookies()[1].Name)
	assert.Equal(t, SessionCookieName+"-aes-1", response.Cookies()[2].Name)

	for i := 0; i < 3; i++ {
		assert.True(t, response.Cookies()[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", response.Cookies()[i].Path)
		assert.Empty(t, response.Cookies()[i].Value)
	}
}
