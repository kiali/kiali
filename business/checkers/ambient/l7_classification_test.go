package ambient

import (
	"testing"

	"github.com/stretchr/testify/assert"
	extensions_v1alpha1_api "istio.io/api/extensions/v1alpha1"
	networking_v1_api "istio.io/api/networking/v1"
	security_v1_api "istio.io/api/security/v1"
	telemetry_v1_api "istio.io/api/telemetry/v1"
	type_v1beta1 "istio.io/api/type/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestIsL7AuthorizationPolicy_HTTPMethods(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{Operation: &security_v1_api.Operation{Methods: []string{"GET", "POST"}}},
				},
			},
		},
	}
	isL7, reason := IsL7AuthorizationPolicy(spec)
	assert.True(t, isL7)
	assert.Equal(t, "Uses HTTP methods field", reason)
}

func TestIsL7AuthorizationPolicy_NotMethods(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{Operation: &security_v1_api.Operation{NotMethods: []string{"DELETE"}}},
				},
			},
		},
	}
	isL7, reason := IsL7AuthorizationPolicy(spec)
	assert.True(t, isL7)
	assert.Equal(t, "Uses HTTP methods field", reason)
}

func TestIsL7AuthorizationPolicy_NotRequestPrincipals(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{Source: &security_v1_api.Source{NotRequestPrincipals: []string{"*"}}},
				},
			},
		},
	}
	isL7, reason := IsL7AuthorizationPolicy(spec)
	assert.True(t, isL7)
	assert.Equal(t, "Uses request principals (JWT)", reason)
}

func TestIsL7AuthorizationPolicy_L4Only(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{Source: &security_v1_api.Source{Principals: []string{"cluster.local/ns/default/sa/myapp"}}},
				},
				To: []*security_v1_api.Rule_To{
					{Operation: &security_v1_api.Operation{Ports: []string{"8080"}}},
				},
			},
		},
	}
	isL7, reason := IsL7AuthorizationPolicy(spec)
	assert.False(t, isL7)
	assert.Empty(t, reason)
}

func TestIsL7AuthorizationPolicy_EmptyAndNil(t *testing.T) {
	isL7, _ := IsL7AuthorizationPolicy(&security_v1_api.AuthorizationPolicy{})
	assert.False(t, isL7)
	isL7, _ = IsL7AuthorizationPolicy(nil)
	assert.False(t, isL7)
}

func TestAuthorizationPolicyHasTargetRefs(t *testing.T) {
	assert.False(t, AuthorizationPolicyHasTargetRefs(nil))
	assert.False(t, AuthorizationPolicyHasTargetRefs(&security_v1_api.AuthorizationPolicy{}))
	assert.True(t, AuthorizationPolicyHasTargetRefs(&security_v1_api.AuthorizationPolicy{
		TargetRefs: []*type_v1beta1.PolicyTargetReference{{Kind: "Service", Name: "reviews"}},
	}))
	assert.True(t, AuthorizationPolicyHasTargetRefs(&security_v1_api.AuthorizationPolicy{
		TargetRef: &type_v1beta1.PolicyTargetReference{Kind: "Gateway", Name: "waypoint"},
	}))
}

func TestRequestAuthenticationHasTargetRefs(t *testing.T) {
	assert.False(t, RequestAuthenticationHasTargetRefs(nil))
	assert.False(t, RequestAuthenticationHasTargetRefs(&security_v1_api.RequestAuthentication{}))
	assert.True(t, RequestAuthenticationHasTargetRefs(&security_v1_api.RequestAuthentication{
		TargetRefs: []*type_v1beta1.PolicyTargetReference{{Kind: "Service", Name: "reviews"}},
	}))
}

func TestWasmPluginHasTargetRefs(t *testing.T) {
	assert.False(t, WasmPluginHasTargetRefs(nil))
	assert.False(t, WasmPluginHasTargetRefs(&extensions_v1alpha1_api.WasmPlugin{}))
	assert.True(t, WasmPluginHasTargetRefs(&extensions_v1alpha1_api.WasmPlugin{
		TargetRefs: []*type_v1beta1.PolicyTargetReference{{Kind: "Service", Name: "reviews"}},
	}))
	assert.True(t, WasmPluginHasTargetRefs(&extensions_v1alpha1_api.WasmPlugin{
		TargetRef: &type_v1beta1.PolicyTargetReference{Kind: "Gateway", Name: "waypoint"},
	}))
}

func TestTelemetryHasTargetRefs(t *testing.T) {
	assert.False(t, TelemetryHasTargetRefs(nil))
	assert.False(t, TelemetryHasTargetRefs(&telemetry_v1_api.Telemetry{}))
	assert.True(t, TelemetryHasTargetRefs(&telemetry_v1_api.Telemetry{
		TargetRefs: []*type_v1beta1.PolicyTargetReference{{Kind: "Service", Name: "reviews"}},
	}))
}

func TestIsDataplaneAmbientNamespace_ControlPlane(t *testing.T) {
	assert.False(t, IsDataplaneAmbientNamespace(nil))
	assert.False(t, IsDataplaneAmbientNamespace(&models.Namespace{
		Name: "istio-system", IsAmbient: true, IsControlPlane: true,
	}))
	assert.True(t, IsDataplaneAmbientNamespace(&models.Namespace{
		Name: "istio-system", IsAmbient: true, IsControlPlane: true,
		Labels: map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue},
	}))
	assert.True(t, IsDataplaneAmbientNamespace(&models.Namespace{
		Name: "bookinfo", IsAmbient: true, IsControlPlane: false,
	}))
}

func TestIsL7Condition_DestinationPortIsL4(t *testing.T) {
	assert.False(t, IsL7Condition("destination.port"))
}

func TestIsL7Condition_RequestHeaders(t *testing.T) {
	assert.True(t, IsL7Condition("request.headers[x-forwarded-for]"))
}

func TestIsL7DestinationRule_HTTPConnectionPool(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{
		TrafficPolicy: &networking_v1_api.TrafficPolicy{
			ConnectionPool: &networking_v1_api.ConnectionPoolSettings{
				Http: &networking_v1_api.ConnectionPoolSettings_HTTPSettings{Http1MaxPendingRequests: 1024},
			},
		},
	}
	isL7, reason := IsL7DestinationRule(spec)
	assert.True(t, isL7)
	assert.Contains(t, reason, "HTTP connection pool")
}

func TestIsL7DestinationRule_L4Only(t *testing.T) {
	spec := &networking_v1_api.DestinationRule{
		TrafficPolicy: &networking_v1_api.TrafficPolicy{
			Tls: &networking_v1_api.ClientTLSSettings{Mode: networking_v1_api.ClientTLSSettings_ISTIO_MUTUAL},
		},
	}
	isL7, _ := IsL7DestinationRule(spec)
	assert.False(t, isL7)
}

func TestClassifyVirtualService_HTTPMeshNeedsWaypoint(t *testing.T) {
	classification := ClassifyVirtualService(&networking_v1_api.VirtualService{
		Http: []*networking_v1_api.HTTPRoute{{Name: "route-1"}},
	})
	assert.Equal(t, LayerL7, classification.Layer)
	assert.True(t, classification.RequiresWaypoint)
}

func TestClassifyVirtualService_TCPOnly(t *testing.T) {
	classification := ClassifyVirtualService(&networking_v1_api.VirtualService{
		Tcp: []*networking_v1_api.TCPRoute{{}},
	})
	assert.Equal(t, LayerL4, classification.Layer)
	assert.False(t, classification.RequiresWaypoint)
}

func TestClassifyVirtualService_IngressOnly(t *testing.T) {
	classification := ClassifyVirtualService(&networking_v1_api.VirtualService{
		Gateways: []string{"my-ingress-gateway"},
		Http:     []*networking_v1_api.HTTPRoute{{Name: "route-1"}},
	})
	assert.Equal(t, LayerL7, classification.Layer)
	assert.False(t, classification.RequiresWaypoint)
}

func TestAppliesToMeshTraffic(t *testing.T) {
	assert.True(t, AppliesToMeshTraffic(nil))
	assert.True(t, AppliesToMeshTraffic([]string{"mesh"}))
	assert.False(t, AppliesToMeshTraffic([]string{"my-ingress-gateway"}))
}

func TestIsL7Telemetry(t *testing.T) {
	isL7, reason := IsL7Telemetry(&telemetry_v1_api.Telemetry{
		Tracing: []*telemetry_v1_api.Tracing{{}},
	})
	assert.True(t, isL7)
	assert.Contains(t, reason, "tracing")

	isL7, reason = IsL7Telemetry(&telemetry_v1_api.Telemetry{})
	assert.False(t, isL7)
	assert.Contains(t, reason, "L4 metrics")
}

func TestAmbientNoWaypointWarning(t *testing.T) {
	assert.Empty(t, AmbientNoWaypointWarning(NamespaceAmbientStatus{IsAmbient: false}, "x"))
	assert.Empty(t, AmbientNoWaypointWarning(NamespaceAmbientStatus{IsAmbient: true, IsEnrolled: true}, "x"))
	warning := AmbientNoWaypointWarning(NamespaceAmbientStatus{Name: "ns", IsAmbient: true, IsEnrolled: false}, "Things will break.")
	assert.Contains(t, warning, "NOT enrolled")
	assert.Contains(t, warning, "Things will break.")
}

func TestIsEnrolledForWaypoint(t *testing.T) {
	assert.False(t, IsEnrolledForWaypoint(nil, nil))
	assert.False(t, IsEnrolledForWaypoint(nil, map[string]string{}))
	assert.True(t, IsEnrolledForWaypoint(nil, map[string]string{config.WaypointUseLabel: "waypoint"}))
	assert.False(t, IsEnrolledForWaypoint(nil, map[string]string{config.WaypointUseLabel: config.WaypointNone}))
	assert.False(t, IsEnrolledForWaypoint(
		map[string]string{config.WaypointUseLabel: config.WaypointNone},
		map[string]string{config.WaypointUseLabel: "waypoint"},
	), "service-level none overrides namespace enrollment")
	assert.True(t, IsEnrolledForWaypoint(
		map[string]string{config.WaypointUseLabel: "svc-waypoint"},
		map[string]string{},
	))
}

func TestFindNamespaceWaypoint(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	noWaypoint := data.CreateWorkload("ns", "app", map[string]string{})
	waypoint := data.CreateWorkload("ns", "waypoint", map[string]string{
		config.WaypointLabel: config.WaypointLabelValue,
	})

	found, name := FindNamespaceWaypoint(models.Workloads{noWaypoint})
	assert.False(t, found)
	assert.Empty(t, name)

	found, name = FindNamespaceWaypoint(models.Workloads{noWaypoint, waypoint})
	assert.True(t, found)
	assert.Equal(t, "waypoint", name)
}
