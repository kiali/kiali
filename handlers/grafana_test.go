package handlers

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

func TestGetGrafanaInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.DisplayLink = false
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, func(_, _ string) (string, error) {
		return "/dash", nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetGrafanaInfoFromOpenshift(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, func(_, _ string) (string, error) {
		return "/dash", nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromopenshift", info.URL)
}

func TestGetGrafanaInfoFromService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (string, error) {
		return "", errors.New("")
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, func(_, _ string) (string, error) {
		return "/dash", nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromservice:3000", info.URL)
}

func TestGetGrafanaInfoFromConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Grafana.URL = "http://fromconfig:3001"
	config.Set(conf)
	info, code, err := getGrafanaInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, func(_, _ string) (string, error) {
		return "/dash", nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromconfig:3001", info.URL)
}

func TestGetGrafanaInfoNoExternalIP(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	_, code, err := getGrafanaInfo(func(_, _ string) (string, error) {
		return "", errors.New("")
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	}, func(_, _ string) (string, error) {
		return "/dash", nil
	})
	assert.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, code)
}
