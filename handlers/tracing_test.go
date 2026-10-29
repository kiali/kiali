package handlers

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

// fakeTraceDetailClient is a tracing client that returns a fixed trace for
// any trace ID.
type fakeTraceDetailClient struct {
	trace *model.TracingSingleTrace
}

func (f *fakeTraceDetailClient) GetAppTraces(ctx context.Context, ns, app string, query models.TracingQuery) (*model.TracingResponse, error) {
	return nil, nil
}

func (f *fakeTraceDetailClient) GetTraceDetail(ctx context.Context, traceID string) (*model.TracingSingleTrace, error) {
	return f.trace, nil
}

func (f *fakeTraceDetailClient) GetErrorTraces(ctx context.Context, ns, app string, duration time.Duration) (int, error) {
	return 0, nil
}

func (f *fakeTraceDetailClient) GetServiceStatus(ctx context.Context) (bool, error) {
	return true, nil
}

func (f *fakeTraceDetailClient) GetServices(ctx context.Context) ([]string, error) {
	return nil, nil
}

// denyingTraceClient fails the test on any tracing backend call: the
// namespace gate must reject the request before the backend is queried
// (the backend has no RBAC of its own, so an escaped call means
// unauthorized data was fetched).
type denyingTraceClient struct {
	t *testing.T
}

func (d *denyingTraceClient) GetAppTraces(ctx context.Context, ns, app string, query models.TracingQuery) (*model.TracingResponse, error) {
	d.t.Errorf("GetAppTraces escaped the namespace gate")
	return nil, nil
}

func (d *denyingTraceClient) GetTraceDetail(ctx context.Context, traceID string) (*model.TracingSingleTrace, error) {
	d.t.Errorf("GetTraceDetail escaped the namespace gate")
	return nil, nil
}

func (d *denyingTraceClient) GetErrorTraces(ctx context.Context, ns, app string, duration time.Duration) (int, error) {
	d.t.Errorf("GetErrorTraces escaped the namespace gate")
	return 0, nil
}

func (d *denyingTraceClient) GetServiceStatus(ctx context.Context) (bool, error) {
	d.t.Errorf("GetServiceStatus escaped the namespace gate")
	return true, nil
}

func (d *denyingTraceClient) GetServices(ctx context.Context) ([]string, error) {
	d.t.Errorf("GetServices escaped the namespace gate")
	return nil, nil
}

func setupTracingEndpoint(t *testing.T, userClient kubernetes.UserClientInterface, traceClient tracing.ClientInterface, pattern string, handlerFactory func(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface, cpm business.ControlPlaneMonitor, traceClientLoader func() tracing.ClientInterface, grafana *grafana.Service, discovery *istio.Discovery) http.HandlerFunc) *httptest.Server {
	t.Helper()
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.ExternalServices.Tracing.Enabled = true

	cf := kubetest.NewFakeClientFactoryWithClient(conf, userClient)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*conf, userClient.GetToken())
	require.NoError(t, err)
	prom.Inject(xapi)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return traceClient }
	grafanaSvc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	handler := WithFakeAuthInfo(conf, handlerFactory(conf, kialiCache, cf, prom, cpm, traceLoader, grafanaSvc, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc(pattern, handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts
}

// TestTraceDetailsInaccessibleTrace ensures a trace whose participating
// namespaces are all outside the user's accessible set is denied with 403:
// the tracing backend has no RBAC of its own, so Kiali's check is the only
// gate, and traces are cross-namespace by nature.
func TestTraceDetailsInaccessibleTrace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	traceClient := &fakeTraceDetailClient{trace: &model.TracingSingleTrace{
		Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
			SpanID: "s1",
			Tags:   []jaegerModels.KeyValue{{Key: "istio.namespace", Value: "victim-ns"}},
		}}},
	}}
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), traceClient, "/api/traces/{traceID}", TraceDetails)

	resp, err := http.Get(ts.URL + "/api/traces/abcdef1234567890")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestTraceDetailsAccessibleTrace ensures a trace with at least one
// participating namespace in the user's accessible set is served.
func TestTraceDetailsAccessibleTrace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	traceClient := &fakeTraceDetailClient{trace: &model.TracingSingleTrace{
		Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
			SpanID: "s1",
			Tags:   []jaegerModels.KeyValue{{Key: "istio.namespace", Value: "bookinfo"}},
		}}},
	}}
	ts := setupTracingEndpoint(t, k8s, traceClient, "/api/traces/{traceID}", TraceDetails)

	resp, err := http.Get(ts.URL + "/api/traces/abcdef1234567890")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}

// TestTraceDetailsNoNamespaceInfo ensures a trace with no recognizable
// namespace information is denied (fail closed).
func TestTraceDetailsNoNamespaceInfo(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	traceClient := &fakeTraceDetailClient{trace: &model.TracingSingleTrace{
		Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
			SpanID: "s1",
			Tags:   []jaegerModels.KeyValue{{Key: "dummy", Value: "dummy"}},
		}}},
	}}
	ts := setupTracingEndpoint(t, k8s, traceClient, "/api/traces/{traceID}", TraceDetails)

	resp, err := http.Get(ts.URL + "/api/traces/abcdef1234567890")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestAppTracesInaccessibleNamespace ensures the app traces endpoint gates
// the namespace before any tracing backend call (previously there was no
// check at all on this path).
func TestAppTracesInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), &denyingTraceClient{t: t}, "/api/namespaces/{namespace}/apps/{app}/traces", AppTraces)

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/apps/reviews/traces")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestErrorTracesInaccessibleNamespace ensures the error traces endpoint
// gates the namespace: it has no Kubernetes name resolution at all, so the
// handler gate is the only authorization.
func TestErrorTracesInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), &denyingTraceClient{t: t}, "/api/namespaces/{namespace}/apps/{app}/errortraces", ErrorTraces)

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/apps/reviews/errortraces?duration=600")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestAppSpansInaccessibleNamespace ensures the app spans endpoint gates the
// namespace before any tracing backend call.
func TestAppSpansInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), &denyingTraceClient{t: t}, "/api/namespaces/{namespace}/apps/{app}/spans", AppSpans)

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/apps/reviews/spans")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestServiceTracesInaccessibleNamespace ensures the service traces endpoint
// now has an explicit gate on top of the indirect name-resolution gate.
func TestServiceTracesInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), &denyingTraceClient{t: t}, "/api/namespaces/{namespace}/services/{service}/traces", ServiceTraces)

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/services/productpage/traces")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestWorkloadTracesInaccessibleNamespace ensures the workload traces
// endpoint now has an explicit gate on top of the indirect name-resolution
// gate.
func TestWorkloadTracesInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := setupTracingEndpoint(t, newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}), &denyingTraceClient{t: t}, "/api/namespaces/{namespace}/workloads/{workload}/traces", WorkloadTraces)

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/workloads/reviews-v1/traces")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestTraceDetailsNotFoundTrace pins the B-2 fix: a backend "not found"
// response (an error-bearing trace with no spans, as the Tempo client
// returns) is a 404, not a 403 from the access check — an empty trace has
// no namespaces to authorize.
func TestTraceDetailsNotFoundTrace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	traceClient := &fakeTraceDetailClient{trace: &model.TracingSingleTrace{
		Data:   jaegerModels.Trace{},
		Errors: []model.StructuredError{{TraceID: "abcdef1234567890", Code: 404, Msg: "trace not found"}},
	}}
	ts := setupTracingEndpoint(t, k8s, traceClient, "/api/traces/{traceID}", TraceDetails)

	resp, err := http.Get(ts.URL + "/api/traces/abcdef1234567890")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusNotFound, resp.StatusCode, string(actual))
}
