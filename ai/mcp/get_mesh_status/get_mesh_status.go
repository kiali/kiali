package get_mesh_status

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/mesh"
	meshApi "github.com/kiali/kiali/mesh/api"
	meshCommon "github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

func Execute(r *http.Request, args map[string]interface{}, business *business.Layer,
	prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache,
	conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {

	ctx := r.Context()

	meshReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/ai/mesh-status", nil)
	meshOpts := mesh.NewOptions(meshReq, &business.Namespace)

	code, payload := meshApi.GraphMesh(ctx, business, meshOpts, clientFactory, kialiCache, conf, grafana, perses, prom, discovery)
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

	return transformToSummary(meshConfig), http.StatusOK
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
	var monitoredNS []MeshSummaryMonitoredNamespace

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
