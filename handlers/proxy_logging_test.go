package handlers_test

import (
	"fmt"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
)

func setupTestLoggingServer(t *testing.T, namespace, pod string) *httptest.Server {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: namespace}},
		&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: pod, Namespace: namespace}, Status: corev1.PodStatus{Phase: corev1.PodRunning}},
	)
	prom := new(prometheustest.PromClientMock)
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)
	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }
	grafana := grafana.NewService(conf, cf.GetSAHomeClusterClient())

	handler := handlers.WithFakeAuthInfo(conf, handlers.LoggingUpdate(conf, cache, cf, cpm, prom, traceLoader, grafana, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/pods/{pod}/logging", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts
}

func TestProxyLoggingSucceeds(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging?level=info", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	assert.Equalf(200, resp.StatusCode, "response text: %s", string(body))
}

func TestMissingQueryParamFails(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	assert.Equalf(400, resp.StatusCode, "response text: %s", string(body))
}

func TestIncorrectQueryParamFails(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging?level=peasoup", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	assert.Equalf(400, resp.StatusCode, "response text: %s", string(body))
}
