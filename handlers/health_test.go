package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

func fakeService(namespace, name string) *core_v1.Service {
	return &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app": name,
			},
		},
		Spec: core_v1.ServiceSpec{
			ClusterIP: "fromservice",
			Type:      "ClusterIP",
			Selector:  map[string]string{"app": name},
			Ports: []core_v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001,
				},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000,
				},
			},
		},
	}
}

// TestNamespaceAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestClustersHealth(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), fakeService("ns", "httpbin"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, prom := setupClustersHealthEndpoint(t, k8s)

	url := ts.URL + "/api/clusters/health"
	mockClock()

	conf := config.NewConfig()

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAllRequestRates", "ns", conf.KubernetesConfig.ClusterName, "17s", util.Clock.Now()).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 1)
}

func setupClustersHealthEndpoint(t *testing.T, k8s *kubetest.FakeK8sClient) (*httptest.Server, *prometheustest.PromClientMock) {
	conf := config.NewConfig()
	prom := new(prometheustest.PromClientMock)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	cpm := &business.FakeControlPlaneMonitor{}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafana := grafana.NewService(conf, cf.GetSAHomeClusterClient())

	handler := ClusterHealth(conf, cache, cf, prom, traceLoader, discovery, cpm, grafana)
	mr := mux.NewRouter()
	mr.HandleFunc("/api/clusters/health", WithFakeAuthInfo(conf, handler))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, prom
}

func setupMockData() *osproject_v1.Project {
	mockClock()
	return &osproject_v1.Project{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "ns",
			CreationTimestamp: meta_v1.NewTime(util.Clock.Now().Add(-17 * time.Second)),
		},
	}
}
