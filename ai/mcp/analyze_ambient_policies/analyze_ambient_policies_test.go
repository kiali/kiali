package analyze_ambient_policies

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networking_v1_api "istio.io/api/networking/v1"
	security_v1_api "istio.io/api/security/v1"
	telemetry_v1_api "istio.io/api/telemetry/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestIsL7Policy_HTTPMethods(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Methods: []string{"GET", "POST"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with HTTP methods should be L7")
	assert.Equal(t, "Uses HTTP methods field", reason)
}

func TestIsL7Policy_HTTPPaths(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Paths: []string{"/api/*"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with HTTP paths should be L7")
	assert.Equal(t, "Uses HTTP paths field", reason)
}

func TestIsL7Policy_RequestHeaders(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				When: []*security_v1_api.Condition{
					{
						Key:    "request.headers[x-custom]",
						Values: []string{"value"},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with request.headers should be L7")
	assert.Contains(t, reason, "request.headers")
}

func TestIsL7Policy_JWTClaims(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				When: []*security_v1_api.Condition{
					{
						Key:    "request.auth.claims[iss]",
						Values: []string{"https://issuer.example.com"},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with JWT claims should be L7")
	assert.Contains(t, reason, "request.auth.claims")
}

func TestIsL7Policy_RequestPrincipals(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{
						Source: &security_v1_api.Source{
							RequestPrincipals: []string{"cluster.local/ns/default/sa/myapp"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with request principals should be L7")
	assert.Equal(t, "Uses request principals (JWT)", reason)
}

func TestIsL7Policy_L4Only(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{
						Source: &security_v1_api.Source{
							Principals: []string{"cluster.local/ns/default/sa/myapp"},
							Namespaces: []string{"default"},
						},
					},
				},
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Ports: []string{"8080"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.False(t, isL7, "Policy with only L4 fields should NOT be L7")
	assert.Empty(t, reason)
}

func TestIsL7Policy_EmptyPolicy(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{},
	}

	isL7, reason := isL7Policy(spec)
	assert.False(t, isL7, "Empty policy should not be L7")
	assert.Empty(t, reason)
}

func TestIsL7Policy_NilPolicy(t *testing.T) {
	isL7, reason := isL7Policy(nil)
	assert.False(t, isL7, "Nil policy should not be L7")
	assert.Empty(t, reason)
}

func TestGenerateSummary_NoAmbient(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:      "test-ns",
		IsAmbient: false,
	}

	summary := generateSummary(2, 3, 0, nsStatus)
	assert.Contains(t, summary, "NOT in Ambient mode")
	assert.Contains(t, summary, "sidecars")
}

func TestGenerateSummary_AmbientWithWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	summary := generateSummary(1, 2, 0, nsStatus)
	assert.Contains(t, summary, "waypoint-proxy")
	assert.NotContains(t, summary, "WARNING")
}

func TestGenerateSummary_AmbientWithoutWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	summary := generateSummary(1, 2, 2, nsStatus)
	assert.Contains(t, summary, "WARNING")
	assert.Contains(t, summary, "will NOT work!")
}

func TestGenerateRecommendations_NeedWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	recommendations := generateRecommendations(nsStatus, 2, 2)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "Deploy a waypoint")
	assert.Contains(t, recommendations[0], "istioctl waypoint apply")
}

func TestGenerateRecommendations_NoIssues(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	recommendations := generateRecommendations(nsStatus, 2, 0)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "No issues found")
}

// --- isL7Condition tests ---

func TestIsL7Condition_DestinationPortIsL4(t *testing.T) {
	assert.False(t, isL7Condition("destination.port"), "destination.port should be L4 (processed by ztunnel)")
}

func TestIsL7Condition_RequestHeaders(t *testing.T) {
	assert.True(t, isL7Condition("request.headers[x-forwarded-for]"))
}

func TestIsL7Condition_RequestAuthClaims(t *testing.T) {
	assert.True(t, isL7Condition("request.auth.claims[iss]"))
}

// --- isL7DestinationRule tests ---

func TestIsL7DestinationRule_HTTPConnectionPool(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{
		TrafficPolicy: &networking_v1_api.TrafficPolicy{
			ConnectionPool: &networking_v1_api.ConnectionPoolSettings{
				Http: &networking_v1_api.ConnectionPoolSettings_HTTPSettings{
					Http1MaxPendingRequests: 1024,
				},
			},
		},
	}
	isL7, reason := isL7DestinationRule(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "HTTP connection pool")
}

func TestIsL7DestinationRule_HTTPConsistentHash(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{
		TrafficPolicy: &networking_v1_api.TrafficPolicy{
			LoadBalancer: &networking_v1_api.LoadBalancerSettings{
				LbPolicy: &networking_v1_api.LoadBalancerSettings_ConsistentHash{
					ConsistentHash: &networking_v1_api.LoadBalancerSettings_ConsistentHashLB{
						HashKey: &networking_v1_api.LoadBalancerSettings_ConsistentHashLB_HttpHeaderName{
							HttpHeaderName: "x-user",
						},
					},
				},
			},
		},
	}
	isL7, reason := isL7DestinationRule(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "HTTP-based load balancing")
}

func TestIsL7DestinationRule_L4Only(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{
		TrafficPolicy: &networking_v1_api.TrafficPolicy{
			Tls: &networking_v1_api.ClientTLSSettings{
				Mode: networking_v1_api.ClientTLSSettings_ISTIO_MUTUAL,
			},
		},
	}
	isL7, _ := isL7DestinationRule(spec)
	assert.False(t, isL7, "DestinationRule with only TLS settings should be L4")
}

func TestIsL7DestinationRule_Empty(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{}
	isL7, _ := isL7DestinationRule(spec)
	assert.False(t, isL7)
}

// --- isL7Telemetry tests ---

func TestIsL7Telemetry_Tracing(t *testing.T) {
	spec := &telemetry_v1_api.Telemetry{
		Tracing: []*telemetry_v1_api.Tracing{
			{DisableSpanReporting: nil},
		},
	}
	isL7, reason := isL7Telemetry(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "tracing")
}

func TestIsL7Telemetry_AccessLogging(t *testing.T) {
	spec := &telemetry_v1_api.Telemetry{
		AccessLogging: []*telemetry_v1_api.AccessLogging{
			{},
		},
	}
	isL7, reason := isL7Telemetry(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "access logging")
}

func TestIsL7Telemetry_MetricOverrides(t *testing.T) {
	spec := &telemetry_v1_api.Telemetry{
		Metrics: []*telemetry_v1_api.Metrics{
			{
				Overrides: []*telemetry_v1_api.MetricsOverrides{
					{},
				},
			},
		},
	}
	isL7, reason := isL7Telemetry(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "HTTP metrics")
}

func TestIsL7Telemetry_L4Only(t *testing.T) {
	spec := &telemetry_v1_api.Telemetry{}
	isL7, reason := isL7Telemetry(spec)
	assert.False(t, isL7)
	assert.Contains(t, reason, "L4 metrics")
}

// --- analyzeVirtualService tests ---

func TestAnalyzeVirtualService_HTTPRoutes_IsL7(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "my-vs"},
		Spec: networking_v1_api.VirtualService{
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: true, WaypointName: "waypoint"}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, "L7", result.Layer)
	assert.Empty(t, result.Warning, "No warning expected when waypoint exists")
}

func TestAnalyzeVirtualService_TCPOnly_IsL4(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "tcp-vs"},
		Spec: networking_v1_api.VirtualService{
			Tcp: []*networking_v1_api.TCPRoute{
				{},
			},
		},
	}
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, "L4", result.Layer, "TCP-only VirtualService should be L4")
	assert.Empty(t, result.Warning, "No warning for L4 config without waypoint")
}

func TestAnalyzeVirtualService_HTTPNoWaypoint_HasWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "my-vs"},
		Spec: networking_v1_api.VirtualService{
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
			// No gateways → applies to mesh traffic → needs waypoint
		},
	}
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, "L7", result.Layer)
	assert.NotEmpty(t, result.Warning)
	assert.Contains(t, result.Warning, "NO waypoint")
}

func TestAnalyzeVirtualService_IngressGatewayOnly_NoWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "ingress-vs"},
		Spec: networking_v1_api.VirtualService{
			Gateways: []string{"my-ingress-gateway"},
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, "L7", result.Layer)
	assert.Empty(t, result.Warning, "VS targeting ingress Gateway should NOT warn about missing waypoint")
	assert.Contains(t, result.Reason, "ingress/egress Gateway")
}

func TestAnalyzeVirtualService_MeshAndGateway_HasWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "mesh-and-ingress-vs"},
		Spec: networking_v1_api.VirtualService{
			Gateways: []string{"mesh", "my-ingress-gateway"},
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, "L7", result.Layer)
	assert.NotEmpty(t, result.Warning, "VS targeting both mesh and Gateway still needs waypoint for mesh traffic")
}

// --- appliesToMeshTraffic tests ---

func TestAppliesToMeshTraffic_Empty(t *testing.T) {
	assert.True(t, appliesToMeshTraffic(nil), "empty gateways defaults to mesh")
	assert.True(t, appliesToMeshTraffic([]string{}))
}

func TestAppliesToMeshTraffic_ExplicitMesh(t *testing.T) {
	assert.True(t, appliesToMeshTraffic([]string{"mesh"}))
	assert.True(t, appliesToMeshTraffic([]string{"mesh", "my-gateway"}))
}

func TestAppliesToMeshTraffic_IngressOnly(t *testing.T) {
	assert.False(t, appliesToMeshTraffic([]string{"my-ingress-gateway"}))
	assert.False(t, appliesToMeshTraffic([]string{"ingress-gw", "egress-gw"}))
}

// --- ambientNoWaypointWarning tests ---

func TestAmbientNoWaypointWarning_NotAmbient(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: false}
	assert.Empty(t, ambientNoWaypointWarning(nsStatus, "consequence"))
}

func TestAmbientNoWaypointWarning_AmbientWithWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: true}
	assert.Empty(t, ambientNoWaypointWarning(nsStatus, "consequence"))
}

func TestAmbientNoWaypointWarning_AmbientNoWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, HasWaypoint: false}
	warning := ambientNoWaypointWarning(nsStatus, "Things will break.")
	assert.Contains(t, warning, "NO waypoint")
	assert.Contains(t, warning, "Things will break.")
}

func setupExecuteTest(t *testing.T, objs ...runtime.Object) (*mcputil.KialiInterface, *config.Config) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(objs...)
	layer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	r := httptest.NewRequest(http.MethodPost, "/api/chat/mcp/analyze_ambient_policies", nil)
	r.Header.Set("Kiali-User", "test-user")
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: layer,
		Conf:          conf,
	}, conf
}

func TestExecute_BothNamespaceAndNamespaces_ReturnsBadRequest(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
	)

	result, status := Execute(ki, map[string]interface{}{
		"namespace":  "ambient-ns",
		"namespaces": []interface{}{"ambient-ns"},
	})
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, result.(string), "cannot specify both")
}

func TestExecute_AutoDiscoverAmbientNamespaces(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
		kubetest.FakeNamespace("default"),
	)

	result, status := Execute(ki, map[string]interface{}{})
	assert.Equal(t, http.StatusOK, status)

	resp, ok := result.(PolicyAnalysisResponse)
	require.True(t, ok)
	require.Len(t, resp.Namespaces, 1)
	assert.Equal(t, "ambient-ns", resp.Namespaces[0].NamespaceStatus.Name)
}

func TestExecute_InvalidNamespace_RecordsPerNamespaceError(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
	)

	result, status := Execute(ki, map[string]interface{}{
		"namespaces": []interface{}{"ambient-ns", "missing-ns"},
	})
	assert.Equal(t, http.StatusOK, status)

	resp, ok := result.(PolicyAnalysisResponse)
	require.True(t, ok)
	require.Len(t, resp.Namespaces, 2)
	assert.Equal(t, "ambient-ns", resp.Namespaces[0].NamespaceStatus.Name)
	assert.NotContains(t, resp.Namespaces[0].Summary, "Error:")
	assert.Equal(t, "missing-ns", resp.Namespaces[1].NamespaceStatus.Name)
	assert.Contains(t, resp.Namespaces[1].Summary, "Error:")
}
