package grafana_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

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

// newOAuth2GrafanaSvc builds a Grafana service wired to the given tokenServerURL and backendURL
// with a static client secret. Registers server cleanup with t.Cleanup.
func newOAuth2GrafanaSvc(t *testing.T, tokenServerURL, backendURL string, clientSecret config.Credential) *grafana.Service {
	t.Helper()
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.ExternalURL = backendURL
	conf.ExternalServices.Grafana.InternalURL = backendURL
	conf.ExternalServices.Grafana.Auth.Type = config.AuthTypeOAuth2
	conf.ExternalServices.Grafana.Auth.OAuth2 = config.OAuth2Config{
		ClientID:     "test-client",
		ClientSecret: clientSecret,
		TokenURL:     tokenServerURL,
		AuthStyle:    "params",
	}
	conf.ExternalServices.Grafana.Dashboards = []config.GrafanaDashboardConfig{{Name: "test"}}
	svc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	return svc
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

	svc := newOAuth2GrafanaSvc(t, tokenServer.URL, backend.URL, "test-secret")

	for i := 0; i < 5; i++ {
		_, _, err := svc.Info(context.Background())
		require.NoError(t, err)
	}

	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests),
		"token should be fetched only once and cached across multiple Info() calls")
	assert.Equal(t, int32(5), atomic.LoadInt32(&backendRequests),
		"backend should be called on each Info() invocation")
}

func TestGrafanaOAuth2_NewServicePicksUpCurrentSecretFile(t *testing.T) {
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

	var lastAuth atomic.Value
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastAuth.Store(r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	svc := newOAuth2GrafanaSvc(t, tokenServer.URL, backend.URL, config.Credential(secretFile))

	// First call uses original secret
	_, _, err := svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-for-original-secret", lastAuth.Load())
	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenRequests))

	// Rotate the secret file; next service construction will pick up the new secret
	require.NoError(t, os.WriteFile(secretFile, []byte("rotated-secret"), 0600))

	backend.Close()
	var backendCalls int32
	backend = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := atomic.AddInt32(&backendCalls, 1)
		if call == 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		lastAuth.Store(r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"url":"/d/test"}]`))
	}))
	defer backend.Close()

	svc = newOAuth2GrafanaSvc(t, tokenServer.URL, backend.URL, config.Credential(secretFile))
	tokenRequestsBefore := atomic.LoadInt32(&tokenRequests)

	_, _, err = svc.Info(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-for-rotated-secret", lastAuth.Load(),
		"after 401 retry, the rotated secret should be used for the new token")
	// New service has cold cache: fetches once, gets 401, fetches again with rotated secret = 2 token requests.
	assert.Equal(t, tokenRequestsBefore+2, atomic.LoadInt32(&tokenRequests),
		"cold cache + 401 retry should have triggered exactly 2 token fetches with the rotated secret")
}
