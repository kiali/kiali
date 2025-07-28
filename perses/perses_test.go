package perses_test

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/perses"
	"github.com/stretchr/testify/assert"
	"net/http"
	"testing"
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

func genDashboard(path string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"url": path,
		},
	}
}

func TestGetPersesInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.Enabled = false

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/some_path"), 200, "whatever", t),
	)
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetPersesInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/some_path"), 200, PERSES_URL, t),
	)

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, PERSES_URL, info.ExternalLinks[0].URL)
	assert.Equal(t, "istio", info.Project)
}

func TestGetPersesInfoInCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.ExternalURL = PERSES_URL
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig
	conf.ExternalServices.Perses.InternalURL = PERSES_URL
	conf.ExternalServices.Perses.Project = "new_project"

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/some_path"), 200, PERSES_URL, t),
	)

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, fmt.Sprintf("%s/some_path", PERSES_URL), info.ExternalLinks[0].URL)
	assert.Equal(t, "new_project", info.Project)
}

func TestGetPersesInfoGetError(t *testing.T) {
	conf := config.NewConfig()
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
	assert.Equal(t, fmt.Sprintf("%s/some_path", PERSES_URL), info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithTrailingSlashURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = "http://grafana-external:3001/"
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/some_path"), 200, PERSES_URL, t),
	)

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, fmt.Sprintf("%s/some_path", PERSES_URL), info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithQueryParams(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = fmt.Sprintf("%s/?orgId=1", PERSES_URL)
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/some_path"), 200, fmt.Sprintf("%s/?orgId=1", PERSES_URL), t),
	)

	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, fmt.Sprintf("%s/some_path?orgId=1", PERSES_URL), info.ExternalLinks[0].URL)
}

func TestGetPersesInfoWithAbsoluteDashboardURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Perses.InternalURL = ""
	conf.ExternalServices.Perses.ExternalURL = "/system/perses/"
	conf.ExternalServices.Perses.Dashboards = dashboardsConfig
	conf.ExternalServices.Perses.InternalURL = PERSES_URL

	perses := perses.NewService(conf, kubetest.NewFakeK8sClient())

	info, code, err := perses.Info(
		context.Background(),
		buildDashboardSupplier(genDashboard("/system/perses/some_path"), 200, PERSES_URL, t),
	)
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Len(t, info.ExternalLinks, 1)
	assert.Equal(t, "/system/perses/some_path", info.ExternalLinks[0].URL)
}

func buildDashboardSupplier(jSon interface{}, code int, expectURL string, t *testing.T) perses.DashboardSupplierFunc {
	return func(url, _, _ string, _ *config.Auth) ([]byte, int, string, error) {
		assert.Equal(t, expectURL, url)
		bytes, err := json.Marshal(jSon)
		return bytes, code, url, err
	}
}
