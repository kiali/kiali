package ambient

import (
	"fmt"
	"strings"

	extensions_v1alpha1_api "istio.io/api/extensions/v1alpha1"
	networking_v1_api "istio.io/api/networking/v1"
	security_v1_api "istio.io/api/security/v1"
	telemetry_v1_api "istio.io/api/telemetry/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

const (
	// LayerL4 is L4 (ztunnel) processing.
	LayerL4 = "L4"
	// LayerL7 is L7 (waypoint) processing.
	LayerL7 = "L7"
)

// NamespaceAmbientStatus describes Ambient configuration of a namespace.
// Shared by validations and the MCP analyze_ambient_policies tool.
type NamespaceAmbientStatus struct {
	Cluster      string
	HasWaypoint  bool // true if a waypoint workload exists in the namespace
	IsAmbient    bool
	IsEnrolled   bool // true if namespace has istio.io/use-waypoint (not "none")
	Name         string
	WaypointName string
}

// VirtualServiceClassification is the L4/L7 classification of a VirtualService for Ambient.
type VirtualServiceClassification struct {
	Layer            string
	Reason           string
	RequiresWaypoint bool
}

// FindNamespaceWaypoint returns whether any workload in the list is a waypoint proxy.
func FindNamespaceWaypoint(workloads models.Workloads) (bool, string) {
	for _, wl := range workloads {
		if wl != nil && wl.IsWaypoint() {
			return true, wl.Name
		}
	}
	return false, ""
}

// NewNamespaceAmbientStatus builds ambient status from namespace metadata and workloads in that namespace.
func NewNamespaceAmbientStatus(ns *models.Namespace, cluster string, workloads models.Workloads) NamespaceAmbientStatus {
	status := NamespaceAmbientStatus{
		Cluster: cluster,
	}
	if ns == nil {
		return status
	}
	status.Name = ns.Name
	// Use dataplane Ambient, not Kiali's control-plane IsAmbient (set when Ambient is
	// cluster-enabled). Mesh-wide Telemetry/Wasm in istio-system must not get waypoint warnings.
	status.IsAmbient = IsDataplaneAmbientNamespace(ns)
	status.IsEnrolled = IsEnrolledForWaypoint(nil, ns.Labels)
	status.HasWaypoint, status.WaypointName = FindNamespaceWaypoint(workloads)
	return status
}

// IsDataplaneAmbientNamespace reports whether a namespace is Ambient for data-plane policy attachment.
// Ambient L7 validations (KIA02xx / KIA11xx / KIA1317) must use this — not UI/mesh-level Ambient flags.
// Prefer istio.io/dataplane-mode=ambient; control-plane Namespace.IsAmbient can mean "Ambient enabled
// in the mesh" without dataplane enrollment.
func IsDataplaneAmbientNamespace(ns *models.Namespace) bool {
	if ns == nil {
		return false
	}
	if label, ok := ns.Labels[config.IstioAmbientNamespaceLabel]; ok {
		return label == config.IstioAmbientNamespaceLabelValue
	}
	if ns.IsControlPlane {
		return false
	}
	return ns.IsAmbient
}

// IsEnrolledForWaypoint reports whether a resource is enrolled to use a waypoint.
// Resource labels take precedence over namespace labels, including an explicit "none" opt-out.
// See https://istio.io/latest/docs/ambient/usage/waypoint/#use-a-waypoint-proxy
func IsEnrolledForWaypoint(resourceLabels, namespaceLabels map[string]string) bool {
	if resourceLabels != nil {
		if val, ok := resourceLabels[config.WaypointUseLabel]; ok {
			return val != "" && val != config.WaypointNone
		}
	}
	if namespaceLabels != nil {
		if val, ok := namespaceLabels[config.WaypointUseLabel]; ok {
			return val != "" && val != config.WaypointNone
		}
	}
	return false
}

// IsL7AuthorizationPolicy reports whether an AuthorizationPolicy requires L7 (waypoint) enforcement.
func IsL7AuthorizationPolicy(spec *security_v1_api.AuthorizationPolicy) (bool, string) {
	if spec == nil || len(spec.Rules) == 0 {
		return false, ""
	}

	for _, rule := range spec.Rules {
		for _, condition := range rule.When {
			if IsL7Condition(condition.Key) {
				return true, fmt.Sprintf("Uses L7 condition: %s", condition.Key)
			}
		}

		for _, to := range rule.To {
			if to.Operation != nil {
				if len(to.Operation.Methods) > 0 || len(to.Operation.NotMethods) > 0 {
					return true, "Uses HTTP methods field"
				}
				if len(to.Operation.Paths) > 0 || len(to.Operation.NotPaths) > 0 {
					return true, "Uses HTTP paths field"
				}
				if len(to.Operation.Hosts) > 0 || len(to.Operation.NotHosts) > 0 {
					return true, "Uses HTTP hosts field"
				}
			}
		}

		for _, from := range rule.From {
			if from.Source != nil && (len(from.Source.RequestPrincipals) > 0 || len(from.Source.NotRequestPrincipals) > 0) {
				return true, "Uses request principals (JWT)"
			}
		}
	}

	return false, ""
}

// AuthorizationPolicyHasTargetRefs reports whether the policy attaches via targetRef(s).
// In Ambient, waypoint proxies ignore selector-based AuthorizationPolicies; targetRefs are required.
// See https://istio.io/latest/docs/ambient/usage/waypoint/#policy-attachment
func AuthorizationPolicyHasTargetRefs(spec *security_v1_api.AuthorizationPolicy) bool {
	if spec == nil {
		return false
	}
	return spec.TargetRef != nil || len(spec.TargetRefs) > 0
}

// RequestAuthenticationHasTargetRefs reports whether the policy attaches via targetRef(s).
// In Ambient, waypoint proxies ignore selector-based RequestAuthentications; targetRefs are required.
func RequestAuthenticationHasTargetRefs(spec *security_v1_api.RequestAuthentication) bool {
	if spec == nil {
		return false
	}
	return spec.TargetRef != nil || len(spec.TargetRefs) > 0
}

// WasmPluginHasTargetRefs reports whether the WasmPlugin attaches via targetRef(s).
// In Ambient, waypoint proxies ignore selector-based WasmPlugins; targetRefs are required.
// See https://istio.io/latest/docs/ambient/usage/l7-features/
func WasmPluginHasTargetRefs(spec *extensions_v1alpha1_api.WasmPlugin) bool {
	if spec == nil {
		return false
	}
	return spec.TargetRef != nil || len(spec.TargetRefs) > 0
}

// TelemetryHasTargetRefs reports whether the Telemetry attaches via targetRef(s).
// In Ambient, waypoint proxies ignore selector-based Telemetry; targetRefs are required for L7.
func TelemetryHasTargetRefs(spec *telemetry_v1_api.Telemetry) bool {
	if spec == nil {
		return false
	}
	return spec.TargetRef != nil || len(spec.TargetRefs) > 0
}

// IsL7Condition checks if a 'when' condition key requires L7 processing.
// Note: destination.port is L4 (evaluated by ztunnel), not listed here.
func IsL7Condition(key string) bool {
	l7Prefixes := []string{
		"request.headers",
		"request.auth.claims",
		"request.auth.principal",
		"request.auth.audiences",
		"request.auth.presenter",
	}

	for _, prefix := range l7Prefixes {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}

	return false
}

// IsL7DestinationRule checks if a DestinationRule uses L7 features.
func IsL7DestinationRule(spec *networking_v1_api.DestinationRule) (bool, string) {
	if spec == nil {
		return false, ""
	}

	if spec.TrafficPolicy != nil {
		if isL7, reason := trafficPolicyHasL7(spec.TrafficPolicy, false); isL7 {
			return true, reason
		}
	}

	for _, subset := range spec.Subsets {
		if subset.TrafficPolicy != nil {
			if isL7, reason := trafficPolicyHasL7(subset.TrafficPolicy, true); isL7 {
				return true, reason
			}
		}
	}

	return false, ""
}

func trafficPolicyHasL7(tp *networking_v1_api.TrafficPolicy, inSubset bool) (bool, string) {
	if tp.LoadBalancer != nil && tp.LoadBalancer.GetConsistentHash() != nil {
		ch := tp.LoadBalancer.GetConsistentHash()
		if ch.GetHttpHeaderName() != "" || ch.GetHttpCookie() != nil {
			if inSubset {
				return true, "Uses HTTP-based load balancing in subset"
			}
			return true, "Uses HTTP-based load balancing (consistent hash on headers/cookies)"
		}
	}

	if tp.ConnectionPool != nil && tp.ConnectionPool.Http != nil {
		if inSubset {
			return true, "Uses HTTP connection pool settings in subset"
		}
		return true, "Uses HTTP connection pool settings"
	}

	if tp.OutlierDetection != nil {
		if inSubset {
			return true, "Uses circuit breaking in subset"
		}
		return true, "Uses circuit breaking/outlier detection (requires HTTP metrics)"
	}

	return false, ""
}

// ClassifyVirtualService classifies a VirtualService as L4 or L7 for Ambient.
// RequiresWaypoint is true only when HTTP/TLS routes apply to mesh (east-west) traffic.
func ClassifyVirtualService(spec *networking_v1_api.VirtualService) VirtualServiceClassification {
	if spec == nil {
		return VirtualServiceClassification{Layer: LayerL4, Reason: "Empty VirtualService"}
	}

	hasHTTPOrTLS := len(spec.Http) > 0 || len(spec.Tls) > 0

	if hasHTTPOrTLS && AppliesToMeshTraffic(spec.Gateways) {
		return VirtualServiceClassification{
			Layer:            LayerL7,
			Reason:           "VirtualService provides HTTP/TLS routing for mesh traffic (requires waypoint)",
			RequiresWaypoint: true,
		}
	}
	if hasHTTPOrTLS {
		return VirtualServiceClassification{
			Layer:            LayerL7,
			Reason:           "VirtualService provides HTTP/TLS routing via ingress/egress Gateway (no waypoint needed)",
			RequiresWaypoint: false,
		}
	}
	return VirtualServiceClassification{
		Layer:            LayerL4,
		Reason:           "VirtualService only defines TCP routes (L4 load balancing, no HTTP features)",
		RequiresWaypoint: false,
	}
}

// AppliesToMeshTraffic reports whether a VirtualService targets in-mesh (east-west) traffic.
// A VS applies to mesh traffic when spec.gateways is empty (default) or contains the reserved
// value "mesh". VSes that only reference named ingress/egress Gateways do not need a waypoint.
func AppliesToMeshTraffic(gateways []string) bool {
	if len(gateways) == 0 {
		return true
	}
	for _, gw := range gateways {
		if gw == "mesh" {
			return true
		}
	}
	return false
}

// IsL7Telemetry checks if Telemetry config requires L7 processing.
func IsL7Telemetry(spec *telemetry_v1_api.Telemetry) (bool, string) {
	if spec == nil {
		return false, "Only collects L4 metrics (TCP connections, bytes transferred)"
	}

	if len(spec.Tracing) > 0 {
		return true, "Configures distributed tracing (requires HTTP header propagation)"
	}

	if len(spec.AccessLogging) > 0 {
		return true, "Configures access logging (typically includes HTTP details)"
	}

	for _, metric := range spec.Metrics {
		if metric != nil && len(metric.Overrides) > 0 {
			return true, "Collects customized HTTP metrics (request count, duration, status codes)"
		}
	}

	return false, "Only collects L4 metrics (TCP connections, bytes transferred)"
}

// NeedsWaypointWarning returns true when an L7 config is in an Ambient namespace that is not
// enrolled to use a waypoint. Enrollment (istio.io/use-waypoint) is what routes traffic through
// a waypoint; merely deploying a waypoint workload is not enough.
func NeedsWaypointWarning(nsStatus NamespaceAmbientStatus, requiresWaypoint bool) bool {
	return requiresWaypoint && nsStatus.IsAmbient && !nsStatus.IsEnrolled
}

// AmbientNoWaypointWarning returns a warning when an L7 config is in an Ambient namespace
// that is not enrolled to use a waypoint. Returns empty string if no warning is needed.
func AmbientNoWaypointWarning(nsStatus NamespaceAmbientStatus, consequence string) string {
	if NeedsWaypointWarning(nsStatus, true) {
		return fmt.Sprintf("Namespace '%s' is in Ambient mode but is NOT enrolled to use a waypoint (missing istio.io/use-waypoint). %s", nsStatus.Name, consequence)
	}
	return ""
}

// AmbientMissingTargetRefsWarning returns a warning when an Ambient L7 policy lacks targetRefs.
// Waypoint proxies ignore selector-based attachment; targetRefs to Service/Gateway are required.
func AmbientMissingTargetRefsWarning(nsStatus NamespaceAmbientStatus, configKind string) string {
	if !nsStatus.IsAmbient {
		return ""
	}
	return fmt.Sprintf("%s in Ambient namespace '%s' has no targetRefs. Waypoints ignore selector-based policies; attach via targetRefs to a Service or Gateway.", configKind, nsStatus.Name)
}

// AmbientServiceNotCapturedWarning returns a warning when a specific service is not enrolled
// to use a waypoint while living in an Ambient namespace.
func AmbientServiceNotCapturedWarning(nsStatus NamespaceAmbientStatus, serviceName string, consequence string) string {
	if !nsStatus.IsAmbient {
		return ""
	}
	return fmt.Sprintf("Service '%s/%s' is in Ambient mode but is NOT enrolled to use a waypoint (missing istio.io/use-waypoint, or set to none). %s", nsStatus.Name, serviceName, consequence)
}
