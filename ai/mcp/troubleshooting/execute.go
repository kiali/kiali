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
	// Data-plane resource lists, Istio object gets, Ambient policy checks, and traffic graph queries
	// all hit the API. Run them together and share one lookup limit so a large mesh does not
	// multiply the number of in-flight reads.
	sem := make(chan struct{}, troubleshootingLookupParallelism)
	var dataPlane []Issue
	var istio *Issue
	var ambientSubs []SubProblem
	var trafficSubs []SubProblem
	var plaintextSubs []SubProblem
	var mtlsSubs []SubProblem
	var promScrapeSubs []SubProblem

	nsMeta := fetchNamespaceMetadata(ki, cluster, sem)
	mtlsSubs = namespaceMTLSSubProblems(summary.Components.DataPlane.MonitoredNamespaces, nsMeta, cluster, namespace)

	var wg sync.WaitGroup
	wg.Add(4)
	go func() {
		defer wg.Done()
		dataPlane = dataPlaneIssues(ki, summary.Components.DataPlane, summary.Environment.IstioVersion, nsMeta, cluster, namespace, seenTargets, sem)
	}()
	go func() {
		defer wg.Done()
		istio = istioObjectsIssue(ki, cluster, namespace, sem)
	}()
	go func() {
		defer wg.Done()
		ambientSubs = ambientPolicySubProblems(ki, summary.Components.DataPlane.MonitoredNamespaces, cluster, namespace, sem)
	}()
	go func() {
		defer wg.Done()
		trafficSubs, plaintextSubs, promScrapeSubs = trafficGraphSubProblems(ki, summary.Components.DataPlane.MonitoredNamespaces, cluster, namespace, sem)
	}()
	wg.Wait()

	issues = append(issues, dataPlane...)
	// Istio object validation stays in its own category, even when the same namespace is also an unhealthy data plane.
	if istio != nil {
		issues = append(issues, *istio)
	}
	if secIssue := buildSecurityIssue(ambientSubs, mtlsSubs, plaintextSubs, namespace); secIssue != nil {
		issues = append(issues, *secIssue)
	}
	if trfIssue := buildTrafficIssue(trafficSubs, namespace); trfIssue != nil {
		issues = append(issues, *trfIssue)
	}
	if issue := observabilityIssue(summary.Components.ObservabilityStack, summary.CriticalAlerts, promScrapeSubs, seenTargets); issue != nil {
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
		sub := newSubProblemWithSeverity(
			controlPlaneNodeID(node.Cluster, node.Namespace, node.Name),
			"Control plane: "+target,
			fmt.Sprintf("status is %s", node.Status),
			"Mesh configuration, xDS synchronization, and sidecar injection may be impaired.",
			severityForHealth(node.Status),
		)
		sub.SuggestedPrompt = fmt.Sprintf(
			"Analyze why control plane component %s (cluster %q) is reporting status %q. Use get_mesh_status and get_logs (in namespace %q for workload %q with severity=\"ERROR,WARN\") to identify the root cause.",
			target, node.Cluster, node.Status, node.Namespace, node.Name,
		)
		subs = append(subs, sub)
	}
	if len(subs) == 0 && !isHealthyStatus(cp.Status) {
		markSeen(seenTargets, "istiod", "control plane")
		subs = append(subs, newSubProblemWithSeverity(
			idControlPlaneStatus,
			"Control plane",
			fmt.Sprintf("status is %s", cp.Status),
			"Mesh configuration and sidecar injection may be impaired.",
			severityForHealth(cp.Status),
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

func dataPlaneIssues(
	ki *mcputil.KialiInterface,
	dp get_mesh_status.MeshSummaryDataPlane,
	controlPlaneVersion string,
	nsMeta map[string]namespaceMetadata,
	cluster, namespace string,
	seenTargets map[string]bool,
	sem chan struct{},
) []Issue {
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
		nsHealthy := isHealthyStatus(ns.Health)
		// When ki is nil (offline unit tests), only inspect namespaces already marked unhealthy.
		// When ki is available, also scan healthy monitored namespaces for sidecar injection anomalies,
		// xDS desynchronization, proxy version drift, configuration errors, or OutOfSync ArgoCD apps.
		if nsHealthy && ki == nil {
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
		meta := nsMeta[ns.Name]
		pending = append(pending, unhealthyNamespace{
			Cluster:          nsCluster,
			InjectionEnabled: meta.InjectionEnabled,
			IsAmbient:        ns.IsAmbient,
			Name:             ns.Name,
		})
		targets = append(targets, target)
		health = append(health, ns.Health)
	}
	found := analyzeMonitoredNamespaces(ki, pending, controlPlaneVersion, sem)

	var issues []Issue
	for i, ns := range pending {
		nsHealthy := isHealthyStatus(health[i])
		if nsHealthy && len(found[i]) == 0 {
			continue
		}
		markSeen(seenTargets, ns.Name)
		if nsHealthy {
			issues = append(issues, Issue{
				ID:          dataPlaneNamespaceID(ns.Cluster, ns.Name),
				Category:    CategoryDataPlane,
				Problem:     fmt.Sprintf("Namespace %q has workload or configuration anomalies", ns.Name),
				Description: fmt.Sprintf("Anomalies were detected in data plane namespace %q.", ns.Name),
				SubProblems: found[i],
			})
			continue
		}
		nsSub := newSubProblemWithSeverity(
			dataPlaneNamespaceSubProblemID(ns.Cluster, ns.Name),
			"Namespace: "+targets[i],
			fmt.Sprintf("health is %s", health[i]),
			"Workloads, services, or apps in this namespace may be failing or degraded.",
			severityForHealth(health[i]),
		)
		subs := namespaceFindings(nsSub, found[i], nil)
		issues = append(issues, Issue{
			ID:          dataPlaneNamespaceID(ns.Cluster, ns.Name),
			Category:    CategoryDataPlane,
			Problem:     fmt.Sprintf("Namespace %q is %s", ns.Name, health[i]),
			Description: fmt.Sprintf("The mesh status reports the data plane namespace %q is %s.", ns.Name, health[i]),
			SubProblems: subs,
		})
	}
	if ztunnelIssue := buildZtunnelIssue(dp.Ztunnel, seenTargets); ztunnelIssue != nil {
		issues = append(issues, *ztunnelIssue)
	}
	return issues
}

func buildZtunnelIssue(ztunnel *get_mesh_status.MeshSummaryZtunnel, seenTargets map[string]bool) *Issue {
	if ztunnel == nil {
		return nil
	}
	var subs []SubProblem
	if !isHealthyStatus(ztunnel.DaemonSet.Status) {
		sub := newSubProblemWithSeverity(
			idDataPlaneZtunnelDS,
			"DaemonSet: ztunnel",
			fmt.Sprintf("status is %s (%d/%d pods ready)",
				ztunnel.DaemonSet.Status, ztunnel.DaemonSet.ReadyPods, ztunnel.DaemonSet.DesiredPods),
			"Ambient L4 traffic and HBONE mTLS tunneling may be disrupted.",
			severityForHealth(ztunnel.DaemonSet.Status),
		)
		subs = append(subs, sub)
	}
	for _, pod := range ztunnel.Pods {
		if pod.Ready && strings.EqualFold(pod.Phase, "Running") {
			continue
		}
		target := fmt.Sprintf("Pod: ztunnel/%s", pod.Name)
		if pod.Node != "" {
			target = fmt.Sprintf("Pod: ztunnel/%s (node %s)", pod.Name, pod.Node)
		}
		sub := newSubProblemWithSeverity(
			dataPlaneZtunnelPodID(pod.Name),
			target,
			fmt.Sprintf("phase is %s (ready=%t)", pod.Phase, pod.Ready),
			fmt.Sprintf("Ambient ztunnel pod %q on node %q is not ready. Workloads on this node may lose L4 mesh connectivity.", pod.Name, pod.Node),
			SeverityCritical,
		)
		subs = append(subs, sub)
	}
	if len(subs) == 0 {
		return nil
	}
	markSeen(seenTargets, "ztunnel")
	status := ztunnel.DaemonSet.Status
	if isHealthyStatus(status) {
		status = "DEGRADED"
	}
	return &Issue{
		ID:          idDataPlaneZtunnel,
		Category:    CategoryDataPlane,
		Problem:     fmt.Sprintf("ztunnel is %s", status),
		Description: "Ambient data plane (ztunnel) is not fully ready.",
		SubProblems: subs,
	}
}

func observabilityIssue(obs get_mesh_status.MeshSummaryObservabilityStack, alerts []get_mesh_status.MeshSummaryCriticalAlert, extraSubs []SubProblem, seenTargets map[string]bool) *Issue {
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
		subs = append(subs, newSubProblemWithSeverity(
			observabilityComponentID(c.name),
			c.name,
			issue,
			impact,
			severityForHealth(c.status),
		))
	}
	subs = append(subs, extraSubs...)
	if len(subs) == 0 {
		return nil
	}
	return &Issue{
		ID:          idObservability,
		Category:    CategoryObservabilityStack,
		Problem:     "Observability stack has unreachable or unhealthy components",
		Description: "Kiali cannot reach one or more observability backends or metric queries failed.",
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
		subs = append(subs, newSubProblemWithSeverity(
			connectivityEdgeID(edge.From, edge.To),
			fmt.Sprintf("%s → %s", edge.From, edge.To),
			issue,
			impact,
			severityForHealth(edge.Status),
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
	return newSubProblemWithSeverity(id, target, issue, impact, SeverityCritical)
}

func newSubProblemWithSeverity(id, target, issue, impact, severity string) SubProblem {
	if severity == "" {
		severity = SeverityCritical
	}
	prompt, actions := generateSuggestions(target, issue)
	return SubProblem{
		ID:               id,
		Impact:           impact,
		Issue:            issue,
		Severity:         severity,
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
	for _, prefix := range []string{"control plane: ", "namespace: ", "daemonset: ", "pod: "} {
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

func severityForHealth(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "DEGRADED", "NOT_READY", "NOT READY":
		return SeverityWarning
	default:
		return SeverityCritical
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
