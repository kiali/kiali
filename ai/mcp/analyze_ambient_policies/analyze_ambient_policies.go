package analyze_ambient_policies

import (
	"context"
	"fmt"
	"net/http"

	security_v1_api "istio.io/api/security/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
)

// PolicyAnalysisResponse is the output of the analyze_ambient_policies tool
type PolicyAnalysisResponse struct {
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

// AnalyzedPolicy contains the classification and warnings for a single AuthorizationPolicy
type AnalyzedPolicy struct {
	Layer   string `json:"layer"` // "L4" or "L7"
	Name    string `json:"name"`
	Reason  string `json:"reason"`
	Rules   int    `json:"rules_count"`
	Warning string `json:"warning,omitempty"`
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	ctx := kialiInterface.Request.Context()
	namespace := mcputil.GetStringArg(args, "namespace")
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")

	if namespace == "" {
		return "namespace parameter is required", http.StatusBadRequest
	}

	// Validate namespace access
	if errMsg, statusCode := mcputil.ValidateNamespaceAccess(ctx, kialiInterface.BusinessLayer, namespace, clusterName); errMsg != "" {
		return errMsg, statusCode
	}

	// Get namespace details to check if it's Ambient
	namespaceInfo, err := kialiInterface.BusinessLayer.Namespace.GetClusterNamespace(ctx, namespace, clusterName)
	if err != nil {
		return fmt.Sprintf("failed to get namespace info: %v", err), http.StatusInternalServerError
	}

	// Check if namespace has waypoint
	hasWaypoint, waypointName := checkNamespaceWaypoint(ctx, kialiInterface.BusinessLayer, namespace, clusterName)

	nsStatus := NamespaceAmbientStatus{
		Name:         namespace,
		Cluster:      clusterName,
		IsAmbient:    namespaceInfo.IsAmbient,
		HasWaypoint:  hasWaypoint,
		WaypointName: waypointName,
	}

	// Get AuthorizationPolicies
	criteria := business.IstioConfigCriteria{
		IncludeAuthorizationPolicies: true,
	}
	istioConfigs, err := kialiInterface.BusinessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, clusterName, namespace, criteria)
	if err != nil {
		return fmt.Sprintf("failed to get AuthorizationPolicies: %v", err), http.StatusInternalServerError
	}

	// Analyze policies
	analyzedPolicies := make([]AnalyzedPolicy, 0)
	l4Count := 0
	l7Count := 0
	l7WithoutWaypointCount := 0

	for _, ap := range istioConfigs.AuthorizationPolicies {
		analyzed := analyzeAuthorizationPolicy(*ap, nsStatus)
		analyzedPolicies = append(analyzedPolicies, analyzed)

		if analyzed.Layer == "L7" {
			l7Count++
			if analyzed.Warning != "" {
				l7WithoutWaypointCount++
			}
		} else {
			l4Count++
		}
	}

	// Generate summary
	summary := generateSummary(l4Count, l7Count, l7WithoutWaypointCount, nsStatus)

	// Generate recommendations
	recommendations := generateRecommendations(nsStatus, l7Count, l7WithoutWaypointCount)

	return PolicyAnalysisResponse{
		Summary:         summary,
		NamespaceStatus: nsStatus,
		Policies:        analyzedPolicies,
		Recommendations: recommendations,
	}, http.StatusOK
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

// analyzeAuthorizationPolicy classifies a policy as L4 or L7
func analyzeAuthorizationPolicy(ap security_v1.AuthorizationPolicy, nsStatus NamespaceAmbientStatus) AnalyzedPolicy {
	isL7, reason := isL7Policy(&ap.Spec)

	analyzed := AnalyzedPolicy{
		Name:  ap.Name,
		Rules: len(ap.Spec.Rules),
	}

	if isL7 {
		analyzed.Layer = "L7"
		analyzed.Reason = reason

		// Generate warning if namespace is Ambient but has no waypoint
		if nsStatus.IsAmbient && !nsStatus.HasWaypoint {
			analyzed.Warning = fmt.Sprintf("Namespace '%s' is in Ambient mode but has NO waypoint. This L7 policy will NOT be enforced.", nsStatus.Name)
		}
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

// isL7Condition checks if a 'when' condition key requires L7 processing
func isL7Condition(key string) bool {
	l7Prefixes := []string{
		"request.headers",
		"request.auth.claims",
		"request.auth.principal",
		"request.auth.audiences",
		"request.auth.presenter",
		"destination.port",
	}

	for _, prefix := range l7Prefixes {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			return true
		}
	}

	return false
}

// generateSummary creates a human-readable summary
func generateSummary(l4Count, l7Count, l7WithoutWaypoint int, nsStatus NamespaceAmbientStatus) string {
	total := l4Count + l7Count

	if total == 0 {
		return fmt.Sprintf("No AuthorizationPolicies found in namespace '%s'", nsStatus.Name)
	}

	if !nsStatus.IsAmbient {
		return fmt.Sprintf("Found %d policies (%d L4, %d L7). Namespace is NOT in Ambient mode - policies enforced by sidecars.", total, l4Count, l7Count)
	}

	if l7WithoutWaypoint > 0 {
		return fmt.Sprintf("Found %d policies (%d L4, %d L7). WARNING: %d L7 policies require a waypoint but namespace has NONE - these will NOT be enforced!", total, l4Count, l7Count, l7WithoutWaypoint)
	}

	if l7Count > 0 && nsStatus.HasWaypoint {
		return fmt.Sprintf("Found %d policies (%d L4, %d L7). All L7 policies will be enforced by waypoint '%s'.", total, l4Count, l7Count, nsStatus.WaypointName)
	}

	return fmt.Sprintf("Found %d L4 policies. All will be enforced by ztunnel.", l4Count)
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
			fmt.Sprintf("Deploy a waypoint proxy in namespace '%s' to enforce L7 policies. Use 'istioctl waypoint apply' or create a Gateway resource.", nsStatus.Name),
			"After deploying the waypoint, verify policies are enforced by checking metrics or testing the protected endpoints.",
		)
	}

	if l7Count == 0 && nsStatus.HasWaypoint {
		recommendations = append(recommendations,
			"All policies are L4-only. Consider removing the waypoint proxy to reduce resource usage if L7 features are not needed.",
		)
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "No issues found. All policies are correctly configured for Ambient mode.")
	}

	return recommendations
}
