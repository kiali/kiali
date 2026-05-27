package httputil

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/kiali/kiali/config"
)

func TestOAuth2RoundTripper_InjectsBearer(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "test-token-123",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "my-client",
			ClientSecret: "my-secret",
			Scopes:       []string{"scope1", "scope2"},
		},
	}
	conf := config.NewConfig()

	var capturedAuth string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", backend.URL, nil)
	resp, err := rt.RoundTrip(req)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "Bearer test-token-123", capturedAuth)
	resp.Body.Close()
}

func TestOAuth2RoundTripper_CachesToken(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "cached-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)

	for i := 0; i < 5; i++ {
		req, _ := http.NewRequest("GET", backend.URL, nil)
		resp, err := rt.RoundTrip(req)
		require.NoError(t, err)
		resp.Body.Close()
	}

	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests))
}

func TestOAuth2RoundTripper_RefreshesExpiredToken(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "token",
			"expires_in":   1,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)

	req, _ := http.NewRequest("GET", backend.URL, nil)
	resp, err := rt.RoundTrip(req)
	require.NoError(t, err)
	resp.Body.Close()

	time.Sleep(1100 * time.Millisecond)

	req, _ = http.NewRequest("GET", backend.URL, nil)
	resp, err = rt.RoundTrip(req)
	require.NoError(t, err)
	resp.Body.Close()

	assert.Equal(t, int32(2), atomic.LoadInt32(&tokenRequests))
}

func TestOAuth2RoundTripper_TokenEndpointError(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"invalid_client"}`))
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "bad-secret",
		},
	}
	conf := config.NewConfig()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", "http://localhost", nil)
	_, err := rt.RoundTrip(req)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "oauth2")
}

func TestOAuth2RoundTripper_ConcurrentSafety(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		time.Sleep(50 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "concurrent-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest("GET", backend.URL, nil)
			resp, err := rt.RoundTrip(req)
			assert.NoError(t, err)
			if resp != nil {
				resp.Body.Close()
			}
		}()
	}
	wg.Wait()
}

func TestNewAuthRoundTripper_ReturnsOAuth2RT(t *testing.T) {
	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     "https://example.com/token",
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	rt := newAuthRoundTripper(conf, auth, http.DefaultTransport)
	_, ok := rt.(*oauth2RoundTripper)
	assert.True(t, ok, "expected oauth2RoundTripper for AuthTypeOAuth2")
}

func TestOAuth2RoundTripper_ContextCancellation(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "slow-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, "GET", "http://localhost", nil)
	_, err := rt.RoundTrip(req)

	require.Error(t, err)
}

func TestOAuth2RoundTripper_401RetryInvalidatesToken(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "refreshed-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	var callCount int32
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&callCount, 1) == 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", backend.URL, nil)
	resp, err := rt.RoundTrip(req)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()
	assert.Equal(t, int32(2), atomic.LoadInt32(&tokenRequests))
}

func TestOAuth2RoundTripper_AudienceParam(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		assert.Equal(t, "https://prometheus.azure.com", r.FormValue("audience"))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "aud-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
			Audience:     "https://prometheus.azure.com",
		},
	}
	conf := config.NewConfig()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", backend.URL, nil)
	resp, err := rt.RoundTrip(req)
	require.NoError(t, err)
	resp.Body.Close()
}

func TestTokenNearExpiry(t *testing.T) {
	cases := []struct {
		name        string
		expiry      time.Time
		originalTTL time.Duration
		expected    bool
	}{
		{"zero expiry never near", time.Time{}, 1 * time.Hour, false},
		{"far future not near", time.Now().Add(1 * time.Hour), 1 * time.Hour, false},
		{"5 seconds out is near with 1h TTL", time.Now().Add(5 * time.Second), 1 * time.Hour, true},
		{"already expired", time.Now().Add(-1 * time.Second), 1 * time.Hour, true},
		{"half remaining with short TTL still not near", time.Now().Add(30 * time.Second), 1 * time.Minute, false},
		{"within 10% of original TTL", time.Now().Add(5 * time.Second), 1 * time.Minute, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tok := &oauth2.Token{Expiry: tc.expiry}
			assert.Equal(t, tc.expected, tokenNearExpiry(tok, tc.originalTTL))
		})
	}
}

func TestMapAuthStyle(t *testing.T) {
	assert.Equal(t, oauth2.AuthStyleInParams, mapAuthStyle("params"))
	assert.Equal(t, oauth2.AuthStyleInHeader, mapAuthStyle("header"))
	assert.Equal(t, oauth2.AuthStyleAutoDetect, mapAuthStyle(""))
	assert.Equal(t, oauth2.AuthStyleAutoDetect, mapAuthStyle("unknown"))
}

func TestOAuth2RoundTripper_SecretRotationOn401(t *testing.T) {
	secretFile := t.TempDir() + "/client-secret"
	os.WriteFile(secretFile, []byte("old-secret"), 0600)

	var tokenCalls atomic.Int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		secret := r.Form.Get("client_secret")
		call := tokenCalls.Add(1)
		if call == 1 {
			assert.Equal(t, "old-secret", secret)
			// Simulate secret rotation between first and retry attempt
			os.WriteFile(secretFile, []byte("new-secret"), 0600)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid_client"})
			return
		}
		assert.Equal(t, "new-secret", secret)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "rotated-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Config{
			ClientID:     "test-client",
			ClientSecret: config.Credential(secretFile),
			TokenURL:     tokenServer.URL,
			AuthStyle:    "params",
		},
	}
	conf := config.NewConfig()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer rotated-token", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", backend.URL, nil)
	resp, err := rt.RoundTrip(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, int32(2), tokenCalls.Load())
}
