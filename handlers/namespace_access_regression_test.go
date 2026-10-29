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
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

// These tests prove the core #10443 fix for endpoints gated only in the
// business layer: a LIST-authorized / GET-denied user (the #7125 profile —
// namespace LIST cluster-wide, resource roles in own namespaces only) gets a
// stable answer with a cold per-token namespace cache. Under the old
// GET-based gate these requests failed after the cache expired.

// gatedEndpointDeps holds the wired dependencies for a handler under test,
// with the LIST-authorized user client (LIST includes the namespace, the
// per-namespace GET is denied) as both the factory's user client and (as the
// legacy mock does) its SA client.
type gatedEndpointDeps struct {
	cfm         kubernetes.ClientFactory
	conf        *config.Config
	cpm         business.ControlPlaneMonitor
	discovery   *istio.Discovery
	grafanaSvc  *grafana.Service
	kialiCache  cache.KialiCache
	prom        prometheus.ClientInterface
	traceLoader func() tracing.ClientInterface
}

func setupBusinessGatedDeps(t *testing.T, k8s *kubetest.FakeK8sClient, deniedNamespace string, listedNamespaces []string) *gatedEndpointDeps {
	t.Helper()
	listAuthorized := newListAuthorizedNamespaceClient(k8s, deniedNamespace, listedNamespaces)
	return setupEndpointDepsWithClient(t, listAuthorized)
}

// setupEndpointDepsWithClient wires the handler dependencies with the given
// user client (used directly as the factory's user client and, as the legacy
// mock does, its SA client).
func setupEndpointDepsWithClient(t *testing.T, userClient kubernetes.UserClientInterface) *gatedEndpointDeps {
	return setupEndpointDepsWithSAs(t, userClient)
}

// setupEndpointDepsWithSAs is setupEndpointDepsWithClient with optionally
// separate, unfiltered SA clients built from the given objects (via the
// factory mock's WithSAClient), to model a namespace that exists (the SA
// sees it) but is denied to the user — without that, restricted-LIST tests
// exercise the "absent" path, not the denial path, whenever the code
// consults the SA set. With no objects the legacy behavior applies
// (SA = user client).
func setupEndpointDepsWithSAs(t *testing.T, userClient kubernetes.UserClientInterface, saObjects ...runtime.Object) *gatedEndpointDeps {
	t.Helper()
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	// Disabling CustomDashboards on testing: otherwise this adds 10s to the
	// test due to an http timeout.
	conf.ExternalServices.CustomDashboards.Enabled = false
	// Save and restore the globals this mutates, so tests cannot inherit each
	// other's settings by order.
	previousConf := config.Get()
	config.Set(conf)
	t.Cleanup(func() { config.Set(previousConf) })
	// Some handlers read the clock; it is a package-level provider the
	// server initializes at startup (individual tests may override it with a
	// mock for deterministic times).
	previousClock := util.Clock
	util.Clock = util.RealClock{}
	t.Cleanup(func() { util.Clock = previousClock })

	cf := kubetest.NewFakeClientFactoryWithClient(conf, userClient)
	if len(saObjects) > 0 {
		cf.WithSAClient(conf.KubernetesConfig.ClusterName, saObjects...)
	}
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*conf, userClient.GetToken())
	require.NoError(t, err)
	prom.Inject(xapi)

	grafanaSvc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	return &gatedEndpointDeps{
		cfm:         cf,
		conf:        conf,
		cpm:         &business.FakeControlPlaneMonitor{},
		discovery:   discovery,
		grafanaSvc:  grafanaSvc,
		kialiCache:  kialiCache,
		prom:        prom,
		traceLoader: func() tracing.ClientInterface { return nil },
	}
}

func serveGatedHandler(t *testing.T, deps *gatedEndpointDeps, pattern string, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	conf := deps.conf
	wrapped := WithFakeAuthInfo(conf, handler)
	mr := mux.NewRouter()
	mr.HandleFunc(pattern, wrapped)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts
}

func fakeWorkloadObjects(conf *config.Config) []runtime.Object {
	kubeObjects := []runtime.Object{kubetest.FakeNamespace("Namespace")}
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
	return kubeObjects
}

// TestWorkloadDetailsListAuthorizedColdCache is a regression guard for a
// LIST-authorized user on WorkloadDetails (gated in fetchWorkload, business
// layer). Note it does not by itself prove the C1 fix: something earlier in
// this request path warms the per-token cache before the business gate, so
// the old GET-based gate also passed here. The discriminating C1 proof is
// TestGetClusterNamespaceCacheWarmthInvariant and the AppDetails /
// IstioConfigList / NamespaceValidationSummary tests below.
func TestWorkloadDetailsListAuthorizedColdCache(t *testing.T) {
	conf := config.NewConfig()
	mockClock()
	k8s := kubetest.NewFakeK8sClient(fakeWorkloadObjects(conf)...)
	deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"Namespace"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/workloads/{workload}",
		WorkloadDetails(deps.conf, deps.kialiCache, deps.cfm, deps.cpm, deps.prom, deps.traceLoader, deps.grafanaSvc, deps.discovery))

	resp, err := http.Get(ts.URL + "/api/namespaces/Namespace/workloads/details-v1?health=false")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "details-v1")
}

// TestAppDetailsListAuthorizedColdCache: AppDetails is gated in
// GetAppDetails (business layer).
func TestAppDetailsListAuthorizedColdCache(t *testing.T) {
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	conf.ExternalServices.CustomDashboards.Enabled = false
	mockClock()
	kubeObjects := []runtime.Object{kubetest.FakeNamespace("Namespace")}
	for _, obj := range business.FakeDeployments(*conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	for _, obj := range business.FakeServices(*conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"Namespace"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/apps/{app}",
		AppDetails(deps.conf, deps.kialiCache, deps.cfm, deps.prom, deps.cpm, deps.traceLoader, deps.grafanaSvc, deps.discovery))

	resp, err := http.Get(ts.URL + "/api/namespaces/Namespace/apps/httpbin?health=false&istioResources=false")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}

// TestIstioConfigListNamespaceListAuthorizedColdCache: the namespace-scoped
// Istio config list is gated in GetIstioConfigListForNamespace (business
// layer). An empty config list is fine — the point is that the gate passes
// for a LIST-authorized user on a cold cache (it previously failed after
// cache expiry).
func TestIstioConfigListNamespaceListAuthorizedColdCache(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Namespace"))
	deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"Namespace"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/istio",
		IstioConfigList(deps.conf, deps.kialiCache, deps.cfm, deps.prom, deps.traceLoader, deps.discovery, deps.cpm, deps.grafanaSvc))

	resp, err := http.Get(ts.URL + "/api/namespaces/Namespace/istio")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}

// TestNamespaceTlsListAuthorizedColdCache is a regression guard for a
// LIST-authorized user on the namespace TLS status. Note it does not by
// itself prove the C1 fix: NamespaceWidemTLSStatus consults the accessible
// set (warming the cache) before its business gate, so the old GET-based
// gate also passed here.
func TestNamespaceTlsListAuthorizedColdCache(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Namespace"))
	deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"Namespace"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/tls",
		NamespaceTls(deps.conf, deps.kialiCache, deps.cfm, deps.prom, deps.cpm, deps.traceLoader, deps.grafanaSvc, deps.discovery))

	resp, err := http.Get(ts.URL + "/api/namespaces/Namespace/tls")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}

// TestNamespaceValidationSummaryListAuthorizedColdCache: the validation
// summary is gated per cluster through the fixed primitive.
func TestNamespaceValidationSummaryListAuthorizedColdCache(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Namespace"))
	deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"Namespace"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/validations",
		NamespaceValidationSummary(deps.conf, deps.kialiCache, deps.cfm, deps.prom, deps.cpm, deps.traceLoader, deps.grafanaSvc, deps.discovery))

	resp, err := http.Get(ts.URL + "/api/namespaces/Namespace/validations")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}

// TestBusinessGatedEndpointsInaccessibleNamespace: the same business-layer
// gates must deny a user whose LIST excludes the namespace.
func TestBusinessGatedEndpointsInaccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	mockClock()
	k8s := kubetest.NewFakeK8sClient(fakeWorkloadObjects(conf)...)

	cases := map[string]struct {
		pattern string
		url     string
		handler func(deps *gatedEndpointDeps) http.HandlerFunc
	}{
		"workload details": {
			pattern: "/api/namespaces/{namespace}/workloads/{workload}",
			url:     "/api/namespaces/Namespace/workloads/details-v1",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return WorkloadDetails(d.conf, d.kialiCache, d.cfm, d.cpm, d.prom, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
		"app details": {
			pattern: "/api/namespaces/{namespace}/apps/{app}",
			url:     "/api/namespaces/Namespace/apps/details",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return AppDetails(d.conf, d.kialiCache, d.cfm, d.prom, d.cpm, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
		"istio config list": {
			pattern: "/api/namespaces/{namespace}/istio",
			url:     "/api/namespaces/Namespace/istio",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return IstioConfigList(d.conf, d.kialiCache, d.cfm, d.prom, d.traceLoader, d.discovery, d.cpm, d.grafanaSvc)
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			deps := setupBusinessGatedDeps(t, k8s, "Namespace", []string{"bookinfo"})
			ts := serveGatedHandler(t, deps, tc.pattern, tc.handler(deps))
			resp, err := http.Get(ts.URL + tc.url)
			require.NoError(t, err)
			actual, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
		})
	}
}

// TestListEndpointsFailClosedWhenSetNotComputable pins the fail-closed
// contract for the list endpoints: when the accessible set cannot be
// computed at all (e.g. the namespace LIST against the API server fails),
// they reject with 500 instead of returning an empty (200) result set.
func TestListEndpointsFailClosedWhenSetNotComputable(t *testing.T) {
	// noPrivClient denies both LIST and GET, so the set cannot be computed.
	newFailing := func() kubernetes.UserClientInterface {
		return &noPrivClient{kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))}
	}

	cases := map[string]struct {
		pattern string
		url     string
		handler func(deps *gatedEndpointDeps) http.HandlerFunc
	}{
		"cluster apps": {
			pattern: "/api/clusters/apps",
			url:     "/api/clusters/apps",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return ClusterApps(d.conf, d.kialiCache, d.cfm, d.prom, d.cpm, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
		"cluster services": {
			pattern: "/api/clusters/services",
			url:     "/api/clusters/services",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return ClustersServices(d.conf, d.kialiCache, d.cfm, d.prom, d.cpm, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
		"cluster workloads": {
			pattern: "/api/clusters/workloads",
			url:     "/api/clusters/workloads",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return ClusterWorkloads(d.conf, d.kialiCache, d.cfm, d.cpm, d.prom, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
		"istio config validation summary": {
			pattern: "/api/istio/validations",
			url:     "/api/istio/validations",
			handler: func(d *gatedEndpointDeps) http.HandlerFunc {
				return IstioConfigValidationSummary(d.conf, d.kialiCache, d.cfm, d.prom, d.cpm, d.traceLoader, d.grafanaSvc, d.discovery)
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			require := require.New(t)
			deps := setupEndpointDepsWithClient(t, newFailing())
			ts := serveGatedHandler(t, deps, tc.pattern, tc.handler(deps))
			resp, err := http.Get(ts.URL + tc.url)
			require.NoError(err)
			actual, _ := io.ReadAll(resp.Body)
			assert.Equal(http.StatusInternalServerError, resp.StatusCode, string(actual))
		})
	}
}

// TestMetricsStatsAllDeniedReturns403 pins the MetricsStats status rule at
// the handler level: when every query target is an access denial (and the
// queries are otherwise valid), the endpoint returns 403, not the 500 the
// old util.Errors path produced.
func TestMetricsStatsAllDeniedReturns403(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Separate, unfiltered SA clients: victim-ns exists (the SA sees it) but
	// is denied to the user — this pins the denial path, not the "exists
	// nowhere" path.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	deps := setupEndpointDepsWithSAs(t,
		newRestrictedNamespaceClient(k8s, "victim-ns", []string{"bookinfo"}),
		kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	ts := serveGatedHandler(t, deps, "/api/stats/metrics", MetricsStats(deps.conf, deps.kialiCache, deps.discovery, deps.cfm, deps.prom))

	body := `{"queries":[{"target":{"cluster":"","name":"x","namespace":"victim-ns","kind":"app"},"direction":"outbound","interval":"30m","queryTime":1700000000}]}`
	resp, err := http.Post(ts.URL+"/api/stats/metrics", "application/json", strings.NewReader(body))
	require.NoError(err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(http.StatusForbidden, resp.StatusCode, string(actual))
	// The denial-path message, not the "exists nowhere" one: this pins that
	// the namespace exists (the SA sees it) and the user is denied.
	assert.Contains(string(actual), "every cluster where it exists", string(actual))
}

// TestMetricsStatsInvalidQueryReturns400 pins the other side of the rule: an
// invalid query (not a denial) maps to 400 when no query survives.
func TestMetricsStatsInvalidQueryReturns400(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	deps := setupEndpointDepsWithClient(t, k8s)
	ts := serveGatedHandler(t, deps, "/api/stats/metrics", MetricsStats(deps.conf, deps.kialiCache, deps.discovery, deps.cfm, deps.prom))

	// Missing queryTime and interval: invalid.
	body := `{"queries":[{"target":{"cluster":"","name":"x","namespace":"bookinfo","kind":"app"},"direction":"outbound"}]}`
	resp, err := http.Post(ts.URL+"/api/stats/metrics", "application/json", strings.NewReader(body))
	require.NoError(err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(http.StatusBadRequest, resp.StatusCode, string(actual))
}

// TestMetricsStatsUnrecognizedBodyReturns400 pins that a body which does not
// match the MetricsStatsQueries schema does not silently produce 200 with
// empty stats: the JSON decoder ignores unknown fields, so such a body decodes
// to zero queries, which must be rejected. This stays distinct from the
// all-denied case, which keeps returning 403 (see
// TestMetricsStatsAllDeniedReturns403).
func TestMetricsStatsUnrecognizedBodyReturns400(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	deps := setupEndpointDepsWithClient(t, k8s)
	ts := serveGatedHandler(t, deps, "/api/stats/metrics", MetricsStats(deps.conf, deps.kialiCache, deps.discovery, deps.cfm, deps.prom))

	for name, body := range map[string]string{
		"unrecognized fields": `{"commands":[{"target":{"namespace":"bookinfo"}}]}`,
		"empty query list":    `{"queries":[]}`,
	} {
		t.Run(name, func(t *testing.T) {
			resp, err := http.Post(ts.URL+"/api/stats/metrics", "application/json", strings.NewReader(body))
			require.NoError(err)
			actual, _ := io.ReadAll(resp.Body)

			assert.Equal(http.StatusBadRequest, resp.StatusCode, string(actual))
			assert.Contains(string(actual), "at least one query")
		})
	}
}

// TestIstioConfigDetailsInaccessibleNamespace covers the gated route the
// behavioral sweep cannot reach (its path requires a valid Istio GVK, which
// the sweep's dummy substitution cannot provide): the business gate in
// GetIstioConfigDetail must deny an inaccessible namespace before any config
// lookup.
func TestIstioConfigDetailsInaccessibleNamespace(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("victim-ns"))
	deps := setupBusinessGatedDeps(t, k8s, "victim-ns", []string{"bookinfo"})
	ts := serveGatedHandler(t, deps, "/api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}",
		IstioConfigDetails(deps.conf, deps.kialiCache, deps.cfm, deps.prom, deps.traceLoader, deps.discovery, deps.cpm, deps.grafanaSvc))

	resp, err := http.Get(ts.URL + "/api/namespaces/victim-ns/istio/networking.istio.io/v1/VirtualService/dummy")
	require.NoError(err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestNamespaceValidationSummaryMultiCluster pins the multi-cluster branch:
// summaries are merged from the clusters where the namespace is in the
// user's accessible set (the cluster parameter is ignored, as before), and a
// namespace accessible nowhere is a 403 rather than an empty 200.
func TestNamespaceValidationSummaryMultiCluster(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "hub"
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.ExternalServices.CustomDashboards.Enabled = false
	// Save and restore the globals this mutates, like the deps helpers do.
	previousConf := config.Get()
	config.Set(conf)
	t.Cleanup(func() { config.Set(previousConf) })
	previousClock := util.Clock
	util.Clock = util.RealClock{}
	t.Cleanup(func() { util.Clock = previousClock })

	// Two clusters, each with the namespace. The user can see bookinfo on
	// spoke only (their hub LIST excludes it).
	hubUser := newRestrictedNamespaceClient(
		kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"bookinfo", []string{"other"},
	)
	spokeUser := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	spokeUser.CacheKey = "spoke-user"
	userClients := map[string]kubernetes.UserClientInterface{"hub": hubUser, "spoke": spokeUser}

	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{
		"hub":   kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"spoke": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	})

	cf := kubetest.NewFakeClientFactory(conf, userClients)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	require.Len(discovery.Clusters(), 2, "the test needs a multi-cluster discovery")

	prom, err := prometheus.NewClient(*conf, spokeUser.GetToken())
	require.NoError(err)
	grafanaSvc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(err)

	handler := WithFakeAuthInfo(conf, NamespaceValidationSummary(conf, kialiCache, cf, prom, &business.FakeControlPlaneMonitor{}, func() tracing.ClientInterface { return nil }, grafanaSvc, discovery))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/validations", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Accessible on spoke only: merged (here empty) summary, 200.
	resp, err := http.Get(ts.URL + "/api/namespaces/bookinfo/validations")
	require.NoError(err)
	actual, _ := io.ReadAll(resp.Body)
	assert.Equal(http.StatusOK, resp.StatusCode, string(actual))

	// Accessible nowhere: 403, not an empty 200.
	resp, err = http.Get(ts.URL + "/api/namespaces/victim-ns/validations")
	require.NoError(err)
	actual, _ = io.ReadAll(resp.Body)
	assert.Equal(http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestMetricsStatsAbsentNamespaceReturns403 pins the other side of the
// MetricsStats rule intentionally: a target namespace that exists in no
// cluster (the SA cannot see it either) is also a 403, with the
// "not accessible" message rather than the denial-path one.
func TestMetricsStatsAbsentNamespaceReturns403(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	deps := setupEndpointDepsWithSAs(t, k8s, kubetest.FakeNamespace("bookinfo"))
	ts := serveGatedHandler(t, deps, "/api/stats/metrics", MetricsStats(deps.conf, deps.kialiCache, deps.discovery, deps.cfm, deps.prom))

	// ghost-ns exists nowhere: not in the user's fake, not in the SA's.
	body := `{"queries":[{"target":{"cluster":"","name":"x","namespace":"ghost-ns","kind":"app"},"direction":"outbound","interval":"30m","queryTime":1700000000}]}`
	resp, err := http.Post(ts.URL+"/api/stats/metrics", "application/json", strings.NewReader(body))
	require.NoError(err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(http.StatusForbidden, resp.StatusCode, string(actual))
	assert.Contains(string(actual), "ghost-ns] is not accessible", string(actual))
	assert.NotContains(string(actual), "every cluster where it exists", string(actual))
}
