package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
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
	info, code, err := getGrafanaInfo(func(_, _, _ string) (*core_v1.ServiceSpec, error) {
		return &core_v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []core_v1.ServicePort{
				core_v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoExternal(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.InCluster = false
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _, _ string) (*core_v1.ServiceSpec, error) {
		assert.Fail(t, "Not in cluster: should not try to get service.")
		return &core_v1.ServiceSpec{
			Ports: []core_v1.ServicePort{
				core_v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://grafana-external:3001", info.URL)
	assert.Equal(t, "the_path", info.WorkloadDashboardPath)
}

func TestGetGrafanaInfoInCluster(t *testing.T) {
	kubernetes.KialiToken = "anything"
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	conf.ExternalServices.Grafana.InCluster = true
	config.Set(conf)
	var serviceLookup bool
	info, code, err := getGrafanaInfo(func(_, _, _ string) (*core_v1.ServiceSpec, error) {
		serviceLookup = true
		return &core_v1.ServiceSpec{
			Ports: []core_v1.ServicePort{
				core_v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(dashboard, 200))
	assert.Nil(t, err)
	assert.True(t, serviceLookup)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://grafana-external:3001", info.URL)
	assert.Equal(t, "the_path", info.WorkloadDashboardPath)
}

func TestGetGrafanaInfoGetError(t *testing.T) {
	kubernetes.KialiToken = "anything"
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _, _ string) (*core_v1.ServiceSpec, error) {
		return &core_v1.ServiceSpec{
			Ports: []core_v1.ServicePort{
				core_v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier(anError, 401))
	assert.Equal(t, "error from Grafana (401): unauthorized", err.Error())
	assert.Equal(t, 500, code)
}

func TestGetGrafanaInfoInvalidDashboard(t *testing.T) {
	kubernetes.KialiToken = "anything"
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://grafana-external:3001"
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _, _ string) (*core_v1.ServiceSpec, error) {
		return &core_v1.ServiceSpec{
			Ports: []core_v1.ServicePort{
				core_v1.ServicePort{Port: 3000}}}, nil
	}, buildDashboardSupplier("unexpected response", 200))
	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "json: cannot unmarshal")
	assert.Equal(t, 500, code)
}

func buildDashboardSupplier(jSon interface{}, code int) dashboardSupplier {
	return func(_, _ string, _ string, _ bool) ([]byte, int, error) {
		bytes, err := json.Marshal(jSon)
		return bytes, code, err
	}
}
