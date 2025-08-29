package perses_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("istio"), 200, "whatever", t),
	)
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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("istio"), 200, PERSES_URL, t),
	)

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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	_, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(anError, 401, PERSES_URL, t),
	)

	assert.Equal(t, "error from Perses (401): unauthorized", err.Error())
	assert.Equal(t, 503, code)
}

func TestGetPersesInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	_, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier("unexpected response", 200, PERSES_URL, t),
	)

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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("some_path"), 200, PERSES_URL, t),
	)

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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("istio"), 200, "http://perses-external:4001", t),
	)

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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("istio"), 200, fmt.Sprintf("%s/?orgId=1", PERSES_URL), t),
	)

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

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("istio"), 200, "/system/perses/", t),
	)
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "/system/perses/", info.ExternalLinks[0].URL)
}

func buildDashboardSupplier(jsonData interface{}, code int, expectURL string, t *testing.T) perses.DashboardSupplierFunc {
	return func(connection perses.PersesConnectionInfo, _, _ string, _ *config.Auth) ([]byte, int, string, error) {
		bytes, err := json.Marshal(jsonData)
		extUrl := fmt.Sprintf("%s%s", connection.BaseExternalURL, connection.ExternalURLParams)
		assert.Equal(t, expectURL, extUrl)
		return bytes, code, extUrl, err
	}
}
