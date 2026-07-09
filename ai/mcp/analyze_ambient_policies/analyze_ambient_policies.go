package analyze_ambient_policies

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	networking_v1_api "istio.io/api/networking/v1"
	security_v1_api "istio.io/api/security/v1"
	telemetry_v1_api "istio.io/api/telemetry/v1"
	extensions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	telemetry_v1 "istio.io/client-go/pkg/apis/telemetry/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
)

// PolicyAnalysisResponse is the output of the analyze_ambient_policies tool
type PolicyAnalysisResponse struct {
	Namespaces []NamespaceAnalysis `json:"namespaces"`
	Summary    string              `json:"summary,omitempty"`
}

// NamespaceAnalysis contains the analysis for a single namespace
type NamespaceAnalysis struct {
	NamespaceStatus NamespaceAmbientStatus `json:"namespace_status"`
	Policies        []AnalyzedPolicy       `json:"policies"`
	Recommendations []string               `json:"recommendations,omitempty"`
	Summary         string                 `json:"summary"`
}

// NamespaceAmbientStatus describes the Ambient configuration of the namespace
type NamespaceAmbientStatus struct {
	Cluster      string `json:"cluster"`
	HasWaypoint  bool   `json:"has_waypoint"`
	IsAmbient    bool   `json:"is_ambient"`
	Name         string `json:"name"`
	WaypointName string `json:"waypoint_name,omitempty"`
}

// AnalyzedPolicy contains the classification and warnings for a single Istio configuration
type AnalyzedPolicy struct {
	ConfigType string `json:"config_type"` // e.g., "AuthorizationPolicy", "VirtualService", etc.
	Layer      string `json:"layer"`       // "L4" or "L7"
	Name       string `json:"name"`
	Reason     string `json:"reason"`
	Rules      int    `json:"rules_count"`
	Warning    string `json:"warning,omitempty"`
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	ctx := kialiInterface.Request.Context()
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")

	// Get namespaces to analyze (either single, multiple, or all Ambient namespaces)
	var namespacesToAnalyze []string

	// Check for single namespace
	if namespace := mcputil.GetStringArg(args, "namespace"); namespace != "" {
		namespacesToAnalyze = []string{namespace}
	}

	// Check for multiple namespaces
	if namespacesArg, ok := args["namespaces"].([]interface{}); ok && len(namespacesArg) > 0 {
		if len(namespacesToAnalyze) > 0 {
			return "cannot specify both 'namespace' and 'namespaces' parameters", http.StatusBadRequest
		}
		for _, ns := range namespacesArg {
			if nsStr, ok := ns.(string); ok && nsStr != "" {
				namespacesToAnalyze = append(namespacesToAnalyze, nsStr)
			}
		}
	}

	// If no namespaces specified, analyze all Ambient namespaces
	if len(namespacesToAnalyze) == 0 {
		allNamespaces, err := kialiInterface.BusinessLayer.Namespace.GetClusterNamespaces(ctx, clusterName)
		if err != nil {
			return fmt.Sprintf("failed to get namespaces: %v", err), http.StatusInternalServerError
		}

		// Filter to only Ambient namespaces
		for _, ns := range allNamespaces {
			if ns.IsAmbient {
				namespacesToAnalyze = append(namespacesToAnalyze, ns.Name)
			}
		}

		if len(namespacesToAnalyze) == 0 {
			return PolicyAnalysisResponse{
				Namespaces: []NamespaceAnalysis{},
				Summary:    "No Ambient namespaces found in the cluster",
			}, http.StatusOK
		}
	}

	// Analyze each namespace, recording per-namespace errors instead of aborting the whole request.
	namespaceResults := make([]NamespaceAnalysis, 0, len(namespacesToAnalyze))
	totalL4 := 0
	totalL7 := 0
	totalL7WithoutWaypoint := 0

	for _, namespace := range namespacesToAnalyze {
		// Fetch and validate namespace access in one call to avoid a double lookup.
		nsInfo, errMsg := getValidatedNamespace(ctx, kialiInterface.BusinessLayer, namespace, clusterName)
		if errMsg != "" {
			// Record the error per-namespace instead of aborting the entire batch.
			namespaceResults = append(namespaceResults, NamespaceAnalysis{
				NamespaceStatus: NamespaceAmbientStatus{Name: namespace, Cluster: clusterName},
				Summary:         fmt.Sprintf("Error: %s", errMsg),
			})
			continue
		}

		result := analyzeNamespace(ctx, kialiInterface, nsInfo, clusterName)
		namespaceResults = append(namespaceResults, result)

		// Count L4/L7 across all namespaces
		for _, policy := range result.Policies {
			if policy.Layer == "L7" {
				totalL7++
				if policy.Warning != "" {
					totalL7WithoutWaypoint++
				}
			} else {
				totalL4++
			}
		}
	}

	// Generate overall summary
	overallSummary := generateOverallSummary(len(namespacesToAnalyze), totalL4, totalL7, totalL7WithoutWaypoint)

	return PolicyAnalysisResponse{
		Namespaces: namespaceResults,
		Summary:    overallSummary,
	}, http.StatusOK
}

// getValidatedNamespace fetches the namespace and validates access in a single API call.
// Returns the namespace info and an empty error string on success, or nil and a message on failure.
func getValidatedNamespace(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) (*models.Namespace, string) {
	nsInfo, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		switch {
		case business.IsAccessibleError(err), k8serrors.IsForbidden(err), k8serrors.IsUnauthorized(err):
			return nil, fmt.Sprintf("namespace %q is not accessible in cluster %q", namespace, cluster)
		case k8serrors.IsNotFound(err):
			return nil, fmt.Sprintf("namespace %q does not exist in cluster %q", namespace, cluster)
		default:
			return nil, fmt.Sprintf("failed to get namespace %q in cluster %q: %v", namespace, cluster, err)
		}
	}
	return nsInfo, ""
}

// analyzeNamespace performs the analysis for a single namespace using an already-fetched namespace object.
func analyzeNamespace(ctx context.Context, kialiInterface *mcputil.KialiInterface, namespaceInfo *models.Namespace, clusterName string) NamespaceAnalysis {
	namespace := namespaceInfo.Name

	// Check if namespace has waypoint
	hasWaypoint, waypointName := checkNamespaceWaypoint(ctx, kialiInterface.BusinessLayer, namespace, clusterName)

	nsStatus := NamespaceAmbientStatus{
		Name:         namespace,
		Cluster:      clusterName,
		IsAmbient:    namespaceInfo.IsAmbient,
		HasWaypoint:  hasWaypoint,
		WaypointName: waypointName,
	}

	// Get all relevant Istio configs for Ambient analysis
	criteria := business.IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeVirtualServices:        true,
		IncludeDestinationRules:       true,
		IncludeWasmPlugins:            true,
		IncludeTelemetry:              true,
	}
	istioConfigs, err := kialiInterface.BusinessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, clusterName, namespace, criteria)
	if err != nil {
		return NamespaceAnalysis{
			NamespaceStatus: nsStatus,
			Summary:         fmt.Sprintf("Error: failed to get Istio configs: %v", err),
		}
	}

	// Analyze all config types
	analyzedPolicies := make([]AnalyzedPolicy, 0)
	l4Count := 0
	l7Count := 0
	l7WithoutWaypointCount := 0

	// Analyze AuthorizationPolicies
	for _, ap := range istioConfigs.AuthorizationPolicies {
		analyzed := analyzeAuthorizationPolicy(ap, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze PeerAuthentications
	for _, pa := range istioConfigs.PeerAuthentications {
		analyzed := analyzePeerAuthentication(pa, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze RequestAuthentications (always L7)
	for _, ra := range istioConfigs.RequestAuthentications {
		analyzed := analyzeRequestAuthentication(ra, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze VirtualServices (always L7)
	for _, vs := range istioConfigs.VirtualServices {
		analyzed := analyzeVirtualService(vs, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze DestinationRules
	for _, dr := range istioConfigs.DestinationRules {
		analyzed := analyzeDestinationRule(dr, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze WasmPlugins (always L7)
	for _, wp := range istioConfigs.WasmPlugins {
		analyzed := analyzeWasmPlugin(wp, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Analyze Telemetry
	for _, tel := range istioConfigs.Telemetries {
		analyzed := analyzeTelemetry(tel, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)
		updateCounts(&l4Count, &l7Count, &l7WithoutWaypointCount, analyzed)
	}

	// Generate summary
	summary := generateSummary(l4Count, l7Count, l7WithoutWaypointCount, nsStatus)

	// Generate recommendations
	recommendations := generateRecommendations(nsStatus, l7Count, l7WithoutWaypointCount)

	return NamespaceAnalysis{
		NamespaceStatus: nsStatus,
		Policies:        analyzedPolicies,
		Recommendations: recommendations,
		Summary:         summary,
	}
}

// checkNamespaceWaypoint checks if the namespace has a waypoint proxy configured.
// It uses GetWaypoints (cached) instead of GetWorkloadList to avoid loading all workload details.
func checkNamespaceWaypoint(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) (bool, string) {
	waypoints := businessLayer.Workload.GetWaypoints(ctx)
	for _, wl := range waypoints {
		if wl.Namespace == namespace && wl.Cluster == cluster {
			return true, wl.Name
		}
	}
	return false, ""
}

// updateCounts updates the L4/L7 counters based on analyzed policy
func updateCounts(l4Count, l7Count, l7WithoutWaypoint *int, analyzed AnalyzedPolicy) {
	if analyzed.Layer == "L7" {
		*l7Count++
		if analyzed.Warning != "" {
			*l7WithoutWaypoint++
		}
	} else {
		*l4Count++
	}
}

// analyzeAuthorizationPolicy classifies a policy as L4 or L7
func analyzeAuthorizationPolicy(ap *security_v1.AuthorizationPolicy, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	isL7, reason := isL7Policy(&ap.Spec)

	analyzed := AnalyzedPolicy{
		ConfigType: "AuthorizationPolicy",
		Name:       ap.Name,
		Rules:      len(ap.Spec.Rules),
	}

	if isL7 {
		analyzed.Layer = "L7"
		analyzed.Reason = reason
		analyzed.Warning = ambientNoWaypointWarning(nsStatus, "This L7 policy will NOT be enforced.")
	} else {
		analyzed.Layer = "L4"
		analyzed.Reason = "Only uses L4 fields (source/destination principals, IPs, ports, namespaces)"
	}

	return analyzed
}

// isL7Policy determines if an AuthorizationPolicy requires L7 (waypoint) enforcement
func isL7Policy(spec *security_v1_api.AuthorizationPolicy) (bool, string) {
	if spec == nil || len(spec.Rules) == 0 {
		return false, ""
	}

	// Check for L7-specific fields in rules
	for _, rule := range spec.Rules {
		// Check 'when' conditions for L7 fields
		for _, condition := range rule.When {
			if isL7Condition(condition.Key) {
				return true, fmt.Sprintf("Uses L7 condition: %s", condition.Key)
			}
		}

		// Check 'to' operations for HTTP-specific fields
		for _, to := range rule.To {
			if to.Operation != nil {
				if len(to.Operation.Methods) > 0 {
					return true, "Uses HTTP methods field"
				}
				if len(to.Operation.Paths) > 0 {
					return true, "Uses HTTP paths field"
				}
				if len(to.Operation.Hosts) > 0 {
					return true, "Uses HTTP hosts field"
				}
			}
		}

		// Check 'from' for request principals (JWT-based, requires L7)
		for _, from := range rule.From {
			if from.Source != nil && len(from.Source.RequestPrincipals) > 0 {
				return true, "Uses request principals (JWT)"
			}
		}
	}

	// If none of the above L7 indicators are found, it's L4
	return false, ""
}

// ambientNoWaypointWarning returns a warning when an L7 config is in an Ambient namespace
// without a waypoint. Returns empty string if no warning is needed.
func ambientNoWaypointWarning(nsStatus NamespaceAmbientStatus, consequence string) string {
	if nsStatus.IsAmbient && !nsStatus.HasWaypoint {
		return fmt.Sprintf("Namespace '%s' is in Ambient mode but has NO waypoint. %s", nsStatus.Name, consequence)
	}
	return ""
}

// isL7Condition checks if a 'when' condition key requires L7 processing.
// Note: destination.port is L4 (evaluated by ztunnel), not listed here.
func isL7Condition(key string) bool {
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

// generateSummary creates a human-readable summary
func generateSummary(l4Count, l7Count, l7WithoutWaypoint int, nsStatus NamespaceAmbientStatus) string {
	total := l4Count + l7Count

	if total == 0 {
		return fmt.Sprintf("No Istio configurations found in namespace '%s'", nsStatus.Name)
	}

	if !nsStatus.IsAmbient {
		return fmt.Sprintf("Found %d configs (%d L4, %d L7). Namespace is NOT in Ambient mode - configs enforced by sidecars.", total, l4Count, l7Count)
	}

	if l7WithoutWaypoint > 0 {
		return fmt.Sprintf("Found %d configs (%d L4, %d L7). WARNING: %d L7 configs require a waypoint but namespace has NONE - these will NOT work!", total, l4Count, l7Count, l7WithoutWaypoint)
	}

	if l7Count > 0 && nsStatus.HasWaypoint {
		return fmt.Sprintf("Found %d configs (%d L4, %d L7). All L7 configs will be processed by waypoint '%s'.", total, l4Count, l7Count, nsStatus.WaypointName)
	}

	return fmt.Sprintf("Found %d L4 configs. All will be processed by ztunnel.", l4Count)
}

// generateRecommendations provides actionable next steps
func generateRecommendations(nsStatus NamespaceAmbientStatus, l7Count, l7WithoutWaypoint int) []string {
	recommendations := make([]string, 0)

	if !nsStatus.IsAmbient {
		return []string{
			fmt.Sprintf("Namespace '%s' is not in Ambient mode. Enable Ambient by labeling the namespace with 'istio.io/dataplane-mode=ambient'.", nsStatus.Name),
		}
	}

	if l7WithoutWaypoint > 0 {
		recommendations = append(recommendations,
			fmt.Sprintf("Deploy a waypoint proxy in namespace '%s' to enable L7 configs. Use 'istioctl waypoint apply' or create a Gateway resource.", nsStatus.Name),
			"After deploying the waypoint, verify configs are working by checking metrics or testing the affected services.",
		)
	}

	if l7Count == 0 && nsStatus.HasWaypoint {
		recommendations = append(recommendations,
			"All configs are L4-only. Consider removing the waypoint proxy to reduce resource usage if L7 features are not needed.",
		)
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "No issues found. All configurations are correctly set up for Ambient mode.")
	}

	return recommendations
}

// analyzePeerAuthentication classifies a PeerAuthentication as L4
// PeerAuthentication is processed by ztunnel for mTLS configuration
func analyzePeerAuthentication(pa *security_v1.PeerAuthentication, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	analyzed := AnalyzedPolicy{
		ConfigType: "PeerAuthentication",
		Name:       pa.Name,
		Layer:      "L4",
		Reason:     "PeerAuthentication configures mTLS at L4 (processed by ztunnel)",
		Rules:      1, // PeerAuth doesn't have "rules" but we set 1 for consistency
	}
	return analyzed
}

// analyzeRequestAuthentication classifies a RequestAuthentication as L7
// JWT validation requires HTTP header parsing, only waypoint can do this
func analyzeRequestAuthentication(ra *security_v1.RequestAuthentication, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	return AnalyzedPolicy{
		ConfigType: "RequestAuthentication",
		Name:       ra.Name,
		Layer:      "L7",
		Reason:     "RequestAuthentication validates JWT tokens (requires HTTP header parsing)",
		Rules:      len(ra.Spec.JwtRules),
		Warning:    ambientNoWaypointWarning(nsStatus, "This RequestAuthentication will NOT work."),
	}
}

// analyzeVirtualService classifies a VirtualService as L7 (HTTP/TLS routes) or L4 (TCP-only routes).
// A waypoint warning is only emitted when the VS applies to mesh (east-west) traffic. VirtualServices
// targeting only named ingress/egress Gateways are processed by those Gateways, not by a waypoint.
func analyzeVirtualService(vs *networking_v1.VirtualService, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	analyzed := AnalyzedPolicy{
		ConfigType: "VirtualService",
		Name:       vs.Name,
		Rules:      countVirtualServiceRules(&vs.Spec),
	}

	hasHTTPOrTLS := len(vs.Spec.Http) > 0 || len(vs.Spec.Tls) > 0

	if hasHTTPOrTLS && appliesToMeshTraffic(vs.Spec.Gateways) {
		analyzed.Layer = "L7"
		analyzed.Reason = "VirtualService provides HTTP/TLS routing for mesh traffic (requires waypoint)"
		analyzed.Warning = ambientNoWaypointWarning(nsStatus, "This VirtualService will NOT work.")
	} else if hasHTTPOrTLS {
		analyzed.Layer = "L7"
		analyzed.Reason = "VirtualService provides HTTP/TLS routing via ingress/egress Gateway (no waypoint needed)"
	} else {
		analyzed.Layer = "L4"
		analyzed.Reason = "VirtualService only defines TCP routes (L4 load balancing, no HTTP features)"
	}

	return analyzed
}

// appliesToMeshTraffic reports whether a VirtualService targets in-mesh (east-west) traffic.
// A VS applies to mesh traffic when spec.gateways is empty (default) or contains the reserved
// value "mesh". VSes that only reference named ingress/egress Gateways do not need a waypoint.
func appliesToMeshTraffic(gateways []string) bool {
	if len(gateways) == 0 {
		return true // default: applies to mesh
	}
	for _, gw := range gateways {
		if gw == "mesh" {
			return true
		}
	}
	return false
}

// countVirtualServiceRules counts HTTP and TLS routes
func countVirtualServiceRules(spec *networking_v1_api.VirtualService) int {
	count := 0
	for _, http := range spec.Http {
		if http != nil {
			count++
		}
	}
	for _, tls := range spec.Tls {
		if tls != nil {
			count++
		}
	}
	for _, tcp := range spec.Tcp {
		if tcp != nil {
			count++
		}
	}
	return count
}

// analyzeDestinationRule classifies a DestinationRule as L4 or L7
// Basic TLS settings are L4, but HTTP-specific features are L7
func analyzeDestinationRule(dr *networking_v1.DestinationRule, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	isL7, reason := isL7DestinationRule(&dr.Spec)

	analyzed := AnalyzedPolicy{
		ConfigType: "DestinationRule",
		Name:       dr.Name,
		Rules:      1,
	}

	if isL7 {
		analyzed.Layer = "L7"
		analyzed.Reason = reason
		analyzed.Warning = ambientNoWaypointWarning(nsStatus, "This DestinationRule's L7 features will NOT work.")
	} else {
		analyzed.Layer = "L4"
		analyzed.Reason = "Only uses L4 features (basic TLS configuration)"
	}

	return analyzed
}

// isL7DestinationRule checks if a DestinationRule uses L7 features
func isL7DestinationRule(spec *networking_v1_api.DestinationRule) (bool, string) {
	// Check for HTTP-specific traffic policy
	if spec.TrafficPolicy != nil {
		tp := spec.TrafficPolicy

		// Load balancer with consistent hash on HTTP headers/cookies
		if tp.LoadBalancer != nil && tp.LoadBalancer.GetConsistentHash() != nil {
			ch := tp.LoadBalancer.GetConsistentHash()
			if ch.GetHttpHeaderName() != "" || ch.GetHttpCookie() != nil {
				return true, "Uses HTTP-based load balancing (consistent hash on headers/cookies)"
			}
		}

		// Connection pool settings for HTTP
		if tp.ConnectionPool != nil && tp.ConnectionPool.Http != nil {
			return true, "Uses HTTP connection pool settings"
		}

		// Circuit breaker with HTTP-specific settings
		if tp.OutlierDetection != nil {
			return true, "Uses circuit breaking/outlier detection (requires HTTP metrics)"
		}
	}

	// Check subsets for HTTP-specific traffic policies
	for _, subset := range spec.Subsets {
		if subset.TrafficPolicy != nil {
			tp := subset.TrafficPolicy

			if tp.LoadBalancer != nil && tp.LoadBalancer.GetConsistentHash() != nil {
				ch := tp.LoadBalancer.GetConsistentHash()
				if ch.GetHttpHeaderName() != "" || ch.GetHttpCookie() != nil {
					return true, "Uses HTTP-based load balancing in subset"
				}
			}

			if tp.ConnectionPool != nil && tp.ConnectionPool.Http != nil {
				return true, "Uses HTTP connection pool settings in subset"
			}

			if tp.OutlierDetection != nil {
				return true, "Uses circuit breaking in subset"
			}
		}
	}

	// If only basic TLS or simple load balancing, it's L4
	return false, ""
}

// analyzeWasmPlugin classifies a WasmPlugin as L7
// WasmPlugins run in the HTTP filter chain
func analyzeWasmPlugin(wp *extensions_v1alpha1.WasmPlugin, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	return AnalyzedPolicy{
		ConfigType: "WasmPlugin",
		Name:       wp.Name,
		Layer:      "L7",
		Reason:     "WasmPlugin processes HTTP requests (runs in waypoint's Envoy filter chain)",
		Rules:      1,
		Warning:    ambientNoWaypointWarning(nsStatus, "This WasmPlugin will NOT be loaded."),
	}
}

// analyzeTelemetry classifies Telemetry as L4 or L7 depending on metrics type
func analyzeTelemetry(tel *telemetry_v1.Telemetry, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	isL7, reason := isL7Telemetry(&tel.Spec)

	analyzed := AnalyzedPolicy{
		ConfigType: "Telemetry",
		Name:       tel.Name,
		Rules:      countTelemetryRules(&tel.Spec),
	}

	if isL7 {
		analyzed.Layer = "L7"
		analyzed.Reason = reason
		analyzed.Warning = ambientNoWaypointWarning(nsStatus, "L7 telemetry features will NOT work.")
	} else {
		analyzed.Layer = "L4"
		analyzed.Reason = reason
	}

	return analyzed
}

// isL7Telemetry checks if Telemetry config requires L7 processing
func isL7Telemetry(spec *telemetry_v1_api.Telemetry) (bool, string) {
	// Check tracing - distributed tracing requires HTTP context propagation
	if len(spec.Tracing) > 0 {
		return true, "Configures distributed tracing (requires HTTP header propagation)"
	}

	// Check access logging - typically includes HTTP-specific fields
	if len(spec.AccessLogging) > 0 {
		return true, "Configures access logging (typically includes HTTP details)"
	}

	// Check for metrics overrides - if metrics are being customized, likely L7
	for _, metric := range spec.Metrics {
		if metric != nil && len(metric.Overrides) > 0 {
			return true, "Collects customized HTTP metrics (request count, duration, status codes)"
		}
	}

	// Basic TCP metrics only (connection counts, bytes transferred)
	return false, "Only collects L4 metrics (TCP connections, bytes transferred)"
}

// countTelemetryRules counts telemetry configuration items
func countTelemetryRules(spec *telemetry_v1_api.Telemetry) int {
	count := 0
	count += len(spec.Metrics)
	count += len(spec.Tracing)
	count += len(spec.AccessLogging)
	return count
}

// generateOverallSummary creates a summary across multiple namespaces
func generateOverallSummary(namespaceCount, totalL4, totalL7, totalL7WithoutWaypoint int) string {
	if namespaceCount == 1 {
		// For single namespace, the namespace-specific summary is sufficient
		return ""
	}

	totalConfigs := totalL4 + totalL7

	if totalConfigs == 0 {
		return fmt.Sprintf("Analyzed %d namespaces. No Istio configurations found.", namespaceCount)
	}

	if totalL7WithoutWaypoint > 0 {
		return fmt.Sprintf("Analyzed %d namespaces with %d total configs (%d L4, %d L7). WARNING: %d L7 configs are in namespaces without waypoints and will NOT work!",
			namespaceCount, totalConfigs, totalL4, totalL7, totalL7WithoutWaypoint)
	}

	return fmt.Sprintf("Analyzed %d namespaces with %d total configs (%d L4, %d L7). All L7 configs are in namespaces with waypoints.",
		namespaceCount, totalConfigs, totalL4, totalL7)
}
