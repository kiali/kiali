package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns1"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns2"}},
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

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)
	return func() (*prometheus.Client, error) { return prom, nil }
}

func TestCreateMetricsServiceForNamespace(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), &api.AuthInfo{Token: "test"}))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, "ns1")

	assert.NotNil(srv)
	assert.NotNil(info)
	assert.Equal("ns1", info.Name)
	assert.Equal(http.StatusOK, w.Code)
}

func TestCreateMetricsServiceForNamespaceForbidden(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), &api.AuthInfo{Token: "test"}))

	w := httptest.NewRecorder()
	srv, info := createMetricsServiceForNamespace(w, req, prom, "nsNil")

	assert.Nil(srv)
	assert.Nil(info)
	assert.Equal(http.StatusForbidden, w.Code)
}

func TestCreateMetricsServiceForSeveralNamespaces(t *testing.T) {
	assert := assert.New(t)
	prom := utilSetupMocks(t)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), &api.AuthInfo{Token: "test"}))

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

func TestClusterNameFromQuery(t *testing.T) {
	assert := assert.New(t)

	query := url.Values{"cluster": []string{"east"}}
	assert.Equal("east", clusterNameFromQuery(query))

	query = url.Values{}
	assert.Equal(config.Get().KubernetesConfig.ClusterName, clusterNameFromQuery(query))

	query = url.Values{"notcluster": []string{"east"}}
	assert.Equal(config.Get().KubernetesConfig.ClusterName, clusterNameFromQuery(query))
}
