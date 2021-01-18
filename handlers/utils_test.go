package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// Setup mock
func utilSetupMocks(t *testing.T) (promClientSupplier, *prometheustest.PromAPIMock, *kubetest.K8SClientMock) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespace", "ns1").Return(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns1"}}, nil)
	k8s.On("GetNamespace", "ns2").Return(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns2"}}, nil)
	k8s.On("GetNamespace", "nsNil").Return((*core_v1.Namespace)(nil), errors.New("no privileges"))

	promAPI := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
		return nil, nil, nil
	}
	prom.Inject(promAPI)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)
	return func() (*prometheus.Client, error) { return prom, nil }, promAPI, k8s
}

func TestCreateMetricsServiceForNamespace(t *testing.T) {
	assert := assert.New(t)
	prom, _, _ := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(context.WithValue(req.Context(), "authInfo", &api.AuthInfo{Token: "test"}))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, "ns1")

	assert.NotNil(srv)
	assert.NotNil(info)
	assert.Equal("ns1", info.Name)
	assert.Equal(http.StatusOK, w.Code)
}

func TestCreateMetricsServiceForNamespaceForbidden(t *testing.T) {
	assert := assert.New(t)
	prom, _, _ := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(context.WithValue(req.Context(), "authInfo", &api.AuthInfo{Token: "test"}))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, "nsNil")

	assert.Nil(srv)
	assert.Nil(info)
	assert.Equal(http.StatusForbidden, w.Code)
}

func TestCreateMetricsServiceForSeveralNamespaces(t *testing.T) {
	assert := assert.New(t)
	prom, _, _ := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(context.WithValue(req.Context(), "authInfo", &api.AuthInfo{Token: "test"}))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespaces(w, req, prom, []string{"ns1", "ns2", "nsNil"})

	assert.NotNil(srv)
	assert.Len(info, 3)
	assert.Equal(http.StatusOK, w.Code)
	assert.Equal("ns1", info["ns1"].info.Name)
	assert.Nil(info["ns1"].err)
	assert.Equal("ns2", info["ns2"].info.Name)
	assert.Nil(info["ns2"].err)
	assert.Nil(info["nsNil"].info)
	assert.Equal("no privileges", info["nsNil"].err.Error())
}
