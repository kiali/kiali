package troubleshooting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp/get_mesh_status"
	"github.com/kiali/kiali/kubernetes"
)

func TestCollectIssues_UnreachableObservabilityAndConnectivity(t *testing.T) {
	summary := get_mesh_status.MeshSummaryFormatted{
		Components: get_mesh_status.MeshSummaryComponents{
			ControlPlane: get_mesh_status.MeshSummaryControlPlane{
				Status: kubernetes.ComponentHealthy,
				Nodes: []get_mesh_status.MeshSummaryControlPlaneNode{{
					Cluster: "api-crc-testing:6443", Name: "istiod", Namespace: "istio-system",
					Status: kubernetes.ComponentHealthy, Version: "1.30.5",
				}},
			},
			ObservabilityStack: get_mesh_status.MeshSummaryObservabilityStack{
				Grafana:    kubernetes.ComponentUnreachable,
				Jaeger:     kubernetes.ComponentUnreachable,
				Prometheus: kubernetes.ComponentHealthy,
			},
		},
		ConnectivityGraph: []get_mesh_status.MeshSummaryEdge{
			{From: "istio-system/kiali", Status: kubernetes.ComponentHealthy, To: "istio-system/istiod"},
			{From: "istio-system/kiali", Status: kubernetes.ComponentHealthy, To: "Prometheus"},
			{From: "istio-system/kiali", Status: kubernetes.ComponentUnreachable, To: "istio-system/Grafana"},
			{From: "istio-system/kiali", Status: kubernetes.ComponentUnreachable, To: "jaeger"},
		},
		CriticalAlerts: []get_mesh_status.MeshSummaryCriticalAlert{
			{Component: "jaeger", Impact: "Distributed tracing unavailable", Message: "jaeger is Unreachable"},
			{Component: "istio-system/Grafana", Impact: "Grafana dashboards unavailable", Message: "Grafana is Unreachable"},
		},
	}

	issues := collectIssues(nil, summary, "api-crc-testing:6443", "")
	require.Len(t, issues, 1)

	byCat := map[string]Issue{}
	for _, issue := range issues {
		byCat[issue.Category] = issue
	}
	require.Contains(t, byCat, CategoryObservabilityStack)
	assert.NotContains(t, byCat, CategoryConnectivity, "Grafana/Jaeger failing edges should not be repeated under connectivity")
	require.Len(t, byCat[CategoryObservabilityStack].SubProblems, 2)

	for _, sp := range byCat[CategoryObservabilityStack].SubProblems {
		require.NotEmpty(t, sp.SuggestedPrompt)
		require.GreaterOrEqual(t, len(sp.SuggestedActions), 2)
		assert.Equal(t, ActionTypeQuestion, sp.SuggestedActions[0].Type)
		assert.Equal(t, ActionTypeAdvice, sp.SuggestedActions[1].Type)
		assert.Contains(t, sp.SuggestedActions[1].Command, "kubectl get pods -A | grep -i")
	}
}

func TestCollectIssues_ConnectivityKeepsUniqueEdges(t *testing.T) {
	summary := get_mesh_status.MeshSummaryFormatted{
		Components: get_mesh_status.MeshSummaryComponents{
			ObservabilityStack: get_mesh_status.MeshSummaryObservabilityStack{
				Grafana: kubernetes.ComponentUnreachable,
			},
		},
		ConnectivityGraph: []get_mesh_status.MeshSummaryEdge{
			{From: "istio-system/kiali", Status: kubernetes.ComponentUnreachable, To: "istio-system/Grafana"},
			{From: "istio-system/kiali", Status: kubernetes.ComponentUnreachable, To: "istio-system/istiod"},
		},
	}

	issues := collectIssues(nil, summary, "", "")
	byCat := map[string]Issue{}
	for _, issue := range issues {
		byCat[issue.Category] = issue
	}
	require.Contains(t, byCat, CategoryObservabilityStack)
	require.Contains(t, byCat, CategoryConnectivity)
	require.Len(t, byCat[CategoryConnectivity].SubProblems, 1)
	assert.Contains(t, byCat[CategoryConnectivity].SubProblems[0].Target, "istiod")
}

func TestCollectIssues_UnhealthyNamespace(t *testing.T) {
	summary := get_mesh_status.MeshSummaryFormatted{
		Components: get_mesh_status.MeshSummaryComponents{
			ControlPlane: get_mesh_status.MeshSummaryControlPlane{Status: kubernetes.ComponentHealthy},
			DataPlane: get_mesh_status.MeshSummaryDataPlane{
				MonitoredNamespaces: []get_mesh_status.MeshSummaryMonitoredNamespace{
					{Cluster: "Kubernetes", Health: "UNHEALTHY", Name: "bookinfo"},
					{Cluster: "Kubernetes", Health: "HEALTHY", Name: "istio-system"},
				},
			},
			ObservabilityStack: get_mesh_status.MeshSummaryObservabilityStack{
				Grafana:    kubernetes.ComponentHealthy,
				Prometheus: kubernetes.ComponentHealthy,
				Tempo:      kubernetes.ComponentHealthy,
			},
		},
	}

	issues := collectIssues(nil, summary, "Kubernetes", "")
	require.Len(t, issues, 1)
	assert.Equal(t, CategoryDataPlane, issues[0].Category)
	assert.Contains(t, issues[0].Problem, "bookinfo")
	assert.Contains(t, issues[0].Problem, "UNHEALTHY")
	require.Len(t, issues[0].SubProblems, 1)
}

func TestCollectIssues_HealthyMeshHasNoIssues(t *testing.T) {
	summary := get_mesh_status.MeshSummaryFormatted{
		Components: get_mesh_status.MeshSummaryComponents{
			ControlPlane: get_mesh_status.MeshSummaryControlPlane{
				Status: kubernetes.ComponentHealthy,
				Nodes: []get_mesh_status.MeshSummaryControlPlaneNode{{
					Status: kubernetes.ComponentHealthy, Name: "istiod",
				}},
			},
			DataPlane: get_mesh_status.MeshSummaryDataPlane{
				MonitoredNamespaces: []get_mesh_status.MeshSummaryMonitoredNamespace{
					{Health: "HEALTHY", Name: "bookinfo"},
				},
			},
			ObservabilityStack: get_mesh_status.MeshSummaryObservabilityStack{
				Prometheus: kubernetes.ComponentHealthy,
			},
		},
		ConnectivityGraph: []get_mesh_status.MeshSummaryEdge{
			{From: "kiali", To: "istiod", Status: kubernetes.ComponentHealthy},
		},
	}
	assert.Empty(t, collectIssues(nil, summary, "", ""))
}

func TestGenerateSuggestions(t *testing.T) {
	prompt, actions := generateSuggestions("Grafana", "status is Unreachable")
	assert.Equal(t, "Analyze why Grafana is reporting: 'status is Unreachable'. What are the potential root causes and how can I fix it?", prompt)
	require.Len(t, actions, 2)
	assert.Equal(t, ActionTypeQuestion, actions[0].Type)
	assert.Contains(t, actions[0].Description, "Grafana")
	assert.Equal(t, ActionTypeAdvice, actions[1].Type)
	assert.Equal(t, "kubectl get pods -A | grep -i grafana", actions[1].Command)
}

func TestIsHealthyStatus(t *testing.T) {
	assert.True(t, isHealthyStatus("Healthy"))
	assert.True(t, isHealthyStatus("HEALTHY"))
	assert.True(t, isHealthyStatus(""))
	assert.False(t, isHealthyStatus("Unreachable"))
	assert.False(t, isHealthyStatus("UNHEALTHY"))
	assert.False(t, isHealthyStatus("DEGRADED"))
}
