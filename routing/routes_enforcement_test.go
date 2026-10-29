package routing

import (
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/filetest"
)

// This file is the machine-checked route inventory for namespace
// authorization (#10443): every registered route must be classified in
// exactly one of three maps, and the gated routes are behaviorally swept —
// a request for a namespace the user cannot access must be denied. A new
// namespace-scoped endpoint added without a check fails here instead of
// waiting for the next security report.

// gatedRoutes are namespace-scoped routes that go through the canonical
// accessible-set check (handler gate or business-layer gate). They are
// behaviorally swept in TestGatedRouteBehavioralSweep.
var gatedRoutes = map[string]string{
	"IstioConfigList":            "business gate in GetIstioConfigListForNamespace",
	"IstioConfigDetails":         "business gate in GetIstioConfigDetail",
	"ServiceDetails":             "business gate in GetService",
	"WorkloadDetails":            "business gate in fetchWorkload",
	"AppDetails":                 "business gate in GetAppDetails",
	"AppTraces":                  "handler gate (canonical check)",
	"AppSpans":                   "handler gate (canonical check)",
	"ErrorTraces":                "handler gate (canonical check)",
	"ServiceTraces":              "handler gate (canonical check)",
	"ServiceSpans":               "handler gate (canonical check)",
	"WorkloadTraces":             "handler gate (canonical check)",
	"WorkloadSpans":              "handler gate (canonical check)",
	"ServiceMetrics":             "handler gate (canonical check)",
	"AggregateMetrics":           "cross-cluster gate (CheckNamespaceAccessAllClusters)",
	"AppMetrics":                 "handler gate (canonical check)",
	"WorkloadMetrics":            "handler gate (canonical check)",
	"NamespaceMetrics":           "handler gate (canonical check)",
	"ControlPlaneMetrics":        "handler gate (canonical check)",
	"UsageMetrics":               "handler gate (canonical check)",
	"ServiceDashboard":           "handler gate (canonical check)",
	"AppDashboard":               "handler gate (canonical check)",
	"WorkloadDashboard":          "handler gate (canonical check)",
	"CustomDashboard":            "handler gate (canonical check)",
	"ZtunnelDashboard":           "cross-cluster gate (CheckNamespaceAccessAllClusters)",
	"NamespaceValidationSummary": "per-cluster gate through the fixed primitive",
	"ConfigValidationSummary":    "per-namespace gate through GetValidationsForNamespace",
	"NamespaceInfo":              "canonical check",
	"NamespaceTls":               "accessible set + business gate",
	"PodLogs":                    "handler gate for SA-backed log types (UsesKialiSA)",
	"PodConfigDump":              "handler gate (SA port-forward backing)",
	"PodProxyResource":           "handler gate (SA port-forward backing)",
	"ZtunnelConfigDump":          "handler gate (#10437)",
	"MetricsStats":               "per-target gate in prepareStatsQueries",
}

// exemptRoutes are routes that deliberately carry no Kiali-level namespace
// gate, each with its justification.
var exemptRoutes = map[string]string{
	"IstioConfigPermissions":    "returns the user's own RBAC (SelfSubjectAccessReview); no tenant data",
	"IstioConfigDelete":         "write via the user's credentials; the API server enforces RBAC",
	"IstioConfigUpdate":         "write via the user's credentials; the API server enforces RBAC",
	"IstioConfigCreate":         "write via the user's credentials; the API server enforces RBAC",
	"ServiceUpdate":             "write via the user's credentials; the API server enforces RBAC",
	"WorkloadUpdate":            "write via the user's credentials; the API server enforces RBAC",
	"NamespaceUpdate":           "write via the user's credentials; accessible-set precheck in UpdateNamespace",
	"ClustersServices":          "list filtered by the accessible set (GetClusterNamespaces)",
	"ClustersApps":              "list filtered by the accessible set",
	"ClusterWorkloads":          "list filtered by the accessible set",
	"ClustersMetrics":           "list filtered by the accessible set",
	"NamespaceList":             "the namespace picker; returns the accessible set itself",
	"IstioConfigListAll":        "objects filtered by the accessible set; validations filtered by GetValidations; body-checked in handlers tests",
	"ClustersHealth":            "accessible-set filtered (#10437)",
	"ClusterTls":                "accessible-set filtered",
	"MeshTls":                   "mesh-wide mTLS status; not namespace-scoped",
	"MeshControlPlanes":         "control-plane visibility via filterAccessibleControlPlanes (fail closed)",
	"MeshGraph":                 "mesh-access gate + filterAccessibleControlPlanes",
	"IstioStatus":               "control-plane entries kept for all users; autodiscovered gateway entries filtered by the accessible set (filterStatusForUser); body-checked in business tests",
	"Diagnose":                  "gated by HasMeshAccess (accessible-set based)",
	"Tracing check":             "gated by HasMeshAccess (accessible-set based)",
	"GraphNamespaces":           "graph engine filters namespaces by the accessible set",
	"GraphAggregate":            "graph engine filters namespaces by the accessible set",
	"GraphAggregateByService":   "graph engine filters namespaces by the accessible set",
	"GraphAppVersion":           "graph engine filters namespaces by the accessible set",
	"GraphApp":                  "graph engine filters namespaces by the accessible set",
	"GraphService":              "graph engine filters namespaces by the accessible set",
	"GraphWorkload":             "graph engine filters namespaces by the accessible set",
	"TracesDetails":             "authorizes the fetched trace against participating namespaces (CheckTraceAccess); covered by dedicated tests",
	"PodDetails":                "GetPod uses the user's clients; the API server enforces",
	"PodProxyLogging":           "uses the user's clients; the API server enforces",
	"OverviewServiceLatencies":  "list filtered by the accessible set",
	"OverviewServiceRates":      "list filtered by the accessible set",
	"OverviewServiceThroughput": "list filtered by the accessible set",
	"OverviewAppRates":          "list filtered by the accessible set",
	"TestHealthStatusMetrics":   "health-status entries filtered by the accessible set (cluster-aware); body-checked in handlers tests",
	"ChatAI":                    "MCP tools invoked by the assistant gate themselves",
	"ChatMCP":                   "MCP tools gate via mcputil.ValidateNamespaceAccess / CheckTraceAccess",
}

// noNamespaceDataRoutes serve no tenant namespace data at all.
var noNamespaceDataRoutes = map[string]string{
	"Healthz":                "server liveness",
	"Root":                   "Kiali status",
	"Authenticate":           "authentication",
	"OpenshiftCheckToken":    "authentication",
	"Logout":                 "authentication",
	"AuthenticationInfo":     "authentication strategy info",
	"Status":                 "Kiali status",
	"TestGraphCacheMetrics":  "internal metrics",
	"TestHealthCacheMetrics": "internal metrics",
	"Config":                 "Kiali configuration",
	"DisabledFeatures":       "feature flags",
	"GrafanaURL":             "external link info",
	"PersesURL":              "external link info",
	"TracingURL":             "external link info",
	"ChatPrompts":            "user's own AI prompts",
	"DeleteConversations":    "user's own AI conversations",
	"ChatSessionUsage":       "user's own AI session usage",
}

// classifyRoute returns which map a route name belongs to. PProf routes
// (added conditionally when the profiler is enabled) are profile dumps with
// no namespace data.
func classifyRoute(name string) (classification, note string, found bool) {
	if strings.HasPrefix(name, "PProf ") {
		return "noNamespaceData", "profiler dump", true
	}
	if note, ok := gatedRoutes[name]; ok {
		return "gated", note, true
	}
	if note, ok := exemptRoutes[name]; ok {
		return "exempt", note, true
	}
	if note, ok := noNamespaceDataRoutes[name]; ok {
		return "noNamespaceData", note, true
	}
	return "", "", false
}

// TestRouteInventoryComplete walks the real router and requires every named
// route to be classified in exactly one map. Walking the real router (rather
// than NewRoutes) includes the strategy-conditional and profiler routes.
// Note: the OpenShift auth-redirect/callback routes are only registered
// under the openshift auth strategy; they are authentication routes with no
// namespace data.
func TestRouteInventoryComplete(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = config.Credential(util.RandomString(32))
	conf.Server.Profiler.Enabled = true
	cf := kubetest.NewFakeClientFactoryWithClient(conf, kubetest.NewFakeK8sClient())
	router, err := NewRouter(t.Context(), conf, nil, cf, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	require.NoError(err)

	seen := map[string]bool{}
	var unclassified []string
	require.NoError(router.Walk(func(route *mux.Route, _ *mux.Router, _ []*mux.Route) error {
		name := route.GetName()
		if name == "" || seen[name] {
			// Unnamed routes are the static file server and /console; the
			// Authenticate name is registered for both GET and POST.
			return nil
		}
		seen[name] = true
		if _, _, ok := classifyRoute(name); !ok {
			unclassified = append(unclassified, name)
		}
		return nil
	}))

	require.Empty(unclassified,
		"every registered route must be classified in routes_enforcement_test.go (gatedRoutes, exemptRoutes or noNamespaceDataRoutes); unclassified: %v", unclassified)

	// A route listed in more than one map is a classification error even
	// though classifyRoute returns the first match.
	for name := range gatedRoutes {
		if _, ok := exemptRoutes[name]; ok {
			t.Errorf("route %q is classified as both gated and exempt", name)
		}
		if _, ok := noNamespaceDataRoutes[name]; ok {
			t.Errorf("route %q is classified as both gated and noNamespaceData", name)
		}
	}
	for name := range exemptRoutes {
		if _, ok := noNamespaceDataRoutes[name]; ok {
			t.Errorf("route %q is classified as both exempt and noNamespaceData", name)
		}
	}

	// Every classified name must correspond to a real route (guards against
	// stale entries after a rename).
	for name := range gatedRoutes {
		require.True(seen[name], "gatedRoutes entry %q does not match any registered route", name)
	}
	for name := range exemptRoutes {
		require.True(seen[name], "exemptRoutes entry %q does not match any registered route", name)
	}
	for name := range noNamespaceDataRoutes {
		require.True(seen[name], "noNamespaceDataRoutes entry %q does not match any registered route", name)
	}
}

// sweepExceptions are gated routes the behavioral sweep cannot reach with a
// plain denied-namespace request, each with its reason and the dedicated
// test that covers the gate instead.
var sweepExceptions = map[string]string{
	"ControlPlaneMetrics": "the HasControlPlane check runs before the gate and needs a discovered istiod; the gate itself is the same canonical check the six swept metrics endpoints exercise",
	"MetricsStats":        "requires a POST body of stats queries; covered by TestPrepareStatsQueries* and TestMetricsStatsAllDeniedReturns403/TestMetricsStatsInvalidQueryReturns400",
	"IstioConfigDetails":  "the path requires a valid Istio GVK, which the sweep's dummy substitution cannot provide; covered by TestIstioConfigDetailsInaccessibleNamespace (handlers)",
}

// panicToleratedRoutes are routes whose accessible-namespace positive control
// panics past the gate in deeper, unmocked code. For these the control only
// proves "the gate did not deny"; any route NOT listed here must answer
// without panicking, so a handler that dies before responding cannot pass as
// a green control unnoticed.
var panicToleratedRoutes = map[string]string{
	"PodLogs": "the log streaming forwards to the dummy pod, which does not exist in the sweep's fakes",
}

// sweepQuery holds the minimal query parameters a gated route needs to reach
// its gate (unknown parameters are rejected with 400 before it).
var sweepQuery = map[string]string{
	"PodLogs":                 "logType=ztunnel",
	"ErrorTraces":             "duration=600",
	"ConfigValidationSummary": "namespaces=victim-ns",
}

// TestGatedRouteBehavioralSweep is the enforcement: for every gated route,
// a request for a namespace the user cannot access must be denied (403).
// The SA clients are deliberately unfiltered so the SA-vs-user distinction
// is real (the SA sees the namespace, the user does not).
//
// Scope: the sweep exercises GET routes only — the gated set is GET-only
// today, because namespace-scoped non-GET routes are writes, which rely on
// the cluster's own RBAC rather than Kiali's namespace gate. Its route
// table comes from NewRoutes, so strategy-conditional routes (the OpenShift
// auth-redirect and callback routes, registered only under the openshift
// auth strategy) are not swept; they are authentication routes carrying no
// namespace data, and TestRouteInventoryComplete still requires them to be
// classified.
// sweepSetup builds the route table with a restricted user (victim-ns
// exists and the SA sees it, but the user's LIST excludes it and their
// per-namespace GET is denied) and unfiltered SA clients, so the SA-vs-user
// distinction is real.
type sweepSetup struct {
	conf       *config.Config
	kialiCache cache.KialiCache
	route      func(name string) *Route
}

func newSweepSetup(t *testing.T) *sweepSetup {
	t.Helper()
	require := require.New(t)

	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.ExternalServices.Tracing.Enabled = true
	conf.Server.Observability.Metrics.HealthStatus.Enabled = true
	// config.Set initializes the package-global app/version label name
	// lists that the app listing machinery reads; without it no app can be
	// derived from workload labels. It replaces the global config, so save
	// and restore it like the clock above: later tests in the package must
	// not silently inherit this sweep's settings.
	previousConf := config.Get()
	config.Set(conf)
	t.Cleanup(func() { config.Set(previousConf) })

	// Some handlers read the clock; it is a package-level provider that the
	// server initializes at startup (tests usually set a mock). Restore it so
	// this test cannot perturb others.
	previousClock := util.Clock
	util.Clock = util.RealClock{}
	t.Cleanup(func() { util.Clock = previousClock })

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
	)
	userClient := kubetest.NewNamespaceRestrictedClient(k8s, "restricted-user", []string{"bookinfo"}, "victim-ns")

	cf := kubetest.NewFakeClientFactoryWithClient(conf, userClient)
	// The SA must see every namespace even though the user cannot — and the
	// SA-side objects below give the denied namespace real content, so a
	// route that leaks it has something to return (a body check with nothing
	// to leak cannot fail).
	cf.WithSAClient(conf.KubernetesConfig.ClusterName,
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "svc-bookinfo", Namespace: "bookinfo", Labels: map[string]string{"app": "bookinfo-app"}}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "svc-victim", Namespace: "victim-ns", Labels: map[string]string{"app": "victim-app"}}},
		// The app/workload casting reads labels from the pod template, not
		// the deployment metadata.
		&appsv1.Deployment{
			TypeMeta:   metav1.TypeMeta{APIVersion: kubernetes.Deployments.GroupVersion().String(), Kind: kubernetes.Deployments.Kind},
			ObjectMeta: metav1.ObjectMeta{Name: "dep-bookinfo", Namespace: "bookinfo"},
			Spec: appsv1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "bookinfo-app"}}},
			},
		},
		&appsv1.Deployment{
			TypeMeta:   metav1.TypeMeta{APIVersion: kubernetes.Deployments.GroupVersion().String(), Kind: kubernetes.Deployments.Kind},
			ObjectMeta: metav1.ObjectMeta{Name: "dep-victim", Namespace: "victim-ns"},
			Spec: appsv1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "victim-app"}}},
			},
		},
		&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "pod-bookinfo", Namespace: "bookinfo", Labels: map[string]string{"app": "bookinfo-app"}}},
		&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "pod-victim", Namespace: "victim-ns", Labels: map[string]string{"app": "victim-app"}}},
	)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)

	xapi := new(prometheustest.PromAPIMock)
	// Return empty results for any Prometheus call so prom-backed routes do
	// not panic on unexpected mock calls.
	xapi.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom, err := prometheus.NewClient(*conf, userClient.GetToken())
	require.NoError(err)
	prom.Inject(xapi)

	grafanaSvc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(err)
	persesSvc, err := perses.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(err)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }
	routes := NewRoutes(conf, kialiCache, cf, cpm, prom, traceLoader, nil, grafanaSvc, persesSvc, discovery, nil, nil, nil)

	byName := map[string]*Route{}
	for i := range routes.Routes {
		byName[routes.Routes[i].Name] = &routes.Routes[i]
	}
	return &sweepSetup{conf: conf, kialiCache: kialiCache, route: func(name string) *Route { return byName[name] }}
}

func TestGatedRouteBehavioralSweep(t *testing.T) {
	require := require.New(t)
	setup := newSweepSetup(t)
	conf := setup.conf

	// Deterministic order.
	gatedNames := make([]string, 0, len(gatedRoutes))
	for name := range gatedRoutes {
		gatedNames = append(gatedNames, name)
	}
	sort.Strings(gatedNames)

	swept := 0
	for _, name := range gatedNames {
		route := setup.route(name)
		if route == nil {
			continue
		}
		if _, ok := sweepExceptions[name]; ok {
			continue
		}
		if route.Method != http.MethodGet {
			// Namespace-scoped non-GET routes are writes, which are exempt;
			// the gated set is GET-only today.
			continue
		}

		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			// Substitute the denied namespace and dummy values for the
			// remaining path parameters.
			path := strings.ReplaceAll(route.Pattern, "{namespace}", "victim-ns")
			path = paramSubstitutionRe.ReplaceAllString(path, "dummy")

			// Route through mux so the path variables are parsed (calling
			// the handler directly would leave {namespace} unset).
			w := requestRoute(t, conf, route, path, sweepQuery[name])
			body, _ := io.ReadAll(w.Result().Body)
			assert.Equal(http.StatusForbidden, w.Result().StatusCode,
				"gated route %s (%s) must deny an inaccessible namespace; got %d: %s",
				route.Name, route.Pattern, w.Result().StatusCode, string(body))
			// The 403 must come from the namespace gate, not from an
			// unrelated denial (e.g. a feature flag) that would pass the
			// status check by accident.
			assert.Contains(string(body), "not accessible",
				"the 403 must originate from the namespace gate")

			// Positive control: the same request for the accessible
			// namespace must NOT be a 403. A panic is reported: without the
			// no-panic assertion a handler that dies before answering would
			// look identical to a pass, and the control would prove only
			// "the gate didn't deny".
			accessiblePath := strings.ReplaceAll(route.Pattern, "{namespace}", "bookinfo")
			accessiblePath = paramSubstitutionRe.ReplaceAllString(accessiblePath, "dummy")
			accessibleQuery := strings.ReplaceAll(sweepQuery[name], "victim-ns", "bookinfo")
			wAccessible, panicked := requestRouteWithRecover(t, conf, route, accessiblePath, accessibleQuery)
			if _, tolerated := panicToleratedRoutes[name]; tolerated {
				assert.True(panicked || wAccessible != nil, "accessible-namespace request for %s neither panicked nor answered", route.Name)
			} else {
				assert.False(panicked,
					"accessible-namespace request for %s panicked past the gate; the positive control only proves the gate did not deny; if the panic is expected in deeper unmocked code, document it in panicToleratedRoutes", route.Name)
			}
			if wAccessible != nil {
				assert.NotEqual(http.StatusForbidden, wAccessible.Code,
					"gated route %s must not deny the accessible namespace; body: %s",
					route.Name, wAccessible.Body.String())
			}
		})
		swept++
	}

	// The sweep must actually sweep: if route registration changes such that
	// nothing is swept, the test is lying.
	require.Greater(swept, 25, "the behavioral sweep must cover the gated routes")
}

// requestRoute sends a request for the given path (and optional query)
// through a mux router so the route's path variables are parsed.
func requestRoute(t *testing.T, conf *config.Config, route *Route, path, query string) *httptest.ResponseRecorder {
	t.Helper()
	handler := handlers.WithFakeAuthInfo(conf, route.HandlerFunc)
	router := mux.NewRouter()
	router.HandleFunc(route.Pattern, handler).Methods(route.Method)
	url := "http://kiali" + path
	if query != "" {
		url += "?" + query
	}
	req := httptest.NewRequest(route.Method, url, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// requestRouteWithRecover is requestRoute that tolerates a panic in the
// handler (deeper, unmocked code past the gate) by returning a nil recorder
// and reporting the panic, so the positive control can distinguish "the
// gate passed" from "the handler died before answering".
func requestRouteWithRecover(t *testing.T, conf *config.Config, route *Route, path, query string) (w *httptest.ResponseRecorder, panicked bool) {
	t.Helper()
	defer func() {
		if recover() != nil {
			w = nil
			panicked = true
		}
	}()
	return requestRoute(t, conf, route, path, query), false
}

// paramSubstitutionRe matches the remaining mux path parameters after the
// namespace has been substituted.
var paramSubstitutionRe = regexp.MustCompile(`\{[a-zA-Z]+\}`)

// cRouteBodyCheckRoutes are the accessible-set-filtered list routes: they
// have no Kiali-level gate (their result set is the accessible set itself),
// so their enforcement is a body check — a 200 response must not contain any
// data from the denied namespace. This is what catches a "C" route leaking
// through a side payload the way the cluster-wide validations once did.
// cRouteBodyCheckEntry describes one accessible-set-filtered route for the
// body check: the query that produces its namespace-scoped payload, and
// content that MUST appear (proving the route returned real data, so an
// empty body cannot pass by accident). The routes are requested with the
// denied namespace explicitly where a namespaces parameter exists — the
// point is to prove the filter drops it, not that it was never asked for.
//
// Notes on what is NOT here:
//   - ClustersHealth is requested without parameters: its explicit
//     namespaces parameter is a gate that 403s on the denied namespace
//     (covered by the handlers health tests), so the body check exercises
//     its empty-parameter accessible-set path with seeded health data.
//   - The Overview routes are Prometheus-sourced with no namespace
//     parameters; with the mocked (empty) Prometheus they have no payload to
//     leak, so they are not body-checked here.
var cRouteBodyCheckRoutes = map[string]cRouteBodyCheckEntry{
	"ClustersApps": {
		query:          "namespaces=bookinfo,victim-ns",
		mustContain:    "bookinfo-app",
		mustNotContain: "victim",
	},
	"ClustersServices": {
		query:          "namespaces=bookinfo,victim-ns",
		mustContain:    "svc-bookinfo",
		mustNotContain: "victim",
	},
	"ClusterWorkloads": {
		query:          "namespaces=bookinfo,victim-ns",
		mustContain:    "dep-bookinfo",
		mustNotContain: "victim",
	},
	"ClustersMetrics": {
		query:          "namespaces=bookinfo,victim-ns",
		mustContain:    "bookinfo",
		mustNotContain: "victim-ns",
	},
	"IstioConfigListAll": {
		query:          "validate=true",
		mustContain:    "vs-allowed",
		mustNotContain: "victim",
	},
	"NamespaceList": {
		query:          "",
		mustContain:    "bookinfo",
		mustNotContain: "victim-ns",
	},
	"ClustersHealth": {
		query:          "",
		mustContain:    "bookinfo",
		mustNotContain: "victim-ns",
	},
	"ClusterTls": {
		query:          "namespaces=bookinfo,victim-ns",
		mustContain:    "bookinfo",
		mustNotContain: "victim-ns",
	},
}

type cRouteBodyCheckEntry struct {
	// query is appended to the route pattern (may be empty).
	query string
	// mustContain must appear in the 200 body: proves the route returned
	// real data for the accessible namespace.
	mustContain string
	// mustNotContain must not appear in the body: the denied namespace's
	// content (names, object names, namespace keys).
	mustNotContain string
}

// TestCRouteBodyCheck sweeps the accessible-set-filtered list routes with
// the restricted user. The SA side holds real victim-ns content (objects,
// validations, health), so a route that leaks it has something to return:
// each route must return 200, contain the accessible namespace's seeded
// content, and contain nothing from the denied namespace.
func TestCRouteBodyCheck(t *testing.T) {
	require := require.New(t)
	setup := newSweepSetup(t)

	// Seed the SA-populated validations cache with entries in both
	// namespaces; the bookinfo entry references an object in victim-ns so
	// reference pruning is covered too.
	cluster := setup.conf.KubernetesConfig.ClusterName
	allowedKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "vs-allowed", Cluster: cluster}
	victimKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "vs-victim", Cluster: cluster}
	setup.kialiCache.Validations().Replace(map[models.IstioValidationKey]*models.IstioValidation{
		allowedKey: {
			Name: "vs-allowed", Namespace: "bookinfo", Cluster: cluster,
			ObjectGVK:  kubernetes.VirtualServices,
			Valid:      true,
			References: []models.IstioValidationKey{allowedKey, victimKey},
		},
		victimKey: {
			Name: "vs-victim", Namespace: "victim-ns", Cluster: cluster,
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     false,
		},
	})

	// Seed the health cache for both namespaces so the health endpoint's
	// body has per-namespace content to (not) leak.
	setup.kialiCache.SetHealth(cluster, "bookinfo", &models.CachedHealthData{Namespace: "bookinfo", Cluster: cluster})
	setup.kialiCache.SetHealth(cluster, "victim-ns", &models.CachedHealthData{Namespace: "victim-ns", Cluster: cluster})

	names := make([]string, 0, len(cRouteBodyCheckRoutes))
	for name := range cRouteBodyCheckRoutes {
		names = append(names, name)
	}
	sort.Strings(names)

	checked := 0
	for _, name := range names {
		route := setup.route(name)
		require.NotNil(route, "cRouteBodyCheckRoutes entry %q does not match any registered route", name)
		entry := cRouteBodyCheckRoutes[name]

		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			w := requestRoute(t, setup.conf, route, route.Pattern, entry.query)
			body, _ := io.ReadAll(w.Result().Body)
			assert.Equal(http.StatusOK, w.Result().StatusCode,
				"C route %s must succeed for the restricted user; got %d: %s",
				route.Name, w.Result().StatusCode, string(body))
			assert.Contains(string(body), entry.mustContain,
				"C route %s must return the accessible namespace's content (proves the body check is not vacuous)", route.Name)
			assert.NotContains(string(body), entry.mustNotContain,
				"C route %s must not return any data for the denied namespace", route.Name)
		})
		checked++
	}
	require.Greater(checked, 5, "the C-route body check must actually check routes")
}
