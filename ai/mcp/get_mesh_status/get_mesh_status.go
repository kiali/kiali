package get_mesh_status

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/mesh"
	meshApi "github.com/kiali/kiali/mesh/api"
	meshCommon "github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

func Execute(ki *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	ctx := ki.Request.Context()

	namespaces, nsErr := ki.BusinessLayer.Namespace.GetNamespaces(ctx)
	if nsErr != nil {
		if business.IsAccessibleError(nsErr) || k8serrors.IsForbidden(nsErr) || k8serrors.IsUnauthorized(nsErr) {
			return "Token does not have access to any namespace. Cannot retrieve mesh status.", http.StatusForbidden
		}
		return fmt.Sprintf("failed to validate token access for mesh status: %v", nsErr), http.StatusInternalServerError
	}
	if len(namespaces) == 0 {
		return "Token does not have access to any namespace. Cannot retrieve mesh status.", http.StatusForbidden
	}

	meshReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/ai/mesh-status", nil)
	meshOpts := mesh.NewOptions(meshReq, &ki.BusinessLayer.Namespace)

	code, payload := meshApi.GraphMesh(ctx, ki.BusinessLayer, meshOpts, ki.ClientFactory, ki.KialiCache, ki.Conf, ki.Graphana, ki.Perses, ki.Prom, ki.Discovery)
	if code != http.StatusOK {
		if payload != nil {
			return fmt.Sprintf("mesh status error: %v", payload), code
		}
		return "failed to retrieve mesh status", code
	}

	meshConfig, ok := payload.(meshCommon.Config)
	if !ok {
		return "unexpected mesh status response type", http.StatusInternalServerError
	}

	summary := transformToSummary(meshConfig)
	if !hasAccessibleControlPlane(summary) {
		return "No accessible control plane data found for this token. Cannot retrieve mesh status.", http.StatusForbidden
	}
	enrichNamespaceHealth(ctx, ki.BusinessLayer, summary.Components.DataPlane.MonitoredNamespaces)

	return summary, http.StatusOK
}

func hasAccessibleControlPlane(summary MeshSummaryFormatted) bool {
	return len(summary.Components.ControlPlane.Nodes) > 0
}

func transformToSummary(cfg meshCommon.Config) MeshSummaryFormatted {
	nodesByID := buildNodeIndex(cfg)

	return MeshSummaryFormatted{
		Components:        extractComponents(cfg),
		ConnectivityGraph: extractConnectivity(cfg, nodesByID),
		CriticalAlerts:    extractCriticalAlerts(cfg),
		Environment:       extractEnvironment(cfg),
	}
}

func buildNodeIndex(cfg meshCommon.Config) map[string]*meshCommon.NodeData {
	idx := make(map[string]*meshCommon.NodeData, len(cfg.Elements.Nodes))
	for _, n := range cfg.Elements.Nodes {
		if n.Data != nil {
			idx[n.Data.ID] = n.Data
		}
	}
	return idx
}

func extractEnvironment(cfg meshCommon.Config) MeshSummaryEnvironment {
	env := MeshSummaryEnvironment{
		Timestamp: time.Unix(cfg.Timestamp, 0).UTC().Format(time.RFC3339),
	}

	if len(cfg.MeshNames) > 0 {
		env.TrustDomain = cfg.MeshNames[0]
	}

	for _, n := range cfg.Elements.Nodes {
		if n.Data == nil {
			continue
		}
		switch n.Data.InfraType {
		case mesh.InfraTypeIstiod:
			if n.Data.Version != "" {
				env.IstioVersion = n.Data.Version
			}
			if env.TrustDomain == "" {
				env.TrustDomain = extractTrustDomain(n.Data)
			}
		case mesh.InfraTypeKiali:
			if n.Data.Version != "" {
				env.KialiVersion = n.Data.Version
			}
		}
	}
	return env
}

func extractTrustDomain(nd *meshCommon.NodeData) string {
	cp, ok := nd.InfraData.(models.ControlPlane)
	if !ok {
		return ""
	}
	if cp.MeshConfig != nil && cp.MeshConfig.MeshConfig != nil {
		return cp.MeshConfig.TrustDomain
	}
	if cp.Config.EffectiveConfig != nil &&
		cp.Config.EffectiveConfig.ConfigMap != nil &&
		cp.Config.EffectiveConfig.ConfigMap.Mesh != nil &&
		cp.Config.EffectiveConfig.ConfigMap.Mesh.MeshConfig != nil {
		return cp.Config.EffectiveConfig.ConfigMap.Mesh.TrustDomain
	}
	return ""
}

func extractComponents(cfg meshCommon.Config) MeshSummaryComponents {
	var cp MeshSummaryControlPlane
	obs := MeshSummaryObservabilityStack{}
	monitoredNS := make([]MeshSummaryMonitoredNamespace, 0)

	worstCPStatus := kubernetes.ComponentHealthy

	for _, n := range cfg.Elements.Nodes {
		if n.Data == nil {
			continue
		}

		health := resolveHealthString(n.Data.HealthData)

		switch n.Data.InfraType {
		case mesh.InfraTypeIstiod:
			cp.Nodes = append(cp.Nodes, MeshSummaryControlPlaneNode{
				Cluster:   n.Data.Cluster,
				Name:      n.Data.InfraName,
				Namespace: n.Data.Namespace,
				Status:    health,
				Version:   n.Data.Version,
			})
			worstCPStatus = worstHealth(worstCPStatus, health)

		case mesh.InfraTypeMetricStore:
			obs.Prometheus = health

		case mesh.InfraTypeTraceStore:
			name := n.Data.InfraName
			switch {
			case containsIgnoreCase(name, "tempo"):
				obs.Tempo = health
			case containsIgnoreCase(name, "zipkin"):
				obs.Zipkin = health
			default:
				obs.Jaeger = health
			}

		case mesh.InfraTypeGrafana:
			obs.Grafana = health

		case mesh.InfraTypePerses:
			obs.Perses = health

		case mesh.InfraTypeDataPlane:
			monitoredNS = append(monitoredNS, extractDataPlaneNamespaces(n.Data)...)
		}
	}

	if len(cp.Nodes) == 0 {
		cp.Status = "UNKNOWN"
	} else {
		cp.Status = worstCPStatus
	}

	return MeshSummaryComponents{
		ControlPlane:       cp,
		DataPlane:          MeshSummaryDataPlane{MonitoredNamespaces: monitoredNS},
		ObservabilityStack: obs,
	}
}

func extractDataPlaneNamespaces(nd *meshCommon.NodeData) []MeshSummaryMonitoredNamespace {
	if nd.InfraData == nil {
		return nil
	}
	nsList, ok := nd.InfraData.([]models.Namespace)
	if !ok {
		return nil
	}
	result := make([]MeshSummaryMonitoredNamespace, 0, len(nsList))
	for _, ns := range nsList {
		result = append(result, MeshSummaryMonitoredNamespace{
			Cluster:   nd.Cluster,
			IsAmbient: ns.IsAmbient,
			Name:      ns.Name,
		})
	}
	return result
}

func extractConnectivity(cfg meshCommon.Config, nodesByID map[string]*meshCommon.NodeData) []MeshSummaryEdge {
	edges := make([]MeshSummaryEdge, 0, len(cfg.Elements.Edges))
	seen := make(map[string]bool)
	for _, e := range cfg.Elements.Edges {
		if e.Data == nil {
			continue
		}
		srcNode := nodesByID[e.Data.Source]
		dstNode := nodesByID[e.Data.Target]
		if srcNode == nil || dstNode == nil {
			continue
		}
		if srcNode.IsBox != "" || dstNode.IsBox != "" {
			continue
		}
		from := humanReadableName(srcNode)
		to := humanReadableName(dstNode)
		fromC := clusterName(srcNode)
		toC := clusterName(dstNode)
		key := fromC + "/" + from + " -> " + toC + "/" + to
		if seen[key] {
			continue
		}
		seen[key] = true
		edges = append(edges, MeshSummaryEdge{
			From:        from,
			FromCluster: fromC,
			Status:      resolveHealthString(dstNode.HealthData),
			To:          to,
			ToCluster:   toC,
		})
	}
	return edges
}

func extractCriticalAlerts(cfg meshCommon.Config) []MeshSummaryCriticalAlert {
	var alerts []MeshSummaryCriticalAlert
	for _, n := range cfg.Elements.Nodes {
		if n.Data == nil || n.Data.IsBox != "" {
			continue
		}
		health := resolveHealthString(n.Data.HealthData)
		if health == kubernetes.ComponentUnreachable || health == kubernetes.ComponentUnhealthy || health == kubernetes.ComponentNotFound {
			alerts = append(alerts, MeshSummaryCriticalAlert{
				Cluster:   clusterName(n.Data),
				Component: humanReadableName(n.Data),
				Impact:    alertImpact(n.Data.InfraType),
				Message:   fmt.Sprintf("%s is %s", n.Data.InfraName, health),
			})
		}
	}
	return alerts
}

func resolveHealthString(healthData interface{}) string {
	if healthData == nil {
		return "UNKNOWN"
	}
	if s, ok := healthData.(string); ok {
		return s
	}
	return "UNKNOWN"
}

func humanReadableName(nd *meshCommon.NodeData) string {
	if nd.Namespace != "" {
		return fmt.Sprintf("%s/%s", nd.Namespace, nd.InfraName)
	}
	return nd.InfraName
}

func clusterName(nd *meshCommon.NodeData) string {
	if nd.Cluster == "_external_" {
		return ""
	}
	return nd.Cluster
}

func worstHealth(a, b string) string {
	priority := map[string]int{
		kubernetes.ComponentHealthy:     0,
		kubernetes.ComponentNotReady:    1,
		kubernetes.ComponentNotFound:    2,
		kubernetes.ComponentUnhealthy:   3,
		kubernetes.ComponentUnreachable: 4,
	}
	pa := priority[a]
	pb := priority[b]
	if pb > pa {
		return b
	}
	return a
}

func alertImpact(infraType string) string {
	switch infraType {
	case mesh.InfraTypeIstiod:
		return "Control plane unavailable; no sidecar injection, config distribution, or mTLS certificate rotation"
	case mesh.InfraTypeMetricStore:
		return "No metrics available; health, graphs, and dashboards will be empty"
	case mesh.InfraTypeTraceStore:
		return "Distributed tracing unavailable; cannot trace requests across services"
	case mesh.InfraTypeGrafana:
		return "Grafana dashboards unavailable"
	case mesh.InfraTypePerses:
		return "Perses dashboards unavailable"
	default:
		return "Component unavailable"
	}
}

func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

const defaultRateInterval = "10m"

func enrichNamespaceHealth(ctx context.Context, biz *business.Layer, namespaces []MeshSummaryMonitoredNamespace) {
	for i := range namespaces {
		ns := &namespaces[i]
		criteria := business.NamespaceHealthCriteria{
			Cluster:        ns.Cluster,
			IncludeMetrics: true,
			Namespace:      ns.Name,
			QueryTime:      util.Clock.Now(),
			RateInterval:   defaultRateInterval,
		}

		worst := "HEALTHY"

		appHealth, err := biz.Health.GetNamespaceAppHealth(ctx, criteria)
		if err != nil {
			ns.Health = "UNKNOWN"
			continue
		}
		worst = mergeStatus(worst, computeHealthFromApps(appHealth))

		svcHealth, err := biz.Health.GetNamespaceServiceHealth(ctx, criteria)
		if err != nil {
			ns.Health = "UNKNOWN"
			continue
		}
		worst = mergeStatus(worst, computeHealthFromServices(svcHealth))

		wlHealth, err := biz.Health.GetNamespaceWorkloadHealth(ctx, criteria)
		if err != nil {
			ns.Health = "UNKNOWN"
			continue
		}
		worst = mergeStatus(worst, computeHealthFromWorkloads(wlHealth))

		ns.Health = worst
	}
}

func computeHealthFromApps(appHealth models.NamespaceAppHealth) string {
	worst := "HEALTHY"
	for _, app := range appHealth {
		if app == nil {
			continue
		}
		worst = mergeStatus(worst, evaluateAppStatus(app))
	}
	return worst
}

func computeHealthFromServices(svcHealth models.NamespaceServiceHealth) string {
	worst := "HEALTHY"
	for _, svc := range svcHealth {
		if svc == nil {
			continue
		}
		worst = mergeStatus(worst, evaluateRequestStatus(svc.Requests))
	}
	return worst
}

func computeHealthFromWorkloads(wlHealth models.NamespaceWorkloadHealth) string {
	worst := "HEALTHY"
	for _, wl := range wlHealth {
		if wl == nil {
			continue
		}
		worst = mergeStatus(worst, evaluateWorkloadStatus(wl))
	}
	return worst
}

func evaluateWorkloadStatus(wl *models.WorkloadHealth) string {
	status := "HEALTHY"
	if wl.WorkloadStatus != nil {
		ws := wl.WorkloadStatus
		if ws.DesiredReplicas == 0 {
			status = "NOT_READY"
		} else if ws.AvailableReplicas == 0 {
			return "UNHEALTHY"
		} else if ws.AvailableReplicas < ws.DesiredReplicas {
			status = "DEGRADED"
		}
	}
	return mergeStatus(status, evaluateRequestStatus(wl.Requests))
}

func evaluateAppStatus(app *models.AppHealth) string {
	workloadStatus := "HEALTHY"
	for _, ws := range app.WorkloadStatuses {
		if ws.DesiredReplicas == 0 {
			workloadStatus = mergeStatus(workloadStatus, "NOT_READY")
			continue
		}
		if ws.AvailableReplicas == 0 {
			return "UNHEALTHY"
		}
		if ws.AvailableReplicas < ws.DesiredReplicas {
			workloadStatus = mergeStatus(workloadStatus, "DEGRADED")
		}
	}

	requestStatus := evaluateRequestStatus(app.Requests)
	return mergeStatus(workloadStatus, requestStatus)
}

func evaluateRequestStatus(req models.RequestHealth) string {
	status := "HEALTHY"
	processRequests := func(requests map[string]map[string]float64) {
		for protocol, codes := range requests {
			total := 0.0
			for _, count := range codes {
				total += count
			}
			if total == 0 {
				continue
			}
			for code, count := range codes {
				if !isHTTPOrGRPCError(protocol, code) {
					continue
				}
				ratio := count / total * 100
				if ratio >= 10 {
					status = "UNHEALTHY"
					return
				}
				if ratio > 0 && status != "UNHEALTHY" {
					status = "DEGRADED"
				}
			}
		}
	}
	processRequests(req.Inbound)
	processRequests(req.Outbound)
	return status
}

func isHTTPOrGRPCError(protocol, code string) bool {
	switch protocol {
	case "http":
		if code == "-" {
			return true
		}
		if len(code) == 3 && (code[0] == '4' || code[0] == '5') {
			return true
		}
	case "grpc":
		if code != "0" {
			return true
		}
	}
	return false
}

func mergeStatus(a, b string) string {
	priority := map[string]int{"HEALTHY": 0, "NOT_READY": 1, "DEGRADED": 2, "UNHEALTHY": 3}
	if priority[b] > priority[a] {
		return b
	}
	return a
}
