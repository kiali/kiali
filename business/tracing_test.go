package business

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/tracingtest"
)

func getLayer(t *testing.T, conf *config.Config) *Layer {
	config.Set(conf)
	s1 := kubetest.FakeService("Namespace", "reviews")
	s2 := kubetest.FakeService("Namespace", "httpbin")
	objects := []runtime.Object{
		kubetest.FakeNamespace("Namespace"),
		&s1,
		&s2,
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	return NewLayerBuilder(t, conf).WithClient(k8s).Build()
}

var trace1 = jaegerModels.Trace{
	Spans: []jaegerModels.Span{{
		ProcessID:     "t1_process_1",
		OperationName: "reviews.default.svc.cluster.local:8000/*",
		Tags: []jaegerModels.KeyValue{{
			Key:   "dummy",
			Value: "dummy",
		}, {
			Key:   "node_id",
			Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.default~default.svc.cluster.local",
		}},
	}, {
		ProcessID:     "t1_process_2",
		OperationName: "my-operation",
		Tags: []jaegerModels.KeyValue{{
			Key:   "dummy",
			Value: "dummy",
		}},
	}},
	Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
		"t1_process_1": {
			ServiceName: "reviews.default",
			Tags: []jaegerModels.KeyValue{{
				Key:   "dummy",
				Value: "dummy",
			}},
		},
		"t1_process_2": {
			ServiceName: "my-pod",
			Tags: []jaegerModels.KeyValue{{
				Key:   "dummy",
				Value: "dummy",
			}, {
				Key:   "hostname",
				Value: "my-pod-123456-789abc",
			}},
		},
	},
}

var trace2 = jaegerModels.Trace{
	Spans: []jaegerModels.Span{{
		ProcessID:     "t2_process_1",
		OperationName: "reviews.default.svc.cluster.local:8000/*",
		Tags: []jaegerModels.KeyValue{{
			Key:   "node_id",
			Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.default~default.svc.cluster.local",
		}},
	}, {
		ProcessID:     "t2_process_2",
		OperationName: "rating.default.svc.cluster.local:8000/*",
		Tags: []jaegerModels.KeyValue{{
			Key:   "node_id",
			Value: "sidecar~172.17.0.20~rating-v2-6d8996bff-ztg6z.default~default.svc.cluster.local",
		}},
	}, {
		ProcessID:     "t2_process_3",
		OperationName: "my-operation",
		Tags:          []jaegerModels.KeyValue{},
	}},
	Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
		"t2_process_1": {
			ServiceName: "reviews.default",
			Tags:        []jaegerModels.KeyValue{},
		},
		"t2_process_2": {
			ServiceName: "rating.default",
			Tags:        []jaegerModels.KeyValue{},
		},
		"t2_process_3": {
			ServiceName: "rating",
			Tags: []jaegerModels.KeyValue{{
				Key:   "hostname",
				Value: "rating-v2-6d8996bff-ztg6z",
			}},
		},
	},
}

var waypointTrace = jaegerModels.Trace{
	Spans: []jaegerModels.Span{{
		ProcessID:     "t1_process_1",
		OperationName: "reviews.default.svc.cluster.local:8000/*",
		Tags: []jaegerModels.KeyValue{{
			Key:   "dummy",
			Value: "dummy",
		}, {
			Key:   "node_id",
			Value: "waypoint~10.244.0.19~waypoint-5f89fbb8b5-nxxmj.default~default.svc.cluster.local",
		}},
	}, {
		ProcessID:     "t1_process_2",
		OperationName: "my-operation",
		Tags: []jaegerModels.KeyValue{{
			Key:   "dummy",
			Value: "dummy",
		}},
	}},
	Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
		"t1_process_1": {
			ServiceName: "waypoint.default",
			Tags:        []jaegerModels.KeyValue{},
		},
		"t1_process_2": {
			ServiceName: "bookinfo-gateway-istio.default",
			Tags:        []jaegerModels.KeyValue{},
		},
	},
}

var ambientTagTrace = jaegerModels.Trace{
	Spans: []jaegerModels.Span{{
		ProcessID:     "at_process_1",
		OperationName: "waypoint-proxy-operation",
		Tags: []jaegerModels.KeyValue{{
			Key:   "istio.destination_workload",
			Value: "reviews-v1",
		}, {
			Key:   "istio.destination_namespace",
			Value: "default",
		}, {
			Key:   "istio.destination_canonical_service",
			Value: "reviews",
		}, {
			Key:   "istio.source_workload",
			Value: "productpage-v1",
		}, {
			Key:   "istio.source_namespace",
			Value: "default",
		}},
	}},
	Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
		"at_process_1": {
			ServiceName: "waypoint.default",
			Tags:        []jaegerModels.KeyValue{},
		},
	},
}

func TestMatchingWorkload(t *testing.T) {
	assert := assert.New(t)
	tracingName := models.TracingName{App: "some-workload", Workload: "some-workload", Lookup: "some-workload"}
	assert.False(matchesWorkload(context.Background(), &trace1, "default", tracingName))
	tracingNameReviews := models.TracingName{App: "reviews", Workload: "reviews", Lookup: "reviews"}
	assert.True(matchesWorkload(context.Background(), &trace1, "default", tracingNameReviews))
	tracingNamePod := models.TracingName{App: "my-pod", Workload: "my-pod", Lookup: "my-pod"}
	assert.True(matchesWorkload(context.Background(), &trace1, "default", tracingNamePod))
}

func TestTracesToSpanWithoutFilter(t *testing.T) {
	assert := assert.New(t)

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "reviews.default",
	}
	reviewsTracingName := models.TracingName{App: "reviews", Lookup: "reviews"}
	spans := tracesToSpans(context.Background(), reviewsTracingName, &r, nil, config.NewConfig())
	assert.Len(spans, 2)
	assert.Equal("t1_process_1", string(spans[0].ProcessID))
	assert.Equal("t2_process_1", string(spans[1].ProcessID))

	r = model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "rating.default",
	}
	ratingsTracingName := models.TracingName{App: "rating", Lookup: "rating"}
	spans = tracesToSpans(context.Background(), ratingsTracingName, &r, nil, config.NewConfig())
	assert.Len(spans, 2)
	assert.Equal("t2_process_2", string(spans[0].ProcessID))
	assert.Equal("t2_process_3", string(spans[1].ProcessID))
}

func TestTracesToSpanWithServiceFilter(t *testing.T) {
	assert := assert.New(t)

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "reviews.default",
	}
	reviewsTracingName := models.TracingName{App: "reviews", Lookup: "reviews"}
	spans := tracesToSpans(context.Background(), reviewsTracingName, &r, operationSpanFilter(context.Background(), "default", "reviews"), config.NewConfig())
	assert.Len(spans, 2)
	assert.Equal("t1_process_1", string(spans[0].ProcessID))
	assert.Equal("t2_process_1", string(spans[1].ProcessID))

	r = model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "rating.default",
	}
	ratingsTracingName := models.TracingName{App: "rating", Lookup: "rating"}
	spans = tracesToSpans(context.Background(), ratingsTracingName, &r, operationSpanFilter(context.Background(), "default", "rating"), config.NewConfig())
	assert.Len(spans, 1)
	assert.Equal("t2_process_2", string(spans[0].ProcessID))
}

func TestTracesToSpanWithWorkloadFilter(t *testing.T) {
	assert := assert.New(t)

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "reviews.default",
	}
	tracingName := models.TracingName{App: "reviews", Workload: "reviews", Lookup: "reviews"}
	spans := tracesToSpans(context.Background(), tracingName, &r, wkdSpanFilter(context.Background(), "default", tracingName), config.NewConfig())
	assert.Len(spans, 2)
	assert.Equal("t1_process_1", string(spans[0].ProcessID))
	assert.Equal("t2_process_1", string(spans[1].ProcessID))

	r = model.TracingResponse{
		Data:               []jaegerModels.Trace{trace1, trace2},
		TracingServiceName: "rating.default",
	}
	tracingRatingsName := models.TracingName{App: "rating", Workload: "rating-v2", Lookup: "rating"}
	spans = tracesToSpans(context.Background(), tracingRatingsName, &r, wkdSpanFilter(context.Background(), "default", tracingRatingsName), config.NewConfig())
	assert.Len(spans, 2)
	assert.Equal("t2_process_2", string(spans[0].ProcessID))
	assert.Equal("t2_process_3", string(spans[1].ProcessID))
}

func TestTracesToSpanWaypointWithWorkloadFilter(t *testing.T) {
	assert := assert.New(t)

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{waypointTrace},
		TracingServiceName: "waypoint.default",
	}
	tracingName := models.TracingName{App: "reviews", Workload: "reviews", Lookup: "waypoint", WaypointName: "waypoint"}
	spans := tracesToSpans(context.Background(), tracingName, &r, wkdSpanFilter(context.Background(), "default", tracingName), config.NewConfig())
	assert.Len(spans, 1)
	// Process is empty here, because the span we are looking for is the service and the process is the waypoint
}

func TestTracesToSpanWaypointWithAmbientTagWorkloadFilter(t *testing.T) {
	assert := assert.New(t)

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{ambientTagTrace},
		TracingServiceName: "waypoint.default",
	}
	tracingName := models.TracingName{App: "reviews", Workload: "reviews-v1", Lookup: "waypoint", WaypointName: "waypoint"}
	spans := tracesToSpans(context.Background(), tracingName, &r, wkdSpanFilter(context.Background(), "default", tracingName), config.NewConfig())
	assert.Len(spans, 1)
}

func TestOperationSpanFilterMatchesAmbientCanonicalService(t *testing.T) {
	assert := assert.New(t)

	filter := operationSpanFilter(context.Background(), "default", "reviews")
	span := jaegerModels.Span{
		OperationName: "does-not-have-service-prefix",
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.destination_canonical_service", Value: "reviews"},
			{Key: "istio.destination_namespace", Value: "default"},
		},
	}
	assert.True(filter(&span))
}

func TestTracesToSpanWaypointWithAmbientTagsDoNotFallbackToAppPrefix(t *testing.T) {
	assert := assert.New(t)

	trace := jaegerModels.Trace{
		Spans: []jaegerModels.Span{{
			ProcessID:     "at_process_1",
			OperationName: "reviews.default.svc.cluster.local:9080/*",
			Tags: []jaegerModels.KeyValue{
				{Key: "istio.destination_workload", Value: "reviews-v1"},
				{Key: "istio.destination_namespace", Value: "default"},
			},
		}},
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"at_process_1": {
				ServiceName: "waypoint.default",
				Tags:        []jaegerModels.KeyValue{},
			},
		},
	}

	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{trace},
		TracingServiceName: "waypoint.default",
	}
	tracingName := models.TracingName{App: "reviews", Workload: "reviews-v2", Lookup: "waypoint", WaypointName: "waypoint"}
	spans := tracesToSpans(context.Background(), tracingName, &r, wkdSpanFilter(context.Background(), "default", tracingName), config.NewConfig())
	assert.Len(spans, 0)
}

func TestTracingServiceNameNonDefaultDomain(t *testing.T) {
	cases := map[string]struct {
		namespaceSelector bool
		identityDomain    string
		namespace         string
		app               string
		expected          string
	}{
		"ns selector off returns app as-is": {
			namespaceSelector: false,
			identityDomain:    "svc.example.org",
			namespace:         "bookinfo",
			app:               "reviews",
			expected:          "reviews",
		},
		"ns selector on, app lacks domain, returns app.ns": {
			namespaceSelector: true,
			identityDomain:    "svc.example.org",
			namespace:         "bookinfo",
			app:               "reviews",
			expected:          "reviews.bookinfo",
		},
		"ns selector on, app contains domain, returns app as-is": {
			namespaceSelector: true,
			identityDomain:    "svc.example.org",
			namespace:         "bookinfo",
			app:               "reviews.bookinfo.svc.example.org",
			expected:          "reviews.bookinfo.svc.example.org",
		},
		"default domain, ns selector on, app lacks domain": {
			namespaceSelector: true,
			identityDomain:    "svc.cluster.local",
			namespace:         "default",
			app:               "httpbin",
			expected:          "httpbin.default",
		},
		"default domain, ns selector on, app contains domain": {
			namespaceSelector: true,
			identityDomain:    "svc.cluster.local",
			namespace:         "default",
			app:               "httpbin.default.svc.cluster.local",
			expected:          "httpbin.default.svc.cluster.local",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			got := tracingServiceName(tc.namespaceSelector, tc.identityDomain, tc.namespace, tc.app)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestValidateConfiguration(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	layer := getLayer(t, conf)

	tracingConfig := config.TracingConfig{Enabled: true, InternalURL: "http://localhost:59999", UseGRPC: false}

	validConfig := layer.Tracing.ValidateConfiguration(context.TODO(), conf, &tracingConfig, "")

	assert.NotNil(validConfig)
	assert.NotNil(validConfig.Error)
	assert.Contains(validConfig.Error, "connection refused")

	tracingConfig = config.TracingConfig{Enabled: false, InternalURL: "http://localhost:59999", UseGRPC: false}
	validConfig = layer.Tracing.ValidateConfiguration(context.TODO(), conf, &tracingConfig, "")

	assert.NotNil(validConfig)
	assert.NotNil(validConfig.Error)
	assert.Contains(validConfig.Error, "Error creating tracing client")
}

// TestTraceNamespaces pins the multi-source namespace extraction used to
// authorize trace details: sidecar tags, ambient tags, node_id and OTel
// resource attributes surfaced as process tags. Building it on only one
// source would 403 every trace from the other telemetry modes.
func TestTraceNamespaces(t *testing.T) {
	require := require.New(t)

	// Sidecar trace: istio.namespace span tag plus a node_id tag.
	sidecar := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.namespace", Value: "bookinfo"},
			{Key: "node_id", Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.bookinfo~bookinfo.svc.cluster.local"},
		},
	}}}}
	require.Equal([]string{"bookinfo"}, traceNamespaces(sidecar))

	// node_id alone (older sidecar traces without istio.namespace), including
	// a custom cluster domain suffix.
	nodeIDOnly := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "node_id", Value: "router~10.0.0.1~ingress-6d8996bff-ab.my-ns~my-ns.svc.my.domain"},
		},
	}}}}
	require.Equal([]string{"my-ns"}, traceNamespaces(nodeIDOnly))

	// Ambient trace: source/destination namespace tags (waypoint/ztunnel).
	ambient := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.source_namespace", Value: "bookinfo"},
			{Key: "istio.destination_namespace", Value: "istio-system"},
			{Key: "node_id", Value: "waypoint~172.17.0.21~waypoint-5f7d8c9b-x2kl4.istio-system~istio-system.svc.cluster.local"},
		},
	}}}}
	require.Equal([]string{"bookinfo", "istio-system"}, traceNamespaces(ambient))

	// OTel resource attributes surfaced as process tags (Tempo/OTel).
	otelTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "k8s.namespace.name", Value: "otel-ns"},
		}},
	}}}}
	require.Equal([]string{"otel-ns"}, traceNamespaces(otelTrace))

	// No namespace information at all.
	none := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{{Key: "dummy", Value: "dummy"}},
	}}}}
	require.Empty(traceNamespaces(none))
	require.Nil(traceNamespaces(nil))
}

// TestCheckTraceAccess pins the trace-details authorization: the user must
// be able to access at least one participating namespace, and a trace with
// no recognizable namespace information is denied (fail closed).
func TestCheckTraceAccess(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	// The SA sees bookinfo and victim-ns; the user can only LIST bookinfo.
	sa, user := newAccessibleSetClients([]string{"bookinfo", "victim-ns"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: sa}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	accessibleTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.source_namespace", Value: "bookinfo"},
			{Key: "istio.destination_namespace", Value: "victim-ns"},
		},
	}}}}
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), accessibleTrace))

	inaccessibleTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.source_namespace", Value: "victim-ns"},
		},
	}}}}
	err := layer.Tracing.CheckTraceAccess(context.TODO(), inaccessibleTrace)
	require.Error(err)
	require.True(IsAccessibleError(err))

	noNamespaceTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{{Key: "dummy", Value: "dummy"}},
	}}}}
	err = layer.Tracing.CheckTraceAccess(context.TODO(), noNamespaceTrace)
	require.Error(err)
	require.True(IsAccessibleError(err))
}

// TestExtractTraceNamespaceScope pins the cluster-aware namespace
// extraction: namespace information is paired with the span's cluster
// attribution when present (model.ClusterTagKeys) and collected as
// cluster-less otherwise.
func TestExtractTraceNamespaceScope(t *testing.T) {
	require := require.New(t)

	// Sidecar span with cluster attribution: istio.cluster_id pairs with
	// both the istio.namespace tag and the node_id namespace.
	sidecar := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "cluster-a"},
			{Key: "istio.namespace", Value: "bookinfo"},
			{Key: "node_id", Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.bookinfo~bookinfo.svc.cluster.local"},
		},
	}}}}
	scope := extractTraceNamespaceScope(&sidecar.Data)
	require.Equal(map[string]struct{}{"bookinfo": {}}, scope.byCluster["cluster-a"])
	require.Empty(scope.unscoped)

	// Span without cluster attribution: the namespace is cluster-less.
	unscoped := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.namespace", Value: "bookinfo"},
		},
	}}}}
	scope = extractTraceNamespaceScope(&unscoped.Data)
	require.Empty(scope.byCluster)
	require.Equal(map[string]struct{}{"bookinfo": {}}, scope.unscoped)

	// OTel resource attributes surfaced as process tags: k8s.cluster.name
	// pairs with k8s.namespace.name.
	otelTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "k8s.cluster.name", Value: "cluster-b"},
			{Key: "k8s.namespace.name", Value: "otel-ns"},
		}},
	}}}}
	scope = extractTraceNamespaceScope(&otelTrace.Data)
	require.Equal(map[string]struct{}{"otel-ns": {}}, scope.byCluster["cluster-b"])
	require.Empty(scope.unscoped)

	// Mixed trace: one attributed span and one cluster-less span.
	mixed := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{
		{Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "cluster-a"},
			{Key: "istio.namespace", Value: "bookinfo"},
		}},
		{Tags: []jaegerModels.KeyValue{
			{Key: "istio.namespace", Value: "sleep"},
		}},
	}}}
	scope = extractTraceNamespaceScope(&mixed.Data)
	require.Equal(map[string]struct{}{"bookinfo": {}}, scope.byCluster["cluster-a"])
	require.Equal(map[string]struct{}{"sleep": {}}, scope.unscoped)

	// Jaeger JSON shape: the span's Process is nil and the process tags
	// live in the trace-level Processes map, keyed by the span's ProcessID.
	jaegerTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {Tags: []jaegerModels.KeyValue{
				{Key: "k8s.cluster.name", Value: "cluster-b"},
				{Key: "k8s.namespace.name", Value: "bookinfo"},
			}},
		},
		Spans: []jaegerModels.Span{{ProcessID: "p1"}},
	}}
	scope = extractTraceNamespaceScope(&jaegerTrace.Data)
	require.Equal(map[string]struct{}{"bookinfo": {}}, scope.byCluster["cluster-b"])
	require.Empty(scope.unscoped)

	// Cluster tags without namespace information contribute nothing.
	clusterOnly := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "cluster-a"},
		},
	}}}}
	require.True(extractTraceNamespaceScope(&clusterOnly.Data).empty())

	// Tempo search answers render a selected-but-absent attribute as the
	// literal string "nil" (observed on Tempo 2.10): that must not contribute
	// a phantom "nil" namespace, and a "nil" cluster tag must count as absent
	// (its namespaces fall back to cluster-less).
	nilMarker := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "nil"},
			{Key: "k8s.namespace.name", Value: "nil"},
			{Key: "istio.namespace", Value: "bookinfo"},
		},
	}}}}
	scope = extractTraceNamespaceScope(&nilMarker.Data)
	require.Empty(scope.byCluster, "the nil cluster marker must count as absent")
	require.Equal(map[string]struct{}{"bookinfo": {}}, scope.unscoped)
	require.NotContains(scope.unscoped, "nil")
}

// TestCheckTraceAccessClusterAware pins the cluster-aware trace-details
// authorization: a namespace the telemetry attributes to a cluster
// (istio.cluster_id / k8s.cluster.name) must be accessible to the user in
// that cluster — access to a same-named namespace in another cluster must
// not authorize the trace. Cluster-less namespaces keep the name-based
// rule, since sidecar telemetry often carries no cluster tag.
func TestCheckTraceAccessClusterAware(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	home := conf.KubernetesConfig.ClusterName
	const remote = "cluster-b"

	// Both clusters have a bookinfo namespace. The user can see it in the
	// home cluster only; in the remote cluster their LIST is empty.
	homeSA := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	homeSA.Token = "home-sa-token"
	remoteSA := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	remoteSA.Token = "remote-sa-token"
	homeUser := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")), "user-token", []string{"bookinfo"})
	remoteUser := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")), "user-token", nil)

	saClients := map[string]kubernetes.ClientInterface{home: homeSA, remote: remoteSA}
	userClients := map[string]kubernetes.UserClientInterface{home: homeUser, remote: remoteUser}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	traceWith := func(spans ...[]jaegerModels.KeyValue) *model.TracingSingleTrace {
		trace := &model.TracingSingleTrace{Data: jaegerModels.Trace{}}
		for _, tags := range spans {
			trace.Data.Spans = append(trace.Data.Spans, jaegerModels.Span{Tags: tags})
		}
		return trace
	}

	// The reported scenario: the trace is attributed to the remote cluster,
	// where the user cannot see bookinfo. Access to bookinfo in the home
	// cluster must not authorize it.
	remoteTrace := traceWith([]jaegerModels.KeyValue{
		{Key: "istio.cluster_id", Value: remote},
		{Key: "istio.namespace", Value: "bookinfo"},
	})
	err := layer.Tracing.CheckTraceAccess(context.TODO(), remoteTrace)
	require.Error(err)
	require.True(IsAccessibleError(err))

	// The OTel cluster attribute scopes the same way.
	remoteOTelTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "k8s.cluster.name", Value: remote},
			{Key: "k8s.namespace.name", Value: "bookinfo"},
		}},
	}}}}
	err = layer.Tracing.CheckTraceAccess(context.TODO(), remoteOTelTrace)
	require.Error(err)
	require.True(IsAccessibleError(err))

	// The same trace attributed to the home cluster: allowed.
	homeTrace := traceWith([]jaegerModels.KeyValue{
		{Key: "istio.cluster_id", Value: home},
		{Key: "istio.namespace", Value: "bookinfo"},
	})
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), homeTrace))

	// Cluster-less spans keep the name-based rule: allowed via home.
	unscopedTrace := traceWith([]jaegerModels.KeyValue{
		{Key: "istio.namespace", Value: "bookinfo"},
	})
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), unscopedTrace))

	// A trace with both attributed (remote) and cluster-less spans is
	// authorized through the fallback: failing closed on partially
	// attributed traces would deny legitimate sidecar telemetry.
	mixedTrace := traceWith(
		[]jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: remote},
			{Key: "istio.namespace", Value: "bookinfo"},
		},
		[]jaegerModels.KeyValue{
			{Key: "istio.namespace", Value: "bookinfo"},
		},
	)
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), mixedTrace))

	// A cross-cluster trace participating in an accessible (home) and an
	// inaccessible (remote) cluster: at least one accessible participating
	// namespace authorizes it, consistent with the trace list endpoints
	// returning whole traces.
	crossClusterTrace := traceWith(
		[]jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: home},
			{Key: "istio.namespace", Value: "bookinfo"},
		},
		[]jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: remote},
			{Key: "istio.namespace", Value: "bookinfo"},
		},
	)
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), crossClusterTrace))

	// Jaeger JSON shape: the process tags (carrying the cluster and
	// namespace attribution) live in the trace-level Processes map, keyed by
	// the span's ProcessID, and the span's Process is nil. Attributed to the
	// home cluster the trace is allowed; attributed to the remote cluster,
	// where the user has an empty LIST, it is denied.
	jaegerTrace := func(cluster string) *model.TracingSingleTrace {
		return &model.TracingSingleTrace{Data: jaegerModels.Trace{
			Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
				"p1": {Tags: []jaegerModels.KeyValue{
					{Key: "k8s.cluster.name", Value: cluster},
					{Key: "k8s.namespace.name", Value: "bookinfo"},
				}},
			},
			Spans: []jaegerModels.Span{{ProcessID: "p1"}},
		}}
	}
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), jaegerTrace(home)))
	err = layer.Tracing.CheckTraceAccess(context.TODO(), jaegerTrace(remote))
	require.Error(err)
	require.True(IsAccessibleError(err))

	// A cluster the user has no client for: denied (fail closed).
	noClientTrace := traceWith([]jaegerModels.KeyValue{
		{Key: "istio.cluster_id", Value: "cluster-c"},
		{Key: "istio.namespace", Value: "bookinfo"},
	})
	err = layer.Tracing.CheckTraceAccess(context.TODO(), noClientTrace)
	require.Error(err)
	require.True(IsAccessibleError(err))
}

// TestTraceInNamespace pins the namespace-scoped trace list authorization:
// a trace is kept only when at least one span is attributed to the
// requested namespace, with the same cluster pairing CheckTraceAccess
// applies (attributed spans count only for their cluster, cluster-less
// spans count for any cluster, no namespace information fails closed).
func TestTraceInNamespace(t *testing.T) {
	bookinfoTrace := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.source_namespace", Value: "bookinfo"},
		},
	}}}

	// Cluster-less namespace match.
	require.True(t, traceInNamespace(bookinfoTrace, "cluster-a", "bookinfo"))

	// The requested cluster's attribution matches.
	attributed := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "cluster-a"},
			{Key: "istio.source_namespace", Value: "bookinfo"},
		},
	}}}
	require.True(t, traceInNamespace(attributed, "cluster-a", "bookinfo"))

	// The same namespace attributed to a different cluster does not match.
	require.False(t, traceInNamespace(attributed, "cluster-b", "bookinfo"))

	// A different namespace in the requested cluster does not match.
	otherNamespace := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "istio.cluster_id", Value: "cluster-a"},
			{Key: "istio.source_namespace", Value: "victim-ns"},
		},
	}}}
	require.False(t, traceInNamespace(otherNamespace, "cluster-a", "bookinfo"))

	// node_id namespaces count (older sidecar traces).
	nodeIDTrace := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "node_id", Value: "sidecar~172.17.0.20~reviews-6d8996bff-ztg6z.bookinfo~bookinfo.svc.cluster.local"},
		},
	}}}
	require.True(t, traceInNamespace(nodeIDTrace, "cluster-a", "bookinfo"))

	// An empty cluster matches any cluster attribution by name.
	require.True(t, traceInNamespace(attributed, "", "bookinfo"))

	// No namespace information at all: fail closed.
	noNamespace := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{{Key: "dummy", Value: "dummy"}},
	}}}
	require.False(t, traceInNamespace(noNamespace, "cluster-a", "bookinfo"))
}

// TestGetAppTracesFiltersByNamespace pins the trace list authorization on
// the read path: whatever service name the caller-supplied app name produced
// (a name carrying another namespace's identity domain skips namespace
// qualification in buildTracingServiceName), the traces actually returned
// must have a span in the requested namespace. This is the app-path guard
// for the GetAppTracingName NotFound fallback, which preserves the raw
// caller-supplied name.
func TestGetAppTracesFiltersByNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.Tracing.Enabled = true
	cluster := conf.KubernetesConfig.ClusterName

	// The mock backend is queried with whatever service name the (here
	// fully qualified, foreign-namespace) caller-supplied app name produced,
	// and returns traces belonging to three namespaces.
	traceClient := new(tracingtest.TracingClientMock)
	traceClient.On("GetAppTraces", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&model.TracingResponse{
		Data: []jaegerModels.Trace{
			// A trace participating in the requested namespace: kept.
			{Spans: []jaegerModels.Span{{
				Tags: []jaegerModels.KeyValue{
					{Key: "istio.source_namespace", Value: "bookinfo"},
					{Key: "istio.destination_namespace", Value: "victim-ns"},
				},
			}}},
			// A victim-only trace: dropped.
			{Spans: []jaegerModels.Span{{
				Tags: []jaegerModels.KeyValue{
					{Key: "istio.source_namespace", Value: "victim-ns"},
				},
			}}},
			// A trace with no namespace information: dropped (fail closed).
			{Spans: []jaegerModels.Span{{
				Tags: []jaegerModels.KeyValue{{Key: "dummy", Value: "dummy"}},
			}}},
		},
	}, nil)

	sa := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	user := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, traceClient, kialiCache, conf, nil, discovery, nil)

	// The caller-supplied app name carries the identity domain of another
	// namespace, so buildTracingServiceName passes it through unqualified.
	app := "private-app.victim-ns.svc.cluster.local"
	traces, err := layer.Tracing.GetAppTraces(context.TODO(), "bookinfo", app, app, models.TracingQuery{Cluster: cluster})
	require.NoError(err)
	require.Len(traces.Data, 1)
	require.Equal([]jaegerModels.KeyValue{
		{Key: "istio.source_namespace", Value: "bookinfo"},
		{Key: "istio.destination_namespace", Value: "victim-ns"},
	}, traces.Data[0].Spans[0].Tags)
	traceClient.AssertExpectations(t)
}

// TestGetErrorTracesFiltersByNamespace pins the error-traces count
// authorization: the endpoint takes the raw caller-supplied app name, so the
// count must be computed over the namespace-authorized traces only.
func TestGetErrorTracesFiltersByNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.Tracing.Enabled = true
	cluster := conf.KubernetesConfig.ClusterName

	traceClient := new(tracingtest.TracingClientMock)
	traceClient.On("GetAppTraces", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&model.TracingResponse{
		Data: []jaegerModels.Trace{
			// In the requested namespace: counted.
			{Spans: []jaegerModels.Span{{
				Tags: []jaegerModels.KeyValue{{Key: "istio.namespace", Value: "bookinfo"}},
			}}},
			// Victim-only: not counted.
			{Spans: []jaegerModels.Span{{
				Tags: []jaegerModels.KeyValue{{Key: "istio.namespace", Value: "victim-ns"}},
			}}},
		},
	}, nil)

	sa := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	user := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, traceClient, kialiCache, conf, nil, discovery, nil)

	count, err := layer.Tracing.GetErrorTraces(context.TODO(), cluster, "bookinfo", "private-app.victim-ns.svc.cluster.local", time.Minute)
	require.NoError(err)
	require.Equal(1, count)
	traceClient.AssertExpectations(t)
}

// TestGetAppTracesKeepsResourceAttributedTempoTraces pins the Tempo list
// path against the regression where traces whose namespace exists only as
// the OTel resource attribute (k8s.namespace.name) disappeared from the
// lists while remaining accessible through the trace details: the TraceQL
// selects now ask for the authorization attributes and the search-response
// conversion preserves them as span tags, so the per-trace filter must keep
// the legitimate trace and drop the denied one.
func TestGetAppTracesKeepsResourceAttributedTempoTraces(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.Tracing.Enabled = true
	cluster := conf.KubernetesConfig.ClusterName

	// The shape a Tempo search answer has after conversion: the namespace
	// and cluster information lives in the span tags (resource attributes
	// reported unqualified), with no istio.* namespace attributes.
	tempoTrace := func(namespace string) jaegerModels.Trace {
		return jaegerModels.Trace{Spans: []jaegerModels.Span{{
			Tags: []jaegerModels.KeyValue{
				{Key: "service.name", Value: "my-app"},
				{Key: "k8s.namespace.name", Value: namespace},
				{Key: "k8s.cluster.name", Value: cluster},
			},
		}}}
	}
	traceClient := new(tracingtest.TracingClientMock)
	traceClient.On("GetAppTraces", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&model.TracingResponse{
		Data: []jaegerModels.Trace{
			tempoTrace("bookinfo"),  // legitimate: the requested namespace
			tempoTrace("victim-ns"), // denied: another tenant's namespace
		},
	}, nil)

	sa := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	user := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, traceClient, kialiCache, conf, nil, discovery, nil)

	traces, err := layer.Tracing.GetAppTraces(context.TODO(), "bookinfo", "my-app", "my-app", models.TracingQuery{Cluster: cluster})
	require.NoError(err)
	require.Len(traces.Data, 1)

	tags := make(map[string]string)
	for _, tag := range traces.Data[0].Spans[0].Tags {
		if v, ok := tag.Value.(string); ok {
			tags[tag.Key] = v
		}
	}
	require.Equal("bookinfo", tags["k8s.namespace.name"], "the surviving trace must be the requested namespace's, not the denied one")
	traceClient.AssertExpectations(t)
}

// TestTraceAuthorizationIgnoresServiceNamespace pins that the OTel semantic
// convention service.namespace — a logical service grouping, not Kubernetes
// placement — is not read for authorization: it is application-controlled,
// so a value that happens to equal an accessible namespace must not
// authorize a trace placed elsewhere. Kiali's own self-tracing carries the
// canonical k8s.namespace.name resource attribute and remains authorized.
func TestTraceAuthorizationIgnoresServiceNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	// The user can access istio-system only (where the Kiali server runs).
	sa, user := newAccessibleSetClients([]string{"istio-system", "victim-ns"}, []string{"istio-system"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	// A trace carrying only service.namespace is not attributable and is
	// denied (fail closed), even though its value equals the accessible
	// namespace. Details-path shape: the resource attributes surfaced as
	// process tags by the Tempo single-trace converter.
	onlyServiceNamespace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "service.name", Value: "kiali.istio-system"},
			{Key: "service.namespace", Value: "istio-system"},
			{Key: "k8s.cluster.name", Value: cluster},
		}},
	}}}}
	require.Error(layer.Tracing.CheckTraceAccess(context.TODO(), onlyServiceNamespace))

	// The reviewer's scenario: the canonical attribute places the span in
	// the denied namespace while the app-controlled one names the accessible
	// namespace. The canonical attribution must decide — the trace is denied.
	mislabeled := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "service.name", Value: "kiali.victim-ns"},
			{Key: "service.namespace", Value: "istio-system"},
			{Key: "k8s.namespace.name", Value: "victim-ns"},
			{Key: "k8s.cluster.name", Value: cluster},
		}},
	}}}}
	require.Error(layer.Tracing.CheckTraceAccess(context.TODO(), mislabeled))

	// Kiali's own self-tracing shape: the canonical k8s.namespace.name
	// resource attribute authorizes it for users who can access the
	// namespace Kiali runs in.
	selfTrace := &model.TracingSingleTrace{Data: jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Process: &jaegerModels.Process{Tags: []jaegerModels.KeyValue{
			{Key: "service.name", Value: "kiali.istio-system"},
			{Key: "service.namespace", Value: "istio-system"},
			{Key: "k8s.namespace.name", Value: "istio-system"},
			{Key: "k8s.cluster.name", Value: cluster},
		}},
	}}}}
	require.NoError(layer.Tracing.CheckTraceAccess(context.TODO(), selfTrace))

	// The list-path shape: the attribute as a span tag, as the Tempo search
	// conversion delivers it. It does not place the trace in any namespace.
	listTrace := &jaegerModels.Trace{Spans: []jaegerModels.Span{{
		Tags: []jaegerModels.KeyValue{
			{Key: "service.name", Value: "kiali.istio-system"},
			{Key: "service.namespace", Value: "istio-system"},
		},
	}}}
	require.False(traceInNamespace(listTrace, cluster, "istio-system"))
	require.False(traceInNamespace(listTrace, cluster, "victim-ns"))
}
