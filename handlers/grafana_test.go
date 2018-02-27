package handlers

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/swift-sunshine/swscore/config"
	"k8s.io/api/core/v1"
)

func TestGetGrafanaURLFromService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getGrafanaInfo(func() (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromservice:3000", info.URL)
	assert.Equal(t, "svc.cluster.local", info.VariablesSuffix)
}

func TestGetGrafanaURLFromConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.GrafanaServiceURL = "http://fromconfig:3001"
	config.Set(conf)
	info, code, err := getGrafanaInfo(func() (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromconfig:3001", info.URL)
	assert.Equal(t, "svc.cluster.local", info.VariablesSuffix)
}

func TestGetGrafanaURLNoPort(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	_, code, err := getGrafanaInfo(func() (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "10.0.0.1",
			Ports:     []v1.ServicePort{}}, nil
	})
	assert.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, code)
}

func TestGetGrafanaURLNoClusterIP(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	_, code, err := getGrafanaInfo(func() (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, code)
}
