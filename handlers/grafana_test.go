package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

var dashboard = []map[string]interface{}{
	map[string]interface{}{
		"url": "/the_path",
	},
}

var dashboardsConfig = []config.GrafanaDashboardConfig{
	config.GrafanaDashboardConfig{
		Name: "My Dashboard",
	},
}

var anError = map[string]string{
	"message": "unauthorized",
}

func TestGetGrafanaInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.Enabled = false
	config.Set(conf)
	info, code, err := getGrafanaInfo("", buildDashboardSupplier(dashboard, 200, "whatever", t))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)
	info, code, err := getGrafanaInfo("", buildDashboardSupplier(dashboard, 200, "http://grafana-external:3001", t))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.Dashboards, 1)
	assert.Equal(t, "http://grafana-external:3001/the_path", info.Dashboards[0].URL)
}

func TestGetGrafanaInfoInCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	conf.ExternalServices.Grafana.InClusterURL = "http://grafana.istio-system:3001"
	config.Set(conf)
	info, code, err := getGrafanaInfo("", buildDashboardSupplier(dashboard, 200, "http://grafana.istio-system:3001", t))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://grafana-external:3001/the_path", info.Dashboards[0].URL)
}

func TestGetGrafanaInfoGetError(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)
	_, code, err := getGrafanaInfo("", buildDashboardSupplier(anError, 401, "http://grafana-external:3001", t))
	assert.Equal(t, "error from Grafana (401): unauthorized", err.Error())
	assert.Equal(t, 503, code)
}

func TestGetGrafanaInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.Dashboards = dashboardsConfig
	config.Set(conf)
	_, code, err := getGrafanaInfo("", buildDashboardSupplier("unexpected response", 200, "http://grafana-external:3001", t))
	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "json: cannot unmarshal")
	assert.Equal(t, 503, code)
}

func buildDashboardSupplier(jSon interface{}, code int, expectURL string, t *testing.T) dashboardSupplier {
	return func(url, _ string, _ *config.Auth) ([]byte, int, error) {
		assert.Equal(t, expectURL, url)
		bytes, err := json.Marshal(jSon)
		return bytes, code, err
	}
}
