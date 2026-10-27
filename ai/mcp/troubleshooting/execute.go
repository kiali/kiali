package troubleshooting

import (
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/kiali/kiali/ai/mcp/get_mesh_status"
	"github.com/kiali/kiali/ai/mcputil"
)

func Execute(ki *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	clusterName := mcputil.GetStringOrDefault(args, ki.Conf.KubernetesConfig.ClusterName, "clusterName")
	namespace := strings.TrimSpace(mcputil.GetStringArg(args, "namespace"))

	if namespace != "" {
		if msg, code := mcputil.ValidateNamespaceAccess(ki.Request.Context(), ki.BusinessLayer, namespace, clusterName); msg != "" {
			return msg, code
		}
	}

	result, code := get_mesh_status.Execute(ki, args)
	if code != http.StatusOK {
		return result, code
	}
	summary, ok := result.(get_mesh_status.MeshSummaryFormatted)
	if !ok {
		return "unexpected mesh status response type", http.StatusInternalServerError
	}

	issues := collectIssues(ki, summary, clusterName, namespace)
	if issues == nil {
		issues = []Issue{}
	}
	allowSuggestions := suggestionsAllowed(ki)
	if !allowSuggestions {
		clearSuggestedActions(issues)
	}

	return issues, http.StatusOK
}

func collectIssues(ki *mcputil.KialiInterface, summary get_mesh_status.MeshSummaryFormatted, cluster, namespace string) []Issue {
	seenTargets := make(map[string]bool)
	var issues []Issue
	if issue := controlPlaneIssue(summary.Components.ControlPlane, cluster, seenTargets); issue != nil {
		issues = append(issues, *issue)
	}
	// Data-plane resource lists and Istio object gets both hit the API. Run them together
	// and share one lookup limit so a large mesh does not double the number of in-flight reads.
	sem := make(chan struct{}, troubleshootingLookupParallelism)
	var dataPlane []Issue
	var istio *Issue
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		dataPlane = dataPlaneIssues(ki, summary.Components.DataPlane, cluster, namespace, seenTargets, sem)
	}()
	go func() {
		defer wg.Done()
		istio = istioObjectsIssue(ki, cluster, namespace, sem)
	}()
	wg.Wait()
	issues = append(issues, dataPlane...)
	// Istio object validation stays in its own category, even when the same namespace is also an unhealthy data plane.
	if istio != nil {
		issues = append(issues, *istio)
	}
	if issue := observabilityIssue(summary.Components.ObservabilityStack, summary.CriticalAlerts, seenTargets); issue != nil {
		issues = append(issues, *issue)
	}
	if issue := connectivityIssue(summary.ConnectivityGraph, summary.CriticalAlerts, cluster, namespace, seenTargets); issue != nil {
		issues = append(issues, *issue)
	}
	return issues
}

func controlPlaneIssue(cp get_mesh_status.MeshSummaryControlPlane, cluster string, seenTargets map[string]bool) *Issue {
	var subs []SubProblem
	for _, node := range cp.Nodes {
		if cluster != "" && node.Cluster != "" && node.Cluster != cluster {
			continue
		}
		if isHealthyStatus(node.Status) {
			continue
		}
		target := node.Name
		if node.Namespace != "" {
			target = node.Namespace + "/" + node.Name
		}
		markSeen(seenTargets, node.Name, target)
		subs = append(subs, newSubProblem(
			controlPlaneNodeID(node.Cluster, node.Namespace, node.Name),
			"Control plane: "+target,
			fmt.Sprintf("status is %s", node.Status),
			"Mesh configuration and sidecar injection may be impaired.",
		))
	}
	if len(subs) == 0 && !isHealthyStatus(cp.Status) {
		markSeen(seenTargets, "istiod", "control plane")
		subs = append(subs, newSubProblem(
			idControlPlaneStatus,
			"Control plane",
			fmt.Sprintf("status is %s", cp.Status),
			"Mesh configuration and sidecar injection may be impaired.",
		))
	}
	if len(subs) == 0 {
		return nil
	}
	return &Issue{
		ID:          idControlPlane,
		Category:    CategoryControlPlane,
		Problem:     fmt.Sprintf("Control plane is %s", displayStatus(cp.Status, subs)),
		Description: "One or more Istio control plane components are not healthy.",
		SubProblems: subs,
	}
}

func dataPlaneIssues(ki *mcputil.KialiInterface, dp get_mesh_status.MeshSummaryDataPlane, cluster, namespace string, seenTargets map[string]bool, sem chan struct{}) []Issue {
	var pending []unhealthyNamespace
	var targets []string
	var health []string
	for _, ns := range dp.MonitoredNamespaces {
		if cluster != "" && ns.Cluster != "" && ns.Cluster != cluster {
			continue
		}
		if namespace != "" && ns.Name != namespace {
			continue
		}
		if isHealthyStatus(ns.Health) {
			continue
		}
		nsCluster := ns.Cluster
		if nsCluster == "" {
			nsCluster = cluster
		}
		target := ns.Name
		if nsCluster != "" {
			target = ns.Name + " (" + nsCluster + ")"
		}
		markSeen(seenTargets, ns.Name)
		pending = append(pending, unhealthyNamespace{Cluster: nsCluster, Name: ns.Name})
		targets = append(targets, target)
		health = append(health, ns.Health)
	}
	found := analyzeUnhealthyNamespaces(ki, pending, sem)

	var issues []Issue
	for i, ns := range pending {
		subs := namespaceFindings(newSubProblem(
			dataPlaneNamespaceSubProblemID(ns.Cluster, ns.Name),
			"Namespace: "+targets[i],
			fmt.Sprintf("health is %s", health[i]),
			"Workloads, services, or apps in this namespace may be failing or degraded.",
		), found[i], nil)
		issues = append(issues, Issue{
			ID:          dataPlaneNamespaceID(ns.Cluster, ns.Name),
			Category:    CategoryDataPlane,
			Problem:     fmt.Sprintf("Namespace %q is %s", ns.Name, health[i]),
			Description: fmt.Sprintf("The mesh status reports the data plane namespace %q is %s.", ns.Name, health[i]),
			SubProblems: subs,
		})
	}
	if dp.Ztunnel != nil && !isHealthyStatus(dp.Ztunnel.DaemonSet.Status) {
		markSeen(seenTargets, "ztunnel")
		issues = append(issues, Issue{
			ID:          idDataPlaneZtunnel,
			Category:    CategoryDataPlane,
			Problem:     fmt.Sprintf("ztunnel is %s", dp.Ztunnel.DaemonSet.Status),
			Description: "Ambient data plane (ztunnel) is not fully ready.",
			SubProblems: []SubProblem{newSubProblem(
				idDataPlaneZtunnelDS,
				"DaemonSet: ztunnel",
				fmt.Sprintf("status is %s (%d/%d pods ready)",
					dp.Ztunnel.DaemonSet.Status, dp.Ztunnel.DaemonSet.ReadyPods, dp.Ztunnel.DaemonSet.DesiredPods),
				"Ambient L4 traffic may be disrupted.",
			)},
		})
	}
	return issues
}

func observabilityIssue(obs get_mesh_status.MeshSummaryObservabilityStack, alerts []get_mesh_status.MeshSummaryCriticalAlert, seenTargets map[string]bool) *Issue {
	type named struct {
		name, status string
	}
	components := []named{
		{"Prometheus", obs.Prometheus},
		{"Grafana", obs.Grafana},
		{"Jaeger", obs.Jaeger},
		{"Tempo", obs.Tempo},
		{"Zipkin", obs.Zipkin},
		{"OTel", obs.OTel},
		{"Perses", obs.Perses},
	}
	var subs []SubProblem
	for _, c := range components {
		if strings.TrimSpace(c.status) == "" || isHealthyStatus(c.status) {
			continue
		}
		alert := matchingAlert(alerts, c.name)
		impact := observabilityImpact(c.name)
		issue := fmt.Sprintf("status is %s", c.status)
		if alert.Message != "" {
			issue = alert.Message
		}
		if alert.Impact != "" {
			impact = alert.Impact
		}
		markSeen(seenTargets, c.name)
		subs = append(subs, newSubProblem(observabilityComponentID(c.name), c.name, issue, impact))
	}
	if len(subs) == 0 {
		return nil
	}
	return &Issue{
		ID:          idObservability,
		Category:    CategoryObservabilityStack,
		Problem:     "Observability stack has unreachable or unhealthy components",
		Description: "Kiali cannot reach one or more observability backends.",
		SubProblems: subs,
	}
}

func connectivityIssue(edges []get_mesh_status.MeshSummaryEdge, alerts []get_mesh_status.MeshSummaryCriticalAlert, cluster, namespace string, seenTargets map[string]bool) *Issue {
	var subs []SubProblem
	for _, edge := range edges {
		if isHealthyStatus(edge.Status) {
			continue
		}
		if cluster != "" && edge.FromCluster != "" && edge.FromCluster != cluster && edge.ToCluster != "" && edge.ToCluster != cluster {
			continue
		}
		if namespace != "" && !strings.Contains(edge.From, namespace) && !strings.Contains(edge.To, namespace) {
			continue
		}
		if seenTargets[componentKey(edge.To)] {
			continue
		}
		alert := matchingAlert(alerts, edge.To)
		issue := fmt.Sprintf("status is %s", edge.Status)
		impact := fmt.Sprintf("Kiali cannot use %s.", edge.To)
		if alert.Message != "" {
			issue = alert.Message
		}
		if alert.Impact != "" {
			impact = alert.Impact
		}
		markSeen(seenTargets, edge.To)
		subs = append(subs, newSubProblem(
			connectivityEdgeID(edge.From, edge.To),
			fmt.Sprintf("%s → %s", edge.From, edge.To),
			issue,
			impact,
		))
	}
	if len(subs) == 0 {
		return nil
	}
	return &Issue{
		ID:          idConnectivity,
		Category:    CategoryConnectivity,
		Problem:     "Mesh connectivity problems detected",
		Description: "One or more connections from Kiali or the control plane are not healthy.",
		SubProblems: subs,
	}
}

func newSubProblem(id, target, issue, impact string) SubProblem {
	prompt, actions := generateSuggestions(target, issue)
	return SubProblem{
		ID:               id,
		Impact:           impact,
		Issue:            issue,
		Severity:         SeverityCritical,
		SuggestedActions: actions,
		SuggestedPrompt:  prompt,
		Target:           target,
	}
}

func generateSuggestions(target string, issue string) (string, []SuggestedAction) {
	prompt := fmt.Sprintf("Analyze why %s is reporting: '%s'. What are the potential root causes and how can I fix it?", target, issue)
	cleaned := cleanTargetName(target)
	if cleaned == "" {
		cleaned = "istio"
	}
	return prompt, []SuggestedAction{
		{
			Type:        ActionTypeQuestion,
			Description: fmt.Sprintf("Ask the AI to analyze %s", target),
		},
		{
			Type:        ActionTypeAdvice,
			Description: fmt.Sprintf("Check pod status for %s", cleaned),
			Command:     fmt.Sprintf("kubectl get pods -A | grep -i %s", cleaned),
		},
	}
}

func markSeen(seenTargets map[string]bool, names ...string) {
	if seenTargets == nil {
		return
	}
	for _, name := range names {
		if key := componentKey(name); key != "" {
			seenTargets[key] = true
		}
	}
}

func componentKey(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	if i := strings.Index(n, " → "); i >= 0 {
		n = strings.TrimSpace(n[i+len(" → "):])
	}
	for _, prefix := range []string{"control plane: ", "namespace: ", "daemonset: "} {
		n = strings.TrimPrefix(n, prefix)
	}
	if i := strings.Index(n, " ("); i >= 0 {
		n = n[:i]
	}
	if i := strings.LastIndex(n, "/"); i >= 0 {
		n = n[i+1:]
	}
	return strings.TrimSpace(n)
}

func cleanTargetName(target string) string {
	var b strings.Builder
	for _, r := range componentKey(target) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func matchingAlert(alerts []get_mesh_status.MeshSummaryCriticalAlert, name string) get_mesh_status.MeshSummaryCriticalAlert {
	want := strings.ToLower(name)
	for _, alert := range alerts {
		comp := strings.ToLower(alert.Component)
		if strings.Contains(comp, want) || strings.Contains(want, comp) {
			return alert
		}
	}
	return get_mesh_status.MeshSummaryCriticalAlert{}
}

func observabilityImpact(name string) string {
	switch strings.ToLower(name) {
	case "prometheus":
		return "Metrics and health calculations may be unavailable."
	case "grafana", "perses":
		return "Dashboards may be unavailable."
	case "jaeger", "tempo", "zipkin":
		return "Distributed tracing may be unavailable."
	case "otel":
		return "OpenTelemetry collection may be unavailable."
	default:
		return name + " is not healthy."
	}
}

func isHealthyStatus(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "", "HEALTHY", "NA":
		return true
	default:
		return false
	}
}

func displayStatus(overall string, subs []SubProblem) string {
	if strings.TrimSpace(overall) != "" && !isHealthyStatus(overall) {
		return overall
	}
	if len(subs) > 0 {
		return "not healthy"
	}
	return overall
}
