package perses_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/perses"
)

const PERSES_URL = "http://perses-external:4001"

var dashboardsConfig = []config.GrafanaDashboardConfig{
	{
		Name: "My Dashboard",
	},
}

var anError = map[string]string{
	"message": "unauthorized",
}

func genDashboard(project string) map[string]interface{} {
	return map[string]interface{}{
		"kind": "Dashboard",
		"metadata": map[string]interface{}{
			"name":      "istio-service-dashboard",
			"createdAt": "2025-07-29T11:28:52.089767152Z",
			"updatedAt": "2025-07-29T13:31:53.641344984Z",
			"version":   247,
			"project":   project,
		},
		"spec": map[string]interface{}{
			"display": map[string]interface{}{
				"name": "Istio Service Dashboard",
			},
		},
	}
}

func TestGetPersesInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = false

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("istio"), 200, "whatever", t))

	info, code, err := svc.Info(context.Background())
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetPersesInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("istio"), 200, PERSES_URL, t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, PERSES_URL, info.ExternalLinks[0].URL)
	assert.Equal(t, "istio", info.Project)
}

func TestGetPersesInfoGetError(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(anError, 401, PERSES_URL, t))

	_, code, err := svc.Info(context.Background())

	assert.Equal(t, "error from Perses (401): unauthorized", err.Error())
	assert.Equal(t, 503, code)
}

func TestGetPersesInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier("unexpected response", 200, PERSES_URL, t))

	_, code, err := svc.Info(context.Background())

	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "json: cannot unmarshal")
	assert.Equal(t, 503, code)
}

func TestGetPersesInfoWithoutLeadingSlashPath(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("some_path"), 200, PERSES_URL, t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, PERSES_URL, info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithTrailingSlashURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = "http://perses-external:4001"
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("istio"), 200, "http://perses-external:4001", t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "istio", info.Project)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, PERSES_URL, info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithQueryParams(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = fmt.Sprintf("%s/?orgId=1", PERSES_URL)
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("istio"), 200, fmt.Sprintf("%s/?orgId=1", PERSES_URL), t))

	info, code, err := svc.Info(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, fmt.Sprintf("%s/?orgId=1", PERSES_URL), info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithAbsoluteDashboardURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = "/system/perses/"
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig
	conf.ExternalServices.Perses.InternalURL = PERSES_URL

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)
	svc.SetDashboardSupplier(buildDashboardSupplier(genDashboard("istio"), 200, "/system/perses/", t))

	info, code, err := svc.Info(context.Background())
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "/system/perses/", info.ExternalLinks[0].URL)
}

func TestGetAuthUseKialiTokenPrefersTokenFile(t *testing.T) {
	tokenFile := "/var/run/secrets/kubernetes.io/serviceaccount/token"
	fakeClient := &kubetest.FakeK8sClient{
		Token: "static-snapshot-token",
		KubeClusterInfo: kubernetes.ClusterInfo{
			ClientConfig: &rest.Config{BearerTokenFile: tokenFile},
		},
	}

	conf := config.NewConfig()
	conf.ExternalServices.Perses.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Perses.Auth.UseKialiToken = true

	svc, err := perses.NewService(conf, fakeClient)
	require.NoError(t, err)
	auth := svc.GetAuth(context.Background())

	assert.Equal(t, config.Credential(tokenFile), auth.Token,
		"Should prefer BearerTokenFile over static GetToken()")
}

func TestGetAuthUseKialiTokenFallsBackToStaticToken(t *testing.T) {
	fakeClient := &kubetest.FakeK8sClient{
		Token: "static-snapshot-token",
		KubeClusterInfo: kubernetes.ClusterInfo{
			ClientConfig: &rest.Config{},
		},
	}

	conf := config.NewConfig()
	conf.ExternalServices.Perses.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Perses.Auth.UseKialiToken = true

	svc, err := perses.NewService(conf, fakeClient)
	require.NoError(t, err)
	auth := svc.GetAuth(context.Background())

	assert.Equal(t, config.Credential("static-snapshot-token"), auth.Token,
		"Should fall back to GetToken() when BearerTokenFile is empty")
}

func TestGetAuthUseKialiTokenNilClientConfig(t *testing.T) {
	fakeClient := &kubetest.FakeK8sClient{
		Token:           "static-snapshot-token",
		KubeClusterInfo: kubernetes.ClusterInfo{},
	}

	conf := config.NewConfig()
	conf.ExternalServices.Perses.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Perses.Auth.UseKialiToken = true

	svc, err := perses.NewService(conf, fakeClient)
	require.NoError(t, err)
	auth := svc.GetAuth(context.Background())

	assert.Equal(t, config.Credential("static-snapshot-token"), auth.Token,
		"Should fall back to GetToken() when ClientConfig is nil")
}

// TestPersesOAuth2_TokenCachePreservedAcrossRequests verifies that the cached http.Client
// created by NewService when OAuth2 auth is configured reuses the same token across multiple
// Info() calls rather than fetching a new token on every request.
//
// What this test covers:
//   - The s.httpClient != nil branch in checkDashboard is reached when OAuth2 is configured.
//   - The oauth2RoundTripper inside that client caches the token and does not call the token
//     endpoint more than once for a long-lived token (expires_in=3600).
//
// What this test does NOT cover (already covered at the oauth2RoundTripper unit level in
// util/httputil/oauth2_roundtripper_test.go):
//   - Token refresh after expiry.
//   - Token invalidation and re-fetch after a 401 from the backend.
//   - Client secret rotation (reading an updated credential file).
func TestPersesOAuth2_TokenCachePreservedAcrossRequests(t *testing.T) {
	var tokenRequests int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&tokenRequests, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "perses-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		})
	}))
	defer tokenServer.Close()

	var backendRequests int32
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&backendRequests, 1)
		assert.Equal(t, "Bearer perses-token", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(genDashboard("test-project"))
	}))
	defer backend.Close()

	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.ExternalURL = backend.URL
	conf.ExternalServices.Perses.InternalURL = backend.URL
	conf.ExternalServices.Perses.Project = "test-project"
	conf.ExternalServices.Perses.Auth.Type = config.AuthTypeOAuth2
	conf.ExternalServices.Perses.Auth.OAuth2 = config.OAuth2Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		TokenURL:     tokenServer.URL,
		AuthStyle:    "params",
	}
	conf.ExternalServices.Perses.Dashboards = []config.GrafanaDashboardConfig{{Name: "test"}}

	svc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
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

func buildDashboardSupplier(jsonData interface{}, code int, expectURL string, t *testing.T) perses.DashboardSupplierFunc {
	return func(connection perses.PersesConnectionInfo, _, _ string, _ *config.Auth) ([]byte, int, string, error) {
		bytes, err := json.Marshal(jsonData)
		extUrl := fmt.Sprintf("%s%s", connection.BaseExternalURL, connection.ExternalURLParams)
		assert.Equal(t, expectURL, extUrl)
		return bytes, code, extUrl, err
	}
}
