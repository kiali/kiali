package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)

	handler := WithFakeAuthInfo(conf, ClusterWorkloads(conf, cache, cf, cpm, prom, traceLoader, grafanaSvc, discovery))
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

// fakePodLogStreamer is a user client that streams fixed log lines for any pod,
// or returns a fixed error (to model an API-server denial of pods/log).
type fakePodLogStreamer struct {
	kubernetes.UserClientInterface
	logs string
	err  error
}

func (l *fakePodLogStreamer) StreamPodLogs(namespace, name string, opts *corev1.PodLogOptions) (io.ReadCloser, error) {
	if l.err != nil {
		return nil, l.err
	}
	return io.NopCloser(strings.NewReader(l.logs)), nil
}

func setupPodLogsEndpoint(t *testing.T, k8s kubernetes.UserClientInterface, conf *config.Config) *httptest.Server {
	prom := new(prometheustest.PromClientMock)
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	cpm := &business.FakeControlPlaneMonitor{}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), kialiCache, conf)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)

	handler := WithFakeAuthInfo(conf, PodLogs(conf, kialiCache, cf, cpm, prom, traceLoader, grafanaSvc, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/pods/{pod}/logs", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts
}

// TestPodLogsZtunnelInaccessibleNamespace ensures the ztunnel log path (which
// fetches logs with the Kiali ServiceAccount client, so the Kubernetes API
// cannot enforce the user's RBAC) rejects users without access to the namespace,
// before any log streaming.
func TestPodLogsZtunnelInaccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("ns-victim"))
	ts := setupPodLogsEndpoint(t, newRestrictedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"}), conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/victim-pod/logs?logType=ztunnel")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestPodLogsDefaultInaccessibleNamespace ensures the default (non-ztunnel)
// log type is still denied for a user without access. The Kiali-level gate
// only covers the SA-backed log types, so for the default type the denial
// comes from the API server (pods/log on the user's own credentials), which
// surfaces as 403 via handleErrorResponse.
func TestPodLogsDefaultInaccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("ns-victim"))
	streamer := &fakePodLogStreamer{
		err:                 k8serrors.NewForbidden(schema.GroupResource{Group: "", Resource: "pods"}, "victim-pod", nil),
		UserClientInterface: newRestrictedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"}),
	}
	ts := setupPodLogsEndpoint(t, streamer, conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/victim-pod/logs")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestPodLogsUnknownLogTypeRejected ensures an unknown logType is a client
// error rather than being assigned verbatim (the SA-vs-user client choice
// keys off the log type, so an unvalidated value must not reach it).
func TestPodLogsUnknownLogTypeRejected(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	ts := setupPodLogsEndpoint(t, k8s, conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/bookinfo/pods/pod-1/logs?logType=bogus")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, string(actual))
}

// TestPodLogsAccessibleNamespace ensures the happy path is preserved: a user
// with access to the namespace still gets the pod's logs.
func TestPodLogsAccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	k8s := &fakePodLogStreamer{
		logs:                "2018-01-02T03:34:28+00:00 INFO #1 Log Message\n",
		UserClientInterface: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}
	ts := setupPodLogsEndpoint(t, k8s, conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/bookinfo/pods/details-v1-abc/logs")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "#1 Log Message")
}

func setupConfigDumpZtunnelEndpoint(t *testing.T, k8s kubernetes.UserClientInterface, conf *config.Config) (*httptest.Server, cache.KialiCache) {
	prom := new(prometheustest.PromClientMock)
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	cpm := &business.FakeControlPlaneMonitor{}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), kialiCache, conf)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)

	handler := WithFakeAuthInfo(conf, ConfigDumpZtunnel(conf, kialiCache, cf, cpm, prom, traceLoader, grafanaSvc, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/pods/{pod}/config_dump_ztunnel", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, kialiCache
}

// TestConfigDumpZtunnelInaccessibleNamespace ensures the mesh-wide ztunnel config
// dump is not served to users without access to the namespace in the URL.
func TestConfigDumpZtunnelInaccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("ns-victim"))
	ts, _ := setupConfigDumpZtunnelEndpoint(t, newRestrictedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"}), conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/ztunnel-abc/config_dump_ztunnel")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestConfigDumpZtunnelAccessibleNamespace ensures a user with access to their
// own namespace gets a 200 with a filtered body: entries of namespaces the user
// cannot see (absent from the fake client's namespace list, which is the user's
// accessible set here) must not appear in the response.
func TestConfigDumpZtunnelAccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	ts, kialiCache := setupConfigDumpZtunnelEndpoint(t, k8s, conf)

	dump := &kubernetes.ZtunnelConfigDump{
		Policies: []any{
			map[string]any{"name": "policy-bookinfo", "namespace": "bookinfo"},
			map[string]any{"name": "policy-victim", "namespace": "victim-ns"},
		},
		Services: []kubernetes.Service{
			{Name: "svc-bookinfo", Namespace: "bookinfo"},
			{Name: "svc-victim", Namespace: "victim-ns"},
		},
		Workloads: []kubernetes.Workload{
			{Name: "wl-bookinfo", Namespace: "bookinfo"},
			{Name: "wl-victim", Namespace: "victim-ns"},
		},
	}
	kialiCache.SetZtunnelDump(cluster+"ztunnel-abc", dump)

	resp, err := http.Get(ts.URL + "/api/namespaces/bookinfo/pods/ztunnel-abc/config_dump_ztunnel")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "wl-bookinfo")
	assert.Contains(t, string(actual), "svc-bookinfo")
	assert.Contains(t, string(actual), "policy-bookinfo")
	assert.NotContains(t, string(actual), "wl-victim")
	assert.NotContains(t, string(actual), "svc-victim")
	assert.NotContains(t, string(actual), "policy-victim")
}

// TestPodLogsListAuthorizedNamespace ensures a caller that is authorized
// through namespace LIST (but whose per-namespace GET is denied, e.g. header
// auth with the default require_namespace_get=false, with legitimate pod-log
// permission) can still read ordinary pod logs: the guard must not depend on a
// per-namespace GET or on namespace-cache warmth. Regression test for the
// GET-based checkNamespaceAccess guard, which 403'd such callers on every
// cache miss.
func TestPodLogsListAuthorizedNamespace(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("ns-victim"))
	// The LIST includes ns-victim; only the per-namespace GET is denied.
	listAuthorized := newListAuthorizedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"})
	streamer := &fakePodLogStreamer{
		logs:                "2018-01-02T03:34:28+00:00 INFO #1 Log Message\n",
		UserClientInterface: listAuthorized,
	}
	ts := setupPodLogsEndpoint(t, streamer, conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/victim-pod/logs")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "#1 Log Message")
}

// TestConfigDumpZtunnelListAuthorizedNamespace ensures the same LIST-authorized
// caller can fetch the ztunnel config dump for a namespace whose per-namespace
// GET is denied: the guard must authorize against the LIST-based accessible
// set, and the dump filter keeps the namespaces in that set.
func TestConfigDumpZtunnelListAuthorizedNamespace(t *testing.T) {
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("ns-victim"))
	listAuthorized := newListAuthorizedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"})
	ts, kialiCache := setupConfigDumpZtunnelEndpoint(t, listAuthorized, conf)

	dump := &kubernetes.ZtunnelConfigDump{
		Policies:  []any{map[string]any{"name": "policy-victim", "namespace": "ns-victim"}},
		Services:  []kubernetes.Service{{Name: "svc-victim", Namespace: "ns-victim"}},
		Workloads: []kubernetes.Workload{{Name: "wl-victim", Namespace: "ns-victim"}},
	}
	kialiCache.SetZtunnelDump(cluster+"ztunnel-abc", dump)

	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/ztunnel-abc/config_dump_ztunnel")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "wl-victim")
	assert.Contains(t, string(actual), "svc-victim")
}

// TestPodLogsWaypointListAuthorizedColdCache pins the waypoint log type for
// a LIST-authorized user with no waypoint attached to the workload. What it
// actually observes is the nil-regexp panic fix: this request falls through
// the waypoint branch with the filter unset, which panicked on a zero-value
// regexp before (reproducible on master). It also confirms the request is
// not Kiali-gated (waypoint logs stream with the user's own credentials,
// enforced at the API server) and does not error.
func TestPodLogsWaypointListAuthorizedColdCache(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	listAuthorized := newListAuthorizedNamespaceClient(k8s, "bookinfo", []string{"bookinfo"})
	streamer := &fakePodLogStreamer{
		logs:                "2028-01-02T03:34:28+00:00 INFO waypoint-eligible log line\n",
		UserClientInterface: listAuthorized,
	}
	ts := setupPodLogsEndpoint(t, streamer, conf)

	resp, err := http.Get(ts.URL + "/api/namespaces/bookinfo/pods/details-v1-abc/logs?logType=waypoint")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "waypoint-eligible log line")
}

// TestPodLogsZtunnelNoZtunnelPodsStillGated guards the gate's load-bearing
// scope: when the cache holds no ztunnel pods, the ztunnel log-type branch
// falls through to streaming the requested pod with the SA client — so the
// namespace gate must apply to the log type, not to "ztunnel pods exist".
func TestPodLogsZtunnelNoZtunnelPodsStillGated(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("ns-victim"))
	ts := setupPodLogsEndpoint(t, newRestrictedNamespaceClient(k8s, "ns-victim", []string{"bookinfo", "ns-victim"}), conf)

	// No ztunnel daemonset/pods are registered in the cache.
	resp, err := http.Get(ts.URL + "/api/namespaces/ns-victim/pods/victim-pod/logs?logType=ztunnel")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}
