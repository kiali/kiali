package business

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
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
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/some_path"), 200, "whatever", t))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001", t))

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoInCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	conf.ExternalServices.Grafana.InClusterURL = "http://grafana.istio-system:3001"
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana.istio-system:3001", t))

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoGetError(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	_, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(anError, 401, "http://grafana-external:3001", t))

	assert.Equal(t, "error from Grafana (401): unauthorized", err.Error())
	assert.Equal(t, 503, code)
}

func TestGetGrafanaInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	_, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier("unexpected response", 200, "http://grafana-external:3001", t))

	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "json: cannot unmarshal")
	assert.Equal(t, 503, code)
}

func TestGetGrafanaInfoWithoutLeadingSlashPath(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("some_path"), 200, "http://grafana-external:3001", t))

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithTrailingSlashURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001/"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001/", t))

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithQueryParams(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001/?orgId=1"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)

	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/some_path"), 200, "http://grafana-external:3001/?orgId=1", t))

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "http://grafana-external:3001/some_path?orgId=1", info.ExternalLinks[0].URL)
}

func TestGetGrafanaInfoWithAbsoluteDashboardURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "/system/grafana/"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	conf.ExternalServices.Grafana.InClusterURL = "http://grafana.istio-system:3001"
	config.Set(conf)
	info, code, err := GetGrafanaInfo(&api.AuthInfo{Token: ""}, buildDashboardSupplier(genDashboard("/system/grafana/some_path"), 200, "http://grafana.istio-system:3001", t))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "/system/grafana/some_path", info.ExternalLinks[0].URL)
}

func buildDashboardSupplier(jSon interface{}, code int, expectURL string, t *testing.T) dashboardSupplier {
	return func(url, _ string, _ *config.Auth) ([]byte, int, error) {
		assert.Equal(t, expectURL, url)
		bytes, err := json.Marshal(jSon)
		return bytes, code, err
	}
}
