package kubernetes

import (
	"testing"
)

func TestPluralResourceName(t *testing.T) {
	tests := []struct {
		kind     string
		expected string
	}{
		{K8sGatewayType, "gateways"},
		{K8sGatewayClassType, "gatewayclasses"},
		{K8sGRPCRouteType, "grpcroutes"},
		{K8sHTTPRouteType, "httproutes"},
		{K8sInferencePoolsType, "inferencepools"},
		{K8sReferenceGrantType, "referencegrants"},
		{K8sTCPRouteType, "tcproutes"},
		{K8sTLSRouteType, "tlsroutes"},
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
	// Types not in PluralNames should return the Kind unchanged (used for
	// Istio types that still use wildcard resources: ["*"] in RBAC).
	got := PluralResourceName("DestinationRule")
	if got != "DestinationRule" {
		t.Errorf("PluralResourceName(%q) = %q, want %q (fallback to Kind)", "DestinationRule", got, "DestinationRule")
	}
}
