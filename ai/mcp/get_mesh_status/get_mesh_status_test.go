package get_mesh_status

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/mesh"
	meshCommon "github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/models"
)

func makeNode(id, infraType, infraName, cluster, namespace, version string, health interface{}, infraData interface{}) *meshCommon.NodeWrapper {
	return &meshCommon.NodeWrapper{
		Data: &meshCommon.NodeData{
			Cluster:    cluster,
			HealthData: health,
			ID:         id,
			InfraData:  infraData,
			InfraName:  infraName,
			InfraType:  infraType,
			Namespace:  namespace,
			NodeType:   mesh.NodeTypeInfra,
			Version:    version,
		},
	}
}

func makeEdge(id, source, target string) *meshCommon.EdgeWrapper {
	return &meshCommon.EdgeWrapper{
		Data: &meshCommon.EdgeData{
			ID:     id,
			Source: source,
			Target: target,
		},
	}
}

func sampleMeshConfig() meshCommon.Config {
	return meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-istiod", mesh.InfraTypeIstiod, "istiod", "cluster-1", "istio-system", "1.28.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-kiali", mesh.InfraTypeKiali, "kiali", "cluster-1", "istio-system", "v2.22.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-prom", mesh.InfraTypeMetricStore, "Prometheus", "_external_", "", "3.5.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-jaeger", mesh.InfraTypeTraceStore, "jaeger", "cluster-1", "istio-system", "", kubernetes.ComponentUnreachable, nil),
				makeNode("n-grafana", mesh.InfraTypeGrafana, "Grafana", "_external_", "", "", kubernetes.ComponentUnreachable, nil),
				makeNode("n-dp", mesh.InfraTypeDataPlane, "Data Plane", "cluster-1", "", "", kubernetes.ComponentHealthy, []models.Namespace{
					{Name: "bookinfo", Cluster: "cluster-1", IsAmbient: true},
					{Name: "default", Cluster: "cluster-1"},
				}),
			},
			Edges: []*meshCommon.EdgeWrapper{
				makeEdge("e1", "n-kiali", "n-istiod"),
				makeEdge("e2", "n-kiali", "n-prom"),
				makeEdge("e3", "n-kiali", "n-jaeger"),
				makeEdge("e4", "n-kiali", "n-grafana"),
			},
		},
		MeshNames: []string{"cluster.local"},
		Timestamp: time.Date(2026, 3, 17, 9, 0, 0, 0, time.UTC).Unix(),
	}
}

func TestTransformToSummary_Environment(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	assert.Equal(t, "cluster.local", summary.Environment.TrustDomain)
	assert.Equal(t, "1.28.0", summary.Environment.IstioVersion)
	assert.Equal(t, "v2.22.0", summary.Environment.KialiVersion)
	assert.Equal(t, "2026-03-17T09:00:00Z", summary.Environment.Timestamp)
}

func TestTransformToSummary_ControlPlane(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	require.Len(t, summary.Components.ControlPlane.Nodes, 1)
	assert.Equal(t, kubernetes.ComponentHealthy, summary.Components.ControlPlane.Status)

	node := summary.Components.ControlPlane.Nodes[0]
	assert.Equal(t, "istiod", node.Name)
	assert.Equal(t, "istio-system", node.Namespace)
	assert.Equal(t, "cluster-1", node.Cluster)
	assert.Equal(t, "1.28.0", node.Version)
	assert.Equal(t, kubernetes.ComponentHealthy, node.Status)
}

func TestHasAccessibleControlPlane_TrueWithIstiodNode(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())
	assert.True(t, hasAccessibleControlPlane(summary))
}

func TestHasAccessibleControlPlane_FalseWithoutControlPlaneNodes(t *testing.T) {
	cfg := meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-kiali", mesh.InfraTypeKiali, "kiali", "cluster-1", "istio-system", "v2.22.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-prom", mesh.InfraTypeMetricStore, "Prometheus", "_external_", "", "3.5.0", kubernetes.ComponentHealthy, nil),
			},
		},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)
	assert.False(t, hasAccessibleControlPlane(summary))
	assert.Equal(t, "UNKNOWN", summary.Components.ControlPlane.Status)
}

func TestTransformToSummary_ObservabilityStack(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	obs := summary.Components.ObservabilityStack
	assert.Equal(t, kubernetes.ComponentHealthy, obs.Prometheus)
	assert.Equal(t, kubernetes.ComponentUnreachable, obs.Jaeger)
	assert.Equal(t, kubernetes.ComponentUnreachable, obs.Grafana)
	assert.Empty(t, obs.Tempo)
	assert.Empty(t, obs.Zipkin)
	assert.Empty(t, obs.Perses)
}

func TestTransformToSummary_DataPlane(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	expected := []MeshSummaryMonitoredNamespace{
		{Cluster: "cluster-1", IsAmbient: true, Name: "bookinfo"},
		{Cluster: "cluster-1", Name: "default"},
	}
	assert.ElementsMatch(t, expected, summary.Components.DataPlane.MonitoredNamespaces)
}

func TestTransformToSummary_Connectivity(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	require.Len(t, summary.ConnectivityGraph, 4)

	edges := make(map[string]MeshSummaryEdge)
	for _, e := range summary.ConnectivityGraph {
		edges[e.To] = e
	}

	istiodEdge := edges["istio-system/istiod"]
	assert.Equal(t, "istio-system/kiali", istiodEdge.From)
	assert.Equal(t, "cluster-1", istiodEdge.FromCluster)
	assert.Equal(t, "cluster-1", istiodEdge.ToCluster)
	assert.Equal(t, kubernetes.ComponentHealthy, istiodEdge.Status)

	promEdge := edges["Prometheus"]
	assert.Equal(t, "istio-system/kiali", promEdge.From)
	assert.Equal(t, "cluster-1", promEdge.FromCluster)
	assert.Empty(t, promEdge.ToCluster)
	assert.Equal(t, kubernetes.ComponentHealthy, promEdge.Status)

	jaegerEdge := edges["istio-system/jaeger"]
	assert.Equal(t, "cluster-1", jaegerEdge.ToCluster)
	assert.Equal(t, kubernetes.ComponentUnreachable, jaegerEdge.Status)
}

func TestTransformToSummary_CriticalAlerts(t *testing.T) {
	summary := transformToSummary(sampleMeshConfig())

	require.Len(t, summary.CriticalAlerts, 2)

	alertComponents := make(map[string]MeshSummaryCriticalAlert)
	for _, a := range summary.CriticalAlerts {
		alertComponents[a.Component] = a
	}

	jaegerAlert, ok := alertComponents["istio-system/jaeger"]
	require.True(t, ok, "expected alert for jaeger")
	assert.Equal(t, "cluster-1", jaegerAlert.Cluster)
	assert.Contains(t, jaegerAlert.Message, "Unreachable")
	assert.NotEmpty(t, jaegerAlert.Impact)

	grafanaAlert, ok := alertComponents["Grafana"]
	require.True(t, ok, "expected alert for Grafana")
	assert.Contains(t, grafanaAlert.Message, "Unreachable")
}

func TestTransformToSummary_NoNodes_HandlesGracefully(t *testing.T) {
	cfg := meshCommon.Config{
		Elements:  meshCommon.Elements{},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	assert.Equal(t, "UNKNOWN", summary.Components.ControlPlane.Status)
	assert.Empty(t, summary.Components.ControlPlane.Nodes)
	assert.Empty(t, summary.ConnectivityGraph)
	assert.Empty(t, summary.CriticalAlerts)
}

func TestTransformToSummary_TempoTraceStore(t *testing.T) {
	cfg := meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-tempo", mesh.InfraTypeTraceStore, "Tempo", "cluster-1", "tempo", "", kubernetes.ComponentHealthy, nil),
			},
		},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	assert.Equal(t, kubernetes.ComponentHealthy, summary.Components.ObservabilityStack.Tempo)
	assert.Empty(t, summary.Components.ObservabilityStack.Jaeger)
}

func TestTransformToSummary_UnhealthyControlPlane_OverallStatus(t *testing.T) {
	cfg := meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-istiod-1", mesh.InfraTypeIstiod, "istiod", "cluster-1", "istio-system", "1.28.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-istiod-2", mesh.InfraTypeIstiod, "istiod", "cluster-2", "istio-system", "1.28.0", kubernetes.ComponentUnhealthy, nil),
			},
		},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	assert.Equal(t, kubernetes.ComponentUnhealthy, summary.Components.ControlPlane.Status)
	require.Len(t, summary.Components.ControlPlane.Nodes, 2)
}

func TestResolveHealthString(t *testing.T) {
	assert.Equal(t, "Healthy", resolveHealthString("Healthy"))
	assert.Equal(t, "Unreachable", resolveHealthString("Unreachable"))
	assert.Equal(t, "UNKNOWN", resolveHealthString(nil))
	assert.Equal(t, "UNKNOWN", resolveHealthString(42))
}

func TestHumanReadableName(t *testing.T) {
	nd := &meshCommon.NodeData{InfraName: "istiod", Namespace: "istio-system", Cluster: "east"}
	assert.Equal(t, "istio-system/istiod", humanReadableName(nd))

	nd2 := &meshCommon.NodeData{InfraName: "Prometheus", Namespace: "", Cluster: "_external_"}
	assert.Equal(t, "Prometheus", humanReadableName(nd2))

	nd3 := &meshCommon.NodeData{InfraName: "Data Plane", Namespace: "", Cluster: "west"}
	assert.Equal(t, "Data Plane", humanReadableName(nd3))
}

func TestClusterName(t *testing.T) {
	assert.Equal(t, "east", clusterName(&meshCommon.NodeData{Cluster: "east"}))
	assert.Empty(t, clusterName(&meshCommon.NodeData{Cluster: "_external_"}))
	assert.Empty(t, clusterName(&meshCommon.NodeData{Cluster: ""}))
}

func TestTransformToSummary_MultiClusterDataPlane(t *testing.T) {
	cfg := meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-dp-1", mesh.InfraTypeDataPlane, "Data Plane", "east", "", "", kubernetes.ComponentHealthy, []models.Namespace{
					{Name: "bookinfo", Cluster: "east", IsAmbient: true},
					{Name: "default", Cluster: "east"},
				}),
				makeNode("n-dp-2", mesh.InfraTypeDataPlane, "Data Plane", "west", "", "", kubernetes.ComponentHealthy, []models.Namespace{
					{Name: "bookinfo", Cluster: "west"},
				}),
			},
		},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	expected := []MeshSummaryMonitoredNamespace{
		{Cluster: "east", IsAmbient: true, Name: "bookinfo"},
		{Cluster: "east", Name: "default"},
		{Cluster: "west", Name: "bookinfo"},
	}
	assert.ElementsMatch(t, expected, summary.Components.DataPlane.MonitoredNamespaces)
}

func TestTransformToSummary_DuplicateEdges(t *testing.T) {
	cfg := meshCommon.Config{
		Elements: meshCommon.Elements{
			Nodes: []*meshCommon.NodeWrapper{
				makeNode("n-istiod", mesh.InfraTypeIstiod, "istiod", "cluster-1", "istio-system", "1.28.0", kubernetes.ComponentHealthy, nil),
				makeNode("n-dp-1", mesh.InfraTypeDataPlane, "Data Plane", "cluster-1", "", "", kubernetes.ComponentHealthy, nil),
				makeNode("n-dp-2", mesh.InfraTypeDataPlane, "Data Plane", "cluster-1", "", "", kubernetes.ComponentHealthy, nil),
			},
			Edges: []*meshCommon.EdgeWrapper{
				makeEdge("e1", "n-istiod", "n-dp-1"),
				makeEdge("e2", "n-istiod", "n-dp-2"),
			},
		},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	require.Len(t, summary.ConnectivityGraph, 1, "duplicate edges should be deduplicated")
	assert.Equal(t, "istio-system/istiod", summary.ConnectivityGraph[0].From)
	assert.Equal(t, "cluster-1", summary.ConnectivityGraph[0].FromCluster)
	assert.Equal(t, "Data Plane", summary.ConnectivityGraph[0].To)
	assert.Equal(t, "cluster-1", summary.ConnectivityGraph[0].ToCluster)
}

func TestWorstHealth(t *testing.T) {
	assert.Equal(t, kubernetes.ComponentHealthy, worstHealth(kubernetes.ComponentHealthy, kubernetes.ComponentHealthy))
	assert.Equal(t, kubernetes.ComponentUnhealthy, worstHealth(kubernetes.ComponentHealthy, kubernetes.ComponentUnhealthy))
	assert.Equal(t, kubernetes.ComponentUnreachable, worstHealth(kubernetes.ComponentUnreachable, kubernetes.ComponentUnhealthy))
}

func TestComputeHealthFromApps_Healthy(t *testing.T) {
	appHealth := models.NamespaceAppHealth{
		"reviews": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 2, DesiredReplicas: 2},
			},
		},
		"ratings": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 1, DesiredReplicas: 1},
			},
		},
	}
	assert.Equal(t, "HEALTHY", computeHealthFromApps(appHealth))
}

func TestComputeHealthFromApps_Degraded(t *testing.T) {
	appHealth := models.NamespaceAppHealth{
		"reviews": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 1, DesiredReplicas: 2},
			},
		},
		"ratings": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 1, DesiredReplicas: 1},
			},
		},
	}
	assert.Equal(t, "DEGRADED", computeHealthFromApps(appHealth))
}

func TestComputeHealthFromApps_Unhealthy(t *testing.T) {
	appHealth := models.NamespaceAppHealth{
		"reviews": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 0, DesiredReplicas: 2},
			},
		},
	}
	assert.Equal(t, "UNHEALTHY", computeHealthFromApps(appHealth))
}

func TestComputeHealthFromApps_Empty(t *testing.T) {
	assert.Equal(t, "HEALTHY", computeHealthFromApps(models.NamespaceAppHealth{}))
}

func TestComputeHealthFromApps_NilApp(t *testing.T) {
	appHealth := models.NamespaceAppHealth{
		"reviews": nil,
	}
	assert.Equal(t, "HEALTHY", computeHealthFromApps(appHealth))
}

func TestComputeHealthFromServices_Healthy(t *testing.T) {
	svcHealth := models.NamespaceServiceHealth{
		"productpage": &models.ServiceHealth{
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 100},
				},
			},
		},
	}
	assert.Equal(t, "HEALTHY", computeHealthFromServices(svcHealth))
}

func TestComputeHealthFromServices_Unhealthy(t *testing.T) {
	svcHealth := models.NamespaceServiceHealth{
		"productpage": &models.ServiceHealth{
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 80, "500": 20},
				},
			},
		},
	}
	assert.Equal(t, "UNHEALTHY", computeHealthFromServices(svcHealth))
}

func TestComputeHealthFromServices_Degraded(t *testing.T) {
	svcHealth := models.NamespaceServiceHealth{
		"productpage": &models.ServiceHealth{
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 99, "500": 1},
				},
			},
		},
	}
	assert.Equal(t, "DEGRADED", computeHealthFromServices(svcHealth))
}

func TestComputeHealthFromServices_Empty(t *testing.T) {
	assert.Equal(t, "HEALTHY", computeHealthFromServices(models.NamespaceServiceHealth{}))
}

func TestComputeHealthFromServices_NilService(t *testing.T) {
	svcHealth := models.NamespaceServiceHealth{
		"productpage": nil,
	}
	assert.Equal(t, "HEALTHY", computeHealthFromServices(svcHealth))
}

func TestComputeHealthFromWorkloads_Healthy(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{AvailableReplicas: 2, DesiredReplicas: 2},
		},
	}
	assert.Equal(t, "HEALTHY", computeHealthFromWorkloads(wlHealth))
}

func TestComputeHealthFromWorkloads_Unhealthy(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{AvailableReplicas: 0, DesiredReplicas: 2},
		},
	}
	assert.Equal(t, "UNHEALTHY", computeHealthFromWorkloads(wlHealth))
}

func TestComputeHealthFromWorkloads_Degraded(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{AvailableReplicas: 1, DesiredReplicas: 3},
		},
	}
	assert.Equal(t, "DEGRADED", computeHealthFromWorkloads(wlHealth))
}

func TestComputeHealthFromWorkloads_NotReady(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{AvailableReplicas: 0, DesiredReplicas: 0},
		},
	}
	assert.Equal(t, "NOT_READY", computeHealthFromWorkloads(wlHealth))
}

func TestComputeHealthFromWorkloads_ErrorRate(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{AvailableReplicas: 2, DesiredReplicas: 2},
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 80, "500": 20},
				},
			},
		},
	}
	assert.Equal(t, "UNHEALTHY", computeHealthFromWorkloads(wlHealth))
}

func TestComputeHealthFromWorkloads_Empty(t *testing.T) {
	assert.Equal(t, "HEALTHY", computeHealthFromWorkloads(models.NamespaceWorkloadHealth{}))
}

func TestComputeHealthFromWorkloads_NilWorkload(t *testing.T) {
	wlHealth := models.NamespaceWorkloadHealth{
		"reviews-v1": nil,
	}
	assert.Equal(t, "HEALTHY", computeHealthFromWorkloads(wlHealth))
}

func TestEvaluateAppStatus_HealthyWorkloads(t *testing.T) {
	app := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{AvailableReplicas: 3, DesiredReplicas: 3},
		},
	}
	assert.Equal(t, "HEALTHY", evaluateAppStatus(app))
}

func TestEvaluateAppStatus_ScaledToZero(t *testing.T) {
	app := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{AvailableReplicas: 0, DesiredReplicas: 0},
		},
	}
	assert.Equal(t, "NOT_READY", evaluateAppStatus(app))
}

func TestEvaluateAppStatus_PartialReplicas(t *testing.T) {
	app := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{AvailableReplicas: 1, DesiredReplicas: 3},
		},
	}
	assert.Equal(t, "DEGRADED", evaluateAppStatus(app))
}

func TestEvaluateAppStatus_ZeroAvailable(t *testing.T) {
	app := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{AvailableReplicas: 0, DesiredReplicas: 2},
		},
	}
	assert.Equal(t, "UNHEALTHY", evaluateAppStatus(app))
}

func TestEvaluateAppStatus_HighErrorRate(t *testing.T) {
	app := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{AvailableReplicas: 2, DesiredReplicas: 2},
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 80, "500": 20},
			},
		},
	}
	assert.Equal(t, "UNHEALTHY", evaluateAppStatus(app))
}

func TestEvaluateRequestStatus_NoTraffic(t *testing.T) {
	req := models.RequestHealth{}
	assert.Equal(t, "HEALTHY", evaluateRequestStatus(req))
}

func TestEvaluateRequestStatus_GRPCError(t *testing.T) {
	req := models.RequestHealth{
		Inbound: map[string]map[string]float64{
			"grpc": {"0": 80, "14": 20},
		},
	}
	assert.Equal(t, "UNHEALTHY", evaluateRequestStatus(req))
}

func TestMergeStatus(t *testing.T) {
	assert.Equal(t, "HEALTHY", mergeStatus("HEALTHY", "HEALTHY"))
	assert.Equal(t, "NOT_READY", mergeStatus("HEALTHY", "NOT_READY"))
	assert.Equal(t, "DEGRADED", mergeStatus("NOT_READY", "DEGRADED"))
	assert.Equal(t, "DEGRADED", mergeStatus("HEALTHY", "DEGRADED"))
	assert.Equal(t, "UNHEALTHY", mergeStatus("DEGRADED", "UNHEALTHY"))
	assert.Equal(t, "UNHEALTHY", mergeStatus("UNHEALTHY", "HEALTHY"))
}

func TestComputeHealthFromApps_NotReady(t *testing.T) {
	appHealth := models.NamespaceAppHealth{
		"reviews": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 0, DesiredReplicas: 0},
			},
		},
		"ratings": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{AvailableReplicas: 1, DesiredReplicas: 1},
			},
		},
	}
	assert.Equal(t, "NOT_READY", computeHealthFromApps(appHealth))
}

func TestTransformToSummary_DataPlane_EmptyNotNull(t *testing.T) {
	cfg := meshCommon.Config{
		Elements:  meshCommon.Elements{},
		Timestamp: time.Now().Unix(),
	}
	summary := transformToSummary(cfg)

	require.NotNil(t, summary.Components.DataPlane.MonitoredNamespaces, "monitored_namespaces should be empty slice, not nil")
	assert.Empty(t, summary.Components.DataPlane.MonitoredNamespaces)
}

func TestIsHTTPOrGRPCError(t *testing.T) {
	assert.True(t, isHTTPOrGRPCError("http", "500"))
	assert.True(t, isHTTPOrGRPCError("http", "404"))
	assert.True(t, isHTTPOrGRPCError("http", "-"))
	assert.False(t, isHTTPOrGRPCError("http", "200"))
	assert.True(t, isHTTPOrGRPCError("grpc", "14"))
	assert.False(t, isHTTPOrGRPCError("grpc", "0"))
}
