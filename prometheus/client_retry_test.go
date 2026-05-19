package prometheus

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

// shortRetry is used by all retry tests to avoid real 30s waits.
const shortRetry = 5 * time.Millisecond

// newTestConf returns a minimal config pointing at the given server URL.
func newTestConf(t *testing.T, serverURL string) config.Config {
	t.Helper()
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(t, err)
	t.Cleanup(conf.Close)
	conf.ExternalServices.Prometheus.URL = serverURL
	return *conf
}

// TestNewClientWithRetrySucceedsImmediately verifies that when Prometheus is
// healthy from the first probe, the client is returned without any retries.
func TestNewClientWithRetrySucceedsImmediately(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	client, err := newClientWithRetry(context.Background(), conf, "", shortRetry)
	require.NoError(t, err)
	assert.NotNil(t, client)
}

// TestNewClientWithRetrySucceedsAfterRetries verifies that when the health
// endpoint is initially unhealthy, the function keeps retrying until it
// succeeds and then returns a valid client.
func TestNewClientWithRetrySucceedsAfterRetries(t *testing.T) {
	var probeCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Fail the first two health probes, then succeed.
		if probeCount.Add(1) <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	client, err := newClientWithRetry(context.Background(), conf, "", shortRetry)
	require.NoError(t, err)
	assert.NotNil(t, client)
	assert.GreaterOrEqual(t, probeCount.Load(), int32(3), "expected at least 3 probe attempts")
}

// TestNewClientWithRetryContextCancelled verifies that cancelling the context
// causes the function to return an error instead of retrying indefinitely.
func TestNewClientWithRetryContextCancelled(t *testing.T) {
	// Server that always returns 503 so the retry never exits on its own.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	conf := newTestConf(t, server.URL)

	client, err := newClientWithRetry(ctx, conf, "", shortRetry)
	assert.Error(t, err)
	assert.Nil(t, client)
}

// TestNewClientWithRetryUsesCustomHealthCheckURL verifies that when
// HealthCheckUrl is set, that URL is probed instead of URL + "/-/healthy".
func TestNewClientWithRetryUsesCustomHealthCheckURL(t *testing.T) {
	var customHit atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/custom/health" {
			customHit.Store(true)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	conf.ExternalServices.Prometheus.HealthCheckUrl = server.URL + "/custom/health"

	client, err := newClientWithRetry(context.Background(), conf, "", shortRetry)
	require.NoError(t, err)
	assert.NotNil(t, client)
	assert.True(t, customHit.Load(), "custom health check URL should have been probed")
}

// TestClientRefGoroutineStartupFlow simulates the full startup wiring in
// cmd/server.go: a ClientRef starts with NoopClient, a goroutine calls
// newClientWithRetry against a live httptest server, and once it connects
// the ref is upgraded via Set. Verifies the entire chain end-to-end.
func TestClientRefGoroutineStartupFlow(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	ref := NewClientRef(NewNoopClient())

	// Before the goroutine runs, the ref delegates to NoopClient.
	_, err := ref.GetBuildInfo(context.Background())
	require.ErrorIs(t, err, ErrPrometheusDisabled, "should start as NoopClient")

	// Simulate the startup goroutine from cmd/server.go.
	done := make(chan struct{})
	go func() {
		defer close(done)
		client, err := newClientWithRetry(context.Background(), conf, "", shortRetry)
		if err != nil {
			return
		}
		ref.Set(client)
	}()
	<-done

	// After the goroutine upgrades the ref, GetBuildInfo reaches the real *Client
	// which makes an HTTP call. The test server returns 200 with no Prometheus
	// JSON body, so the prometheus library returns a parse error — but crucially
	// NOT ErrPrometheusDisabled, which proves the delegate changed.
	_, err = ref.GetBuildInfo(context.Background())
	assert.NotErrorIs(t, err, ErrPrometheusDisabled, "ref should be upgraded: GetBuildInfo must not return ErrPrometheusDisabled")
}

// TestNewClientWithRetryConstructionFailure verifies that when NewClient
// construction fails (api.NewClient calls url.Parse which rejects control
// characters), the retry loop treats it as a retryable condition and keeps
// trying until the context is cancelled, rather than returning immediately or
// panicking.
func TestNewClientWithRetryConstructionFailure(t *testing.T) {
	// A null byte in the URL causes url.Parse to fail inside api.NewClient,
	// which means NewClient always returns an error regardless of connectivity.
	conf := newTestConf(t, "http://\x00invalid")

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	client, err := newClientWithRetry(ctx, conf, "", shortRetry)
	assert.Error(t, err, "should return context error after retries are exhausted")
	assert.Nil(t, client)
}
