package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
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
)

func setupWorkloadList(t *testing.T, k8s *kubetest.FakeK8sClient, conf *config.Config) (*httptest.Server, *prometheustest.PromClientMock) {
	prom := new(prometheustest.PromClientMock)
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)
	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }
	// Get local cluster client for grafana
	localClusterClient := cf.GetSAClient(conf.KubernetesConfig.ClusterName)
	grafana := grafana.NewService(conf, localClusterClient)

	handler := WithFakeAuthInfo(conf, ClusterWorkloads(conf, cache, cf, cpm, prom, traceLoader, grafana, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/clusters/workloads", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, prom
}

func TestWorkloadsEndpoint(t *testing.T) {
	conf := config.NewConfig()

	mockClock()

	kubeObjects := []runtime.Object{kubetest.FakeNamespace("ns")}
	for _, obj := range business.FakeDepSyncedWithRS(conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	for _, obj := range business.FakeRSSyncedWithPods(conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	for _, obj := range business.FakePodsSyncedWithDeployments(conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	ts, _ := setupWorkloadList(t, k8s, conf)

	url := ts.URL + "/api/clusters/workloads?namespaces=ns"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
}
