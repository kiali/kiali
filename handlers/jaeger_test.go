package handlers

import (
	"errors"
	"net/http"
	"testing"

	"github.com/kiali/swscore/config"
	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
)

func TestGetJaegerInfoDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.Jaeger.DisplayLink = false
	config.Set(conf)
	info, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusNoContent, code)
	assert.Nil(t, info)
}

func TestGetJaegerInfoFromOpenshift(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ClusterIP: "fromservice",
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromopenshift", info.URL)
}

func TestGetJaegerInfoFromService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "", errors.New("")
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromservice:3000", info.URL)
}

func TestGetJaegerInfoFromConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.Jaeger.URL = "http://fromconfig:3001"
	config.Set(conf)
	info, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "http://fromopenshift", nil
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"fromservice"},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://fromconfig:3001", info.URL)
}

func TestGetJaegerInfoNoPort(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	info, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "", errors.New("")
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{"10.0.0.1"},
			Ports:       []v1.ServicePort{}}, nil
	})
	assert.Nil(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "http://10.0.0.1:80", info.URL)
}

func TestGetJaegerInfoNoExternalIP(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	_, code, err := getJaegerInfo(func(_, _ string) (string, error) {
		return "", errors.New("")
	}, func(_, _ string) (*v1.ServiceSpec, error) {
		return &v1.ServiceSpec{
			ExternalIPs: []string{},
			Ports: []v1.ServicePort{
				v1.ServicePort{Port: 3000}}}, nil
	})
	assert.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, code)
}
