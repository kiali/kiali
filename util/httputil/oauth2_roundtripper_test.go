package httputil

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestOAuth2RoundTripper_InjectsBearer(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "client_credentials", r.FormValue("grant_type"))
		assert.Equal(t, "my-client", r.FormValue("client_id"))
		assert.Equal(t, "my-secret", r.FormValue("client_secret"))
		assert.Equal(t, "scope1 scope2", r.FormValue("scope"))
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "test-token-123",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "cached-token",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "token",
			ExpiresIn:   1,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid_client"}`))
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
	assert.Contains(t, err.Error(), "401")
}

func TestOAuth2RoundTripper_ConcurrentSafety(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		time.Sleep(50 * time.Millisecond)
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "concurrent-token",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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

	assert.LessOrEqual(t, atomic.LoadInt32(&tokenRequests), int32(3))
}

func TestNewAuthRoundTripper_ReturnsOAuth2RT(t *testing.T) {
	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "slow-token",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
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
	assert.Contains(t, err.Error(), "context deadline exceeded")
}

func TestOAuth2RoundTripper_UnsupportedTokenType(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "some-token",
			ExpiresIn:   3600,
			TokenType:   "MAC",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
		},
	}
	conf := config.NewConfig()

	rt := newOAuth2RoundTripper(conf, auth, http.DefaultTransport)
	req, _ := http.NewRequest("GET", "http://localhost", nil)
	_, err := rt.RoundTrip(req)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported token_type")
}

func TestOAuth2RoundTripper_NoScopeWhenEmpty(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		_, hasScope := r.Form["scope"]
		assert.False(t, hasScope, "scope param should not be sent when no scopes configured")
		json.NewEncoder(w).Encode(oauth2TokenResponse{
			AccessToken: "no-scope-token",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		})
	}))
	defer tokenServer.Close()

	auth := &config.Auth{
		Type: config.AuthTypeOAuth2,
		OAuth2: config.OAuth2Auth{
			TokenURL:     tokenServer.URL,
			ClientID:     "id",
			ClientSecret: "secret",
			Scopes:       nil,
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
