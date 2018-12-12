package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

var dashboard = []map[string]interface{}{
	map[string]interface{}{
		"url": "the_path",
	},
}

var anError = map[string]string{
	"message": "unauthorized",
}

func TestGetGrafanaInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.DisplayLink = false
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoFromConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://fromconfig:3001"
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromconfig:3001", info.URL)
	assert.Equal(t, "the_path", info.WorkloadDashboardPath)
}

func TestGetGrafanaInfoNoExternalIP(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.NotNil(t, err)
	assert.Equal(t, http.StatusServiceUnavailable, code)
}

func TestGetGrafanaInfoGetError(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://fromconfig:3001"
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(anError, 401))
	assert.Equal(t, "Error from Grafana (401): unauthorized", err.Error())
	assert.Equal(t, 500, code)
}

func TestGetGrafanaInfoInvalidDashboard(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://fromconfig:3001"
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier("unexpected response", 200))
	assert.NotNil(t, err)
	assert.Equal(t, 500, code)
}

func buildDashboardSupplier(jSon interface{}, code int) dashboardSupplier {
	return func(_, _ string, _ string) ([]byte, int, error) {
		bytes, err := json.Marshal(jSon)
		return bytes, code, err
	}
}
