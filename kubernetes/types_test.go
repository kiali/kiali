package kubernetes

import (
	"testing"
)

func TestPluralResourceName(t *testing.T) {
	tests := []struct {
		kind     string
		expected string
	}{
		{AuthorizationPoliciesType, "authorizationpolicies"},
		{DestinationRuleType, "destinationrules"},
		{EnvoyFilterType, "envoyfilters"},
		{K8sGatewayType, "gateways"},
		{K8sGatewayClassType, "gatewayclasses"},
		{K8sGRPCRouteType, "grpcroutes"},
		{K8sHTTPRouteType, "httproutes"},
		{K8sInferencePoolsType, "inferencepools"},
		{K8sReferenceGrantType, "referencegrants"},
		{K8sTCPRouteType, "tcproutes"},
		{K8sTLSRouteType, "tlsroutes"},
		{K8sUDPRouteType, "udproutes"},
		{PeerAuthenticationsType, "peerauthentications"},
		{RequestAuthenticationsType, "requestauthentications"},
		{ServiceEntryType, "serviceentries"},
		{SidecarType, "sidecars"},
		{TelemetryType, "telemetries"},
		{TrafficExtensionType, "trafficextensions"},
		{VirtualServiceType, "virtualservices"},
		{WasmPluginType, "wasmplugins"},
		{WorkloadEntryType, "workloadentries"},
		{WorkloadGroupType, "workloadgroups"},
	}

	for _, tt := range tests {
		t.Run(tt.kind, func(t *testing.T) {
			got := PluralResourceName(tt.kind)
			if got != tt.expected {
				t.Errorf("PluralResourceName(%q) = %q, want %q", tt.kind, got, tt.expected)
			}
		})
	}
}

func TestPluralResourceNameFallback(t *testing.T) {
	// Types not in PluralNames return the Kind unchanged, which only matches
	// RBAC rules granting resources: ["*"].
	got := PluralResourceName("ProxyConfig")
	if got != "ProxyConfig" {
		t.Errorf("PluralResourceName(%q) = %q, want %q (fallback to Kind)", "ProxyConfig", got, "ProxyConfig")
	}
}
