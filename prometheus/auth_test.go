package prometheus

import (
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/polltest"
)

// TestPrometheusUseKialiTokenFileRotation tests that when UseKialiToken is set
// and the token is a file path (as happens when BearerTokenFile is set in the SA
// client's rest.Config), subsequent requests pick up rotated tokens automatically.
// This is the scenario fixed by passing BearerTokenFile instead of GetToken() in
// cmd/server.go.
func TestPrometheusUseKialiTokenFileRotation(t *testing.T) {
	var capturedAuth atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth.Store(r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}))
	defer server.Close()

	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/sa-token"
	initialToken := "initial-sa-token-abc123"
	err = os.WriteFile(tokenFile, []byte(initialToken), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Prometheus.URL = server.URL
	conf.ExternalServices.Prometheus.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Prometheus.Auth.UseKialiToken = true

	// Pass the file path as the token, simulating what cmd/server.go now does
	// when BearerTokenFile is available on the SA client's rest.Config.
	client, err := NewClient(*conf, tokenFile)
	require.NoError(t, err)
	require.NotNil(t, client)

	// Any query triggers an HTTP request to the mock server
	_, _, _ = client.api.Query(client.ctx, "up", time.Now())

	auth := capturedAuth.Load()
	require.NotNil(t, auth, "Authorization header should be captured")
	assert.Equal(t, "Bearer "+initialToken, auth.(string))

	// Rotate the SA token on disk (simulates kubelet PSAT rotation)
	rotatedToken := "rotated-sa-token-xyz789"
	err = os.WriteFile(tokenFile, []byte(rotatedToken), 0600)
	require.NoError(t, err)

	tokenRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		_, _, _ = client.api.Query(client.ctx, "up", time.Now())
		auth = capturedAuth.Load()
		return auth != nil && auth.(string) == "Bearer "+rotatedToken
	})

	assert.True(t, tokenRotated, "Rotated SA token should be sent after file rotation when UseKialiToken=true")
	assert.Equal(t, "Bearer "+rotatedToken, capturedAuth.Load().(string), "Authorization header should contain rotated token")
}

// TestPrometheusUseKialiTokenLiteralFallback tests that when UseKialiToken is set
// and the token is a plain literal (no BearerTokenFile), the literal is still sent
// correctly. This covers the fallback path in cmd/server.go for environments where
// BearerTokenFile is absent (e.g. outside a cluster).
func TestPrometheusUseKialiTokenLiteralFallback(t *testing.T) {
	var capturedAuth atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth.Store(r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}))
	defer server.Close()

	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	conf.ExternalServices.Prometheus.URL = server.URL
	conf.ExternalServices.Prometheus.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Prometheus.Auth.UseKialiToken = true

	literalToken := "static-sa-token-no-file"
	client, err := NewClient(*conf, literalToken)
	require.NoError(t, err)
	require.NotNil(t, client)

	_, _, _ = client.api.Query(client.ctx, "up", time.Now())

	auth := capturedAuth.Load()
	require.NotNil(t, auth, "Authorization header should be captured")
	assert.Equal(t, "Bearer "+literalToken, auth.(string),
		"Literal token should be sent when no BearerTokenFile is available")
}
