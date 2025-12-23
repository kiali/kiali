package authentication

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
	session, err := NewSessionData("test-cluster", cfg.Auth.Strategy, expiresTime, &payload)
	require.NoError(err)
	err = persistor.CreateSession(nil, rr, *session)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 1)

	cookie := response.Cookies()[0]
	assert.True(t, cookie.HttpOnly)
	assert.False(t, cfg.IsServerHTTPS())
	assert.False(t, cookie.Secure)
	assert.Equal(t, sessionCookieName(SessionCookieName, "test-cluster"), cookie.Name)
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
	session, err := NewSessionData("test-cluster", cfg.Auth.Strategy, expiresTime, &payload)
	require.NoError(t, err)
	err = persistor.CreateSession(nil, rr, *session)

	response := rr.Result()

	assert.Nil(t, err)
	assert.Len(t, response.Cookies(), 3)
	assert.Equal(t, sessionCookieName(SessionCookieName, "test-cluster"), response.Cookies()[0].Name)
	assert.Equal(t, sessionCookieName(SessionCookieName, "test-cluster")+"-1", response.Cookies()[1].Name)
	assert.Equal(t, sessionCookieName(NumberOfChunksCookieName, "test-cluster"), response.Cookies()[2].Name)
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
		cluster   string
		payload   *testSessionPayload
		strategy  string
	}{
		"nil payload is rejected": {
			expectErr: true,
			cluster:   "test",
			payload:   nil,
			strategy:  config.AuthStrategyToken,
			expiresOn: oneDayFromNow,
		},
		"empty strategy is rejected": {
			expectErr: true,
			cluster:   "test",
			payload:   &testSessionPayload{},
			strategy:  "",
			expiresOn: oneDayFromNow,
		},
		"expiration time in the past is rejected": {
			expectErr: true,
			cluster:   "test",
			payload:   &testSessionPayload{},
			strategy:  config.AuthStrategyToken,
			expiresOn: time.Now().Add(-time.Hour),
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			_, err := NewSessionData(tc.cluster, tc.strategy, tc.expiresOn, tc.payload)
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

// TestSigningKeyRotation tests that rotating the signing key secret
// invalidates the cached AES cipher so that newly created sessions use the updated key.
func TestSigningKeyRotation(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = "test"

	credMgr, err := config.NewCredentialManager(nil)
	require.NoError(err)
	conf.Credentials = credMgr
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	keyFile := filepath.Join(tmpDir, "signing.key")
	require.NoError(os.WriteFile(keyFile, []byte("kiali67890123456"), 0o600))
	conf.LoginToken.SigningKey = config.Credential(keyFile)

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Rotate the underlying file
	require.NoError(os.WriteFile(keyFile, []byte("abcdefghijklmnop"), 0o600))

	// Wait for the credential manager to observe the rotated key.
	require.Eventually(func() bool {
		value, err := conf.GetCredential(conf.LoginToken.SigningKey)
		return err == nil && value == "abcdefghijklmnop"
	}, 2*time.Second, 50*time.Millisecond)

	rr := httptest.NewRecorder()
	payload := testSessionPayload{FirstField: "rotated"}
	session, err := NewSessionData("test", "test", now.Add(time.Hour), &payload)
	require.NoError(err)

	request := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	require.NoError(persistor.CreateSession(request, rr, *session))

	// If rotation worked, decrypting with the new key should succeed.
	for _, cookie := range rr.Result().Cookies() {
		request.AddCookie(cookie)
	}

	_, err = persistor.ReadSession(request, httptest.NewRecorder(), "test")
	require.NoError(err)
}

// TestOldSessionsFailAfterRotation tests that sessions created before key rotation
// become invalid after the signing key is rotated, preventing attackers with the old
// key from minting valid session cookies after rotation.
func TestOldSessionsFailAfterRotation(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = "test"

	credMgr, err := config.NewCredentialManager(nil)
	require.NoError(err)
	conf.Credentials = credMgr
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	keyFile := filepath.Join(tmpDir, "signing.key")
	require.NoError(os.WriteFile(keyFile, []byte("kiali67890123456"), 0o600))
	conf.LoginToken.SigningKey = config.Credential(keyFile)

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a session with the original key
	payload := testSessionPayload{FirstField: "original"}
	session, err := NewSessionData("test", "test", now.Add(time.Hour), &payload)
	require.NoError(err)

	rr := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/someendpoint", nil)
	require.NoError(persistor.CreateSession(request, rr, *session))

	// Save the cookies from the original session
	oldCookies := rr.Result().Cookies()
	require.Greater(len(oldCookies), 0)

	// Rotate the underlying file to a different key
	require.NoError(os.WriteFile(keyFile, []byte("newkey0123456789"), 0o600))

	// Wait for the credential manager to observe the rotated key
	require.Eventually(func() bool {
		value, err := conf.GetCredential(conf.LoginToken.SigningKey)
		return err == nil && value == "newkey0123456789"
	}, 2*time.Second, 50*time.Millisecond)

	// Try to read the old session - it should fail because it was encrypted with the old key
	requestWithOldSession := httptest.NewRequest(http.MethodGet, "/api/someendpoint", nil)
	for _, cookie := range oldCookies {
		requestWithOldSession.AddCookie(cookie)
	}

	_, err = persistor.ReadSession(requestWithOldSession, httptest.NewRecorder(), "test")
	require.Error(err, "old session should fail to decrypt with rotated key")
}

// TestMultipleRotations tests that key rotation works correctly across multiple key changes,
// ensuring that only sessions created with the most recent key are valid.
func TestMultipleRotations(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = "test"

	credMgr, err := config.NewCredentialManager(nil)
	require.NoError(err)
	conf.Credentials = credMgr
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	keyFile := filepath.Join(tmpDir, "signing.key")
	require.NoError(os.WriteFile(keyFile, []byte("key1xxxxxxxxxxxx"), 0o600))
	conf.LoginToken.SigningKey = config.Credential(keyFile)

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create session1 with key1
	payload1 := testSessionPayload{FirstField: "session1"}
	session1, err := NewSessionData("session1", "test", now.Add(time.Hour), &payload1)
	require.NoError(err)

	rr1 := httptest.NewRecorder()
	request1 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	require.NoError(persistor.CreateSession(request1, rr1, *session1))
	cookies1 := rr1.Result().Cookies()

	// Rotate to key2
	require.NoError(os.WriteFile(keyFile, []byte("key2xxxxxxxxxxxx"), 0o600))
	require.Eventually(func() bool {
		value, err := conf.GetCredential(conf.LoginToken.SigningKey)
		return err == nil && value == "key2xxxxxxxxxxxx"
	}, 2*time.Second, 50*time.Millisecond)

	// Create session2 with key2
	payload2 := testSessionPayload{FirstField: "session2"}
	session2, err := NewSessionData("session2", "test", now.Add(time.Hour), &payload2)
	require.NoError(err)

	rr2 := httptest.NewRecorder()
	request2 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	require.NoError(persistor.CreateSession(request2, rr2, *session2))
	cookies2 := rr2.Result().Cookies()

	// Rotate to key3
	require.NoError(os.WriteFile(keyFile, []byte("key3xxxxxxxxxxxx"), 0o600))
	require.Eventually(func() bool {
		value, err := conf.GetCredential(conf.LoginToken.SigningKey)
		return err == nil && value == "key3xxxxxxxxxxxx"
	}, 2*time.Second, 50*time.Millisecond)

	// Create session3 with key3
	payload3 := testSessionPayload{FirstField: "session3"}
	session3, err := NewSessionData("session3", "test", now.Add(time.Hour), &payload3)
	require.NoError(err)

	rr3 := httptest.NewRecorder()
	request3 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	require.NoError(persistor.CreateSession(request3, rr3, *session3))
	cookies3 := rr3.Result().Cookies()

	// Verify session3 (most recent) can be read
	readRequest3 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	for _, cookie := range cookies3 {
		readRequest3.AddCookie(cookie)
	}
	sData3, err := persistor.ReadSession(readRequest3, httptest.NewRecorder(), "session3")
	require.NoError(err)
	require.Equal("session3", sData3.Payload.FirstField)

	// Verify session1 and session2 fail to read
	readRequest1 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	for _, cookie := range cookies1 {
		readRequest1.AddCookie(cookie)
	}
	_, err = persistor.ReadSession(readRequest1, httptest.NewRecorder(), "session1")
	require.Error(err, "session1 should fail after multiple rotations")

	readRequest2 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	for _, cookie := range cookies2 {
		readRequest2.AddCookie(cookie)
	}
	_, err = persistor.ReadSession(readRequest2, httptest.NewRecorder(), "session2")
	require.Error(err, "session2 should fail after rotation to key3")
}

// TestReadSessionUsesCurrentKey tests that ReadSession picks up the rotated key,
// confirming both encrypt and decrypt paths use the live key from the credential manager.
func TestReadSessionUsesCurrentKey(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = "test"

	credMgr, err := config.NewCredentialManager(nil)
	require.NoError(err)
	conf.Credentials = credMgr
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	keyFile := filepath.Join(tmpDir, "signing.key")
	require.NoError(os.WriteFile(keyFile, []byte("kiali67890123456"), 0o600))
	conf.LoginToken.SigningKey = config.Credential(keyFile)

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create session with key1
	payload := testSessionPayload{FirstField: "test"}
	session, err := NewSessionData("test", "test", now.Add(time.Hour), &payload)
	require.NoError(err)

	rr := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	require.NoError(persistor.CreateSession(request, rr, *session))

	// Read the session successfully with key1
	readRequest := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	for _, cookie := range rr.Result().Cookies() {
		readRequest.AddCookie(cookie)
	}
	sData, err := persistor.ReadSession(readRequest, httptest.NewRecorder(), "test")
	require.NoError(err)
	require.Equal("test", sData.Payload.FirstField)

	// Rotate to key2
	require.NoError(os.WriteFile(keyFile, []byte("rotatedkey567890"), 0o600))
	require.Eventually(func() bool {
		value, err := conf.GetCredential(conf.LoginToken.SigningKey)
		return err == nil && value == "rotatedkey567890"
	}, 2*time.Second, 50*time.Millisecond)

	// Try to read the same session again - should fail because ReadSession uses the rotated key
	readRequest2 := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)
	for _, cookie := range rr.Result().Cookies() {
		readRequest2.AddCookie(cookie)
	}
	_, err = persistor.ReadSession(readRequest2, httptest.NewRecorder(), "test")
	require.Error(err, "reading old session with rotated key should fail")
}

// TestRotationToInvalidKeyLength tests that rotation to an invalid key
// length is handled gracefully without crashing.
func TestRotationToInvalidKeyLength(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyToken

	credMgr, err := config.NewCredentialManager(nil)
	require.NoError(err)
	conf.Credentials = credMgr
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	keyFile := filepath.Join(tmpDir, "signing.key")
	require.NoError(os.WriteFile(keyFile, []byte("kiali67890123456"), 0o600))
	conf.LoginToken.SigningKey = config.Credential(keyFile)

	now := time.Now()
	util.Clock = util.ClockMock{Time: now}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Rotate to invalid key length (not 16/24/32 bytes)
	require.NoError(os.WriteFile(keyFile, []byte("short"), 0o600))
	require.Eventually(func() bool {
		value, _ := conf.GetCredential(conf.LoginToken.SigningKey)
		return value == "short"
	}, 2*time.Second, 50*time.Millisecond)

	// CreateSession should fail gracefully with clear error
	payload := testSessionPayload{FirstField: "test"}
	session, err := NewSessionData("test", config.AuthStrategyToken, now.Add(time.Hour), &payload)
	require.NoError(err)

	rr := httptest.NewRecorder()
	err = persistor.CreateSession(nil, rr, *session)
	require.Error(err, "should fail with invalid key length")
	require.Contains(err.Error(), "cipher", "error should mention cipher failure")
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

// TestTerminateSessionClearsSessionWithTwoChunks tests that the CookieSessionPersistor correctly
// clears a session where the payload didn't fit in a single browser cookie.
func TestTerminateSessionClearsSessionWithTwoChunks(t *testing.T) {
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
		Value:   "2",
		Expires: expireTime,
	}
	request.AddCookie(&cookie)
	cookie = http.Cookie{
		Name:    SessionCookieName + "-1",
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
	assert.Equal(t, SessionCookieName, cookies[0].Name)
	assert.Equal(t, SessionCookieName+"-1", cookies[1].Name)
	assert.Equal(t, NumberOfChunksCookieName, cookies[2].Name)

	for i := 0; i < 3; i++ {
		assert.True(t, cookies[i].Expires.Before(util.Clock.Now()))
		assert.Equal(t, "/kiali-app", cookies[i].Path)
		assert.Empty(t, cookies[i].Value)
	}
}

// TestReadAllSessions_DoesNotDropChunkCookies verifies that ReadAllSessions does not
// corrupt a valid multi-cookie (chunked) session.
//
// Specifically, when a session payload is split across multiple cookies, we must not
// mistakenly treat the continuation chunk cookies or the chunks-count cookie as if they
// were independently decryptable sessions. If we did, we'd fail to decrypt and might
// delete those cookies, breaking the session for subsequent requests.
//
// NOTE: This test failed on master prior to the fix for https://github.com/kiali/kiali/issues/8990.
func TestReadAllSessions_DoesNotDropChunkCookies(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	clockTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	// Create a payload large enough to require chunking.
	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize*2),
	}

	expiresTime := clockTime.Add(time.Hour)
	cookies := newValidSessionCookies(t, persistor, "test-cluster", conf.Auth.Strategy, expiresTime, largePayload)

	// Verify that we have chunked cookies (chunk #0 cookie + continuation chunk cookies + chunks-count cookie)
	cookieNames := make([]string, len(cookies))
	for i, c := range cookies {
		cookieNames[i] = c.Name
	}
	require.Contains(cookieNames, sessionCookieName(SessionCookieName, "test-cluster"))
	require.Contains(cookieNames, sessionCookieName(SessionCookieName, "test-cluster")+"-1")
	require.Contains(cookieNames, sessionCookieName(NumberOfChunksCookieName, "test-cluster"))

	// Simulate a request with all these cookies.
	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	// Call ReadAllSessions.
	readRR := httptest.NewRecorder()
	sessions, err := persistor.ReadAllSessions(request, readRR)

	// ReadAllSessions must not drop any cookies while reading sessions.
	assert.Empty(t, readRR.Result().Cookies(),
		"ReadAllSessions should not drop any cookies when processing chunked sessions")

	require.NoError(err)
	require.Len(sessions, 1, "Should have exactly one session")
	require.NotNil(sessions[0].Payload)
	assert.Equal(t, "test-cluster", sessions[0].Cluster)
	assert.Equal(t, largePayload.FirstField, sessions[0].Payload.FirstField)
}

// TestChunksCookieIsKeyedInCreateSession verifies that CreateSession creates a per-session
// keyed chunks-count cookie.
//
// This prevents collisions when multiple sessions co-exist (e.g. multi-cluster), where two
// different sessions might be chunked at the same time. Without keying, one session would
// overwrite the other's chunk-count metadata and break session restoration.
//
// NOTE: This test failed on master prior to the fix for https://github.com/kiali/kiali/issues/8990.
func TestChunksCookieIsKeyedInCreateSession(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	clockTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize*2),
	}

	expiresTime := clockTime.Add(time.Hour)
	cookies := newValidSessionCookies(t, persistor, "cluster1", conf.Auth.Strategy, expiresTime, largePayload)

	expectedChunksCookieName := sessionCookieName(NumberOfChunksCookieName, "cluster1")

	var chunksCookieName string
	for _, cookie := range cookies {
		if strings.Contains(cookie.Name, "chunks") {
			chunksCookieName = cookie.Name
			break
		}
	}

	assert.Equal(t, expectedChunksCookieName, chunksCookieName,
		"Chunks cookie should be keyed per session")
}

// TestTerminateSessionDropsKeyedChunksCookie verifies that TerminateSession cleans up all
// cookies associated with a keyed chunked session, including the keyed chunks-count cookie.
//
// This ensures logout/session-termination fully removes the session, and also avoids leaving
// stale chunk-count cookies that could interfere with later sessions.
//
// NOTE: This test failed on master prior to the fix for https://github.com/kiali/kiali/issues/8990.
func TestTerminateSessionDropsKeyedChunksCookie(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	clockTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	largePayload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize*2),
	}

	expiresTime := clockTime.Add(time.Hour)
	createdCookies := newValidSessionCookies(t, persistor, "cluster1", conf.Auth.Strategy, expiresTime, largePayload)

	terminateRequest := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	for _, cookie := range createdCookies {
		terminateRequest.AddCookie(cookie)
	}

	terminateRR := httptest.NewRecorder()
	persistor.TerminateSession(terminateRequest, terminateRR, "cluster1")

	droppedCookies := terminateRR.Result().Cookies()
	droppedCookieNames := make([]string, len(droppedCookies))
	for i, c := range droppedCookies {
		droppedCookieNames[i] = c.Name
	}

	keyedChunksCookieName := sessionCookieName(NumberOfChunksCookieName, "cluster1")
	assert.Contains(t, droppedCookieNames, keyedChunksCookieName,
		"TerminateSession should drop the keyed chunks cookie")

	assert.Contains(t, droppedCookieNames, "kiali-token-cluster1")
	assert.Contains(t, droppedCookieNames, "kiali-token-cluster1-1")
}

// TestMultipleKeyedSessionsDoNotCollide verifies that multiple keyed sessions can coexist in the
// same request even when both sessions are chunked.
//
// It proves each session has its own chunks-count cookie and that both sessions can be restored
// correctly from the combined cookie set.
//
// NOTE: This test failed on master prior to the fix for https://github.com/kiali/kiali/issues/8990.
func TestMultipleKeyedSessionsDoNotCollide(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	clockTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	expiresTime := clockTime.Add(time.Hour)

	// Ensure both sessions are chunked, with different sizes.
	cluster1Payload := testSessionPayload{
		FirstField: strings.Repeat("X", SessionCookieMaxSize*2),
	}
	cluster2Payload := testSessionPayload{
		FirstField: strings.Repeat("Y", SessionCookieMaxSize*3),
	}

	cluster1Cookies := newValidSessionCookies(t, persistor, "cluster1", conf.Auth.Strategy, expiresTime, cluster1Payload)
	cluster2Cookies := newValidSessionCookies(t, persistor, "cluster2", conf.Auth.Strategy, expiresTime, cluster2Payload)

	var chunks1CookieName string
	for _, c := range cluster1Cookies {
		if strings.Contains(c.Name, "chunks") {
			chunks1CookieName = c.Name
			break
		}
	}
	var chunks2CookieName string
	for _, c := range cluster2Cookies {
		if strings.Contains(c.Name, "chunks") {
			chunks2CookieName = c.Name
			break
		}
	}
	require.NotEmpty(chunks1CookieName, "Cluster1 should have a chunks cookie")
	require.NotEmpty(chunks2CookieName, "Cluster2 should have a chunks cookie")

	assert.Equal(t, "kiali-token-chunks-cluster1", chunks1CookieName)
	assert.Equal(t, "kiali-token-chunks-cluster2", chunks2CookieName)

	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	for _, c := range cluster1Cookies {
		request.AddCookie(c)
	}
	for _, c := range cluster2Cookies {
		request.AddCookie(c)
	}

	sData1, err := persistor.ReadSession(request, httptest.NewRecorder(), "cluster1")
	require.NoError(err)
	require.NotNil(sData1)
	require.NotNil(sData1.Payload)
	assert.Equal(t, cluster1Payload.FirstField, sData1.Payload.FirstField)

	sData2, err := persistor.ReadSession(request, httptest.NewRecorder(), "cluster2")
	require.NoError(err)
	require.NotNil(sData2)
	require.NotNil(sData2.Payload)
	assert.Equal(t, cluster2Payload.FirstField, sData2.Payload.FirstField)
}

// TestReadAllSessions_WorksWithNumericEndingKeys verifies that ReadAllSessions correctly returns
// a session whose key ends with a numeric segment (e.g. "cluster-1").
//
// This guards against implementations that try to infer "chunk #0 cookie" vs "continuation chunk cookie"
// solely from a numeric-looking cookie name suffix.
func TestReadAllSessions_WorksWithNumericEndingKeys(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-app"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = "test"

	clockTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	persistor, err := NewCookieSessionPersistor[testSessionPayload](conf)
	require.NoError(err)

	payload := testSessionPayload{FirstField: "session-for-cluster-1"}
	expiresTime := clockTime.Add(time.Hour)
	cookies := newValidSessionCookies(t, persistor, "cluster-1", conf.Auth.Strategy, expiresTime, payload)

	require.Len(cookies, 1, "Non-chunked session should have exactly 1 cookie")
	assert.Equal(t, "kiali-token-cluster-1", cookies[0].Name)

	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	request.AddCookie(cookies[0])

	readRR := httptest.NewRecorder()
	sessions, err := persistor.ReadAllSessions(request, readRR)

	require.NoError(err)
	require.Len(sessions, 1, "Should find exactly one session")
	require.NotNil(sessions[0].Payload)
	assert.Equal(t, "cluster-1", sessions[0].Cluster)
	assert.Equal(t, payload.FirstField, sessions[0].Payload.FirstField)

	assert.Empty(t, readRR.Result().Cookies(), "No cookies should be dropped")
}
