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

const shortRetry = 5 * time.Millisecond

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

func TestLazyClientStartsWithNoopClient(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(ctx, conf, "", shortRetry)

	_, err := lc.GetBuildInfo(t.Context())
	assert.ErrorIs(t, err, ErrPrometheusDisabled, "should delegate to NoopClient before connect succeeds")
}

func TestLazyClientUpgradesOnConnect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(t.Context(), conf, "", shortRetry)

	require.Eventually(t, func() bool {
		_, err := lc.GetBuildInfo(t.Context())
		return err == nil || err != ErrPrometheusDisabled
	}, 2*time.Second, 10*time.Millisecond, "LazyClient should upgrade from NoopClient after connect")

	_, err := lc.GetBuildInfo(t.Context())
	assert.NotErrorIs(t, err, ErrPrometheusDisabled, "should no longer return ErrPrometheusDisabled")
}

func TestLazyClientRetriesUntilHealthy(t *testing.T) {
	var probeCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if probeCount.Add(1) <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(t.Context(), conf, "", shortRetry)

	require.Eventually(t, func() bool {
		_, err := lc.GetBuildInfo(t.Context())
		return err == nil || err != ErrPrometheusDisabled
	}, 2*time.Second, 10*time.Millisecond, "LazyClient should eventually connect after retries")

	assert.GreaterOrEqual(t, probeCount.Load(), int32(3), "expected at least 3 probe attempts")
}

func TestLazyClientContextCancelled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(ctx, conf, "", shortRetry)

	<-ctx.Done()
	time.Sleep(20 * time.Millisecond)

	_, err := lc.GetBuildInfo(t.Context())
	assert.ErrorIs(t, err, ErrPrometheusDisabled, "should remain as NoopClient when context is cancelled")
}

func TestLazyClientCustomHealthCheckURL(t *testing.T) {
	var customHit, defaultHit atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/custom/health" {
			customHit.Store(true)
		}
		if r.URL.Path == "/-/healthy" {
			defaultHit.Store(true)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	conf.ExternalServices.Prometheus.HealthCheckUrl = server.URL + "/custom/health"

	lc := newLazyClient(t.Context(), conf, "", shortRetry)

	require.Eventually(t, func() bool {
		_, err := lc.GetBuildInfo(t.Context())
		return err == nil || err != ErrPrometheusDisabled
	}, 2*time.Second, 10*time.Millisecond)

	assert.True(t, customHit.Load(), "custom health check URL should have been probed")
	assert.False(t, defaultHit.Load(), "default /-/healthy should not have been probed when HealthCheckUrl is set")
}

func TestLazyClientConstructionFailure(t *testing.T) {
	conf := newTestConf(t, "http://\x00invalid")

	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	lc := newLazyClient(ctx, conf, "", shortRetry)

	<-ctx.Done()
	time.Sleep(20 * time.Millisecond)

	_, err := lc.GetBuildInfo(t.Context())
	assert.ErrorIs(t, err, ErrPrometheusDisabled, "should remain as NoopClient when construction always fails")
}

func TestLazyClientAPINotNil(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(ctx, conf, "", shortRetry)
	require.NotNil(t, lc.API())
}

func TestLazyClientAtomicVisibility(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conf := newTestConf(t, server.URL)
	lc := newLazyClient(t.Context(), conf, "", shortRetry)

	require.Eventually(t, func() bool {
		_, err := lc.GetBuildInfo(t.Context())
		return err == nil || err != ErrPrometheusDisabled
	}, 2*time.Second, 10*time.Millisecond, "atomic swap must be visible across goroutines")
}
