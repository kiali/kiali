package grafana_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

var dashboardsConfig = []config.GrafanaDashboardConfig{
	{
		Name: "My Dashboard",
	},
}

var anError = map[string]string{
	"message": "unauthorized",
}

func genDashboard(path string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"url": path,
		},
	}
}

func TestGetGrafanaInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = false

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/some_path"), 200, "whatever", t))

	info, code, err := svc.Info(context.Background())
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
	assert.Equal(t, "", info.DatasourceUID)
}

func TestGetGrafanaInfoInCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	conf.ExternalServices.Grafana.InternalURL = "http://grafana.istio-system:3001"
	conf.ExternalServices.Grafana.DatasourceUID = "PROMETHEUS"

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana.istio-system:3001", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
	assert.Equal(t, "PROMETHEUS", info.DatasourceUID)
}

func TestGetGrafanaInfoGetError(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(anError, 401, "http://grafana-external:3001", t))

	_, code, err := svc.Info(context.Background())

	assert.Equal(t, "error from Grafana (401): unauthorized", err.Error())
	assert.Equal(t, 503, code)
}

func TestGetGrafanaInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier("unexpected response", 200, "http://grafana-external:3001", t))

	_, code, err := svc.Info(context.Background())

	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "json: cannot unmarshal")
	assert.Equal(t, 503, code)
}

func TestGetGrafanaInfoWithoutLeadingSlashPath(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("some_path"), 200, "http://grafana-external:3001", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithTrailingSlashURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001/"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001/", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithQueryParams(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "http://grafana-external:3001/?orgId=1"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001/?orgId=1", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path?orgId=1", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithAbsoluteDashboardURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.InternalURL = ""
	conf.ExternalServices.Grafana.ExternalURL = "/system/grafana/"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	conf.ExternalServices.Grafana.InternalURL = "http://grafana.istio-system:3001"

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("/system/grafana/some_path"), 200, "http://grafana.istio-system:3001", t))

	info, code, err := svc.Info(context.Background())
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "/system/grafana/some_path", info.ExternalLinks[0].URL)
}

func buildDashboardSupplier(jSon interface{}, code int, expectURL string, t *testing.T) grafana.DashboardSupplierFunc {
	return func(url, _ string, _ *config.Auth) ([]byte, int, error) {
		assert.Equal(t, expectURL, url)
		bytes, err := json.Marshal(jSon)
		return bytes, code, err
	}
}

func TestGrafanaOAuth2_TokenCachePreservedAcrossRequests(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "grafana-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	var backendRequests int32
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&backendRequests, 1)
		assert.Equal(t, "Bearer grafana-token", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.ExternalURL = backend.URL
	conf.ExternalServices.Grafana.InternalURL = backend.URL
	conf.ExternalServices.Grafana.Auth.Type = config.AuthTypeOAuth2
	conf.ExternalServices.Grafana.Auth.OAuth2 = config.OAuth2Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		TokenURL:     tokenServer.URL,
		AuthStyle:    "params",
	}
	conf.ExternalServices.Grafana.Dashboards = []config.GrafanaDashboardConfig{{Name: "test"}}

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	for i := 0; i < 5; i++ {
		_, _, err := svc.Info(context.Background())
		require.NoError(t, err)
	}

	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests),
		"token should be fetched only once and cached across multiple Info() calls")
	assert.Equal(t, int32(5), atomic.LoadInt32(&backendRequests),
		"backend should be called on each Info() invocation")
}

func TestGrafanaOAuth2_TokenRefreshedAfterExpiry(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": fmt.Sprintf("token-%d", atomic.LoadInt32(&tokenRequests)),
			"expires_in":   1,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.ExternalURL = backend.URL
	conf.ExternalServices.Grafana.InternalURL = backend.URL
	conf.ExternalServices.Grafana.Auth.Type = config.AuthTypeOAuth2
	conf.ExternalServices.Grafana.Auth.OAuth2 = config.OAuth2Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		TokenURL:     tokenServer.URL,
		AuthStyle:    "params",
	}
	conf.ExternalServices.Grafana.Dashboards = []config.GrafanaDashboardConfig{{Name: "test"}}

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	_, _, err = svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests))

	// Wait for token to expire (1s TTL + buffer)
	time.Sleep(1100 * time.Millisecond)

	_, _, err = svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(2), atomic.LoadInt32(&tokenRequests),
		"token should be refreshed after expiry")
}

func TestGrafanaOAuth2_ClientSecretRotation(t *testing.T) {
	secretFile := t.TempDir() + "/client-secret"
	require.NoError(t, os.WriteFile(secretFile, []byte("original-secret"), 0600))

	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		_ = r.ParseForm()
		secret := r.Form.Get("client_secret")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "token-for-" + secret,
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	var lastAuth string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.ExternalURL = backend.URL
	conf.ExternalServices.Grafana.InternalURL = backend.URL
	conf.ExternalServices.Grafana.Auth.Type = config.AuthTypeOAuth2
	conf.ExternalServices.Grafana.Auth.OAuth2 = config.OAuth2Config{
		ClientID:     "test-client",
		ClientSecret: config.Credential(secretFile),
		TokenURL:     tokenServer.URL,
		AuthStyle:    "params",
	}
	conf.ExternalServices.Grafana.Dashboards = []config.GrafanaDashboardConfig{{Name: "test"}}

	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	// First call uses original secret
	_, _, err = svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-for-original-secret", lastAuth)
	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests))

	// Rotate the secret file and simulate a 401 on the backend to trigger token refresh
	require.NoError(t, os.WriteFile(secretFile, []byte("rotated-secret"), 0600))

	// Simulate backend returning 401 to force token invalidation and refresh
	backend.Close()
	var backendCalls int32
	backend = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := atomic.AddInt32(&backendCalls, 1)
		if call == 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		lastAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	// Reconfigure the service to point to the new backend
	conf.ExternalServices.Grafana.ExternalURL = backend.URL
	conf.ExternalServices.Grafana.InternalURL = backend.URL
	svc, err = grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	_, _, err = svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-for-rotated-secret", lastAuth,
		"after 401 retry, the rotated secret should be used for the new token")
}
