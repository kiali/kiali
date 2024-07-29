package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

type nsForbidden struct {
	kubernetes.ClientInterface
	forbiddenNamespace string
}

func (n *nsForbidden) GetNamespace(name string) (*core_v1.Namespace, error) {
	if name == n.forbiddenNamespace {
		return nil, errors.New("no privileges")
	}
	return n.ClientInterface.GetNamespace(name)
}

// Setup mock
func utilSetupMocks(t *testing.T, additionalObjs ...runtime.Object) promClientSupplier {
	t.Helper()
	conf := config.NewConfig()
	// TODO: Find a way to mock out the istio endpoints so that the most used case can be tested by default.
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	objs := []runtime.Object{
		kubetest.FakeNamespace("ns1"),
		kubetest.FakeNamespace("ns2"),
	}
	objs = append(objs, additionalObjs...)
	k := kubetest.NewFakeK8sClient(objs...)
	k8s := &nsForbidden{k, "nsNil"}

	promAPI := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
		return nil
	}
	prom.Inject(promAPI)
	business.WithProm(prom)

	business.SetupBusinessLayer(t, k8s, *conf)
	return func() (*prometheus.Client, error) { return prom, nil }
}

func TestCreateMetricsServiceForNamespace(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, models.Namespace{Name: "ns1", Cluster: config.Get().KubernetesConfig.ClusterName})

	assert.NotNil(srv)
	assert.NotNil(info)
	assert.Equal("ns1", info.Name)
	assert.Equal(http.StatusOK, w.Code)
}

func TestCreateMetricsServiceForNamespaceForbidden(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, models.Namespace{Name: "nsNil", Cluster: config.Get().KubernetesConfig.ClusterName})

	assert.Nil(srv)
	assert.Nil(info)
	assert.Equal(http.StatusForbidden, w.Code)
}

func TestCreateMetricsServiceForSeveralNamespaces(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespaces(w, req, prom, []models.Namespace{{Name: "ns1"}, {Name: "ns2"}, {Name: "nsNil"}})

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

func TestClusterNameFromQuery(t *testing.T) {
	assert := assert.New(t)
	conf := config.Get()

	query := url.Values{"clusterName": []string{"east"}}
	assert.Equal("east", clusterNameFromQuery(query))

	query = url.Values{}
	assert.Equal(conf.KubernetesConfig.ClusterName, clusterNameFromQuery(query))

	query = url.Values{"notcluster": []string{"east"}}
	assert.Equal(conf.KubernetesConfig.ClusterName, clusterNameFromQuery(query))
}
