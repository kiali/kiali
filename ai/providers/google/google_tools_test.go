package google_provider

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/genai"

	"github.com/kiali/kiali/ai/mcp"
)

func TestConvertToolToGoogle_FromToolDefinition_GetActionUI(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_action_ui.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"namespaces": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of namespaces. Use the 'page_namespaces' context if the user doesn't specify one. If empty, uses all accessible namespaces.",
			},
			"resourceType": {
				Type:        genai.TypeString,
				Description: "The main category of the view to open. Use 'list' for multiple resources, 'details' for a specific resource, 'graph' for topology, or 'overview' for the main dashboard.",
				Enum:        []string{"service", "workload", "app", "istio", "graph", "overview", "namespaces"},
			},
			"resourceName": {
				Type:        genai.TypeString,
				Description: "The specific name of the resource (e.g., 'reviews-v1'). Leave empty if the user wants a list view.",
			},
			"graph": {
				Type:        genai.TypeString,
				Description: "REQUIRED ONLY IF resourceType is 'graph'. Specifies the graph visualization type.",
				Enum:        []string{"mesh", "traffic"},
			},
			"graphType": {
				Type:        genai.TypeString,
				Description: "Granularity of the graph. Default is 'versionedApp'.",
				Enum:        []string{"versionedApp", "app", "service", "workload"},
			},
			"tab": {
				Type:        genai.TypeString,
				Description: "The specific tab to open when viewing resource details. Default is 'info'.",
				Enum:        []string{"info", "logs", "metrics", "in_metrics", "out_metrics", "traffic", "traces", "envoy"},
			},
		},
		Required: []string{"resourceType"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetCitations(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_referenced_docs.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"keywords": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of core concepts or keywords extracted from the user's query.",
			},
			"domain": {
				Type:        genai.TypeString,
				Description: "Optional. The specific documentation domain to search. Default is 'all'.",
				Enum:        []string{"kiali", "istio", "all"},
			},
		},
		Required: []string{"keywords"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetLogs(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_logs.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"namespace": {
				Type:        genai.TypeString,
				Description: "Namespace to get the Pod logs from",
			},
			"name": {
				Type:        genai.TypeString,
				Description: "Name of the Pod to get the logs from. If it does not exist, it will be treated as a workload name and a running pod will be selected.",
			},
			"workload": {
				Type:        genai.TypeString,
				Description: "Optional workload name override (used when name lookup fails).",
			},
			"container": {
				Type:        genai.TypeString,
				Description: "Name of the Pod container to get the logs from (Optional)",
			},
			"tail": {
				Type:        genai.TypeInteger,
				Description: "Number of lines to retrieve from the end of the logs (Optional, default: 50). Cannot exceed 200 lines.",
			},
			"severity": {
				Type:        genai.TypeString,
				Description: "Optional severity filter applied client-side. Accepts 'ERROR', 'WARN' or combinations like 'ERROR,WARN'.",
			},
			"previous": {
				Type:        genai.TypeBoolean,
				Description: "Return previous terminated container logs (Optional)",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Optional cluster name. Defaults to the cluster name in the Kiali configuration.",
			},
			"format": {
				Type:        genai.TypeString,
				Description: "Output formatting for chat. 'codeblock' wraps logs in ~~~ fences (recommended). 'plain' returns raw text like kubernetes-mcp-server pods_log.",
				Enum:        []string{"codeblock", "plain"},
			},
		},
		Required: []string{"namespace", "name"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetMeshStatus(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_mesh_status.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetMeshGraph(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_mesh_traffic_graph.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"namespaces": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of namespaces to map",
			},
			"graphType": {
				Type:        genai.TypeString,
				Description: "Granularity of the graph. 'app' aggregates by app name, 'versionedApp' separates by versions, 'workload' maps specific pods/deployments. Default: versionedApp.",
				Enum:        []string{"versionedApp", "app", "service", "workload"},
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Optional cluster name to include in the graph. Default is the cluster name in the Kiali configuration (KubeConfig).",
			},
		},
		Required: []string{"namespaces"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetMetrics(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_metrics.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"resourceType": {
				Type:        genai.TypeString,
				Description: "Type of resource to get metrics",
				Enum:        []string{"service", "workload", "app"},
			},
			"namespace": {
				Type:        genai.TypeString,
				Description: "Namespace to get metrics from.",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Cluster name to get metrics from. Optional, defaults to the cluster name in the Kiali configuration (KubeConfig).",
			},
			"resourceName": {
				Type:        genai.TypeString,
				Description: "Name of the resource to get metrics for.",
			},
			"step": {
				Type:        genai.TypeString,
				Description: "Step between data points in seconds (e.g., '15'). Optional, defaults to 15 seconds",
			},
			"rateInterval": {
				Type:        genai.TypeString,
				Description: "Rate interval for metrics (e.g., '1m', '5m'). Optional, defaults to '10m'",
			},
			"direction": {
				Type:        genai.TypeString,
				Description: "Traffic direction. Optional, defaults to 'outbound'",
				Enum:        []string{"inbound", "outbound"},
			},
			"reporter": {
				Type:        genai.TypeString,
				Description: "Metrics reporter: 'source', 'destination', or 'both'. Optional, defaults to 'source'",
				Enum:        []string{"source", "destination", "both"},
			},
			"requestProtocol": {
				Type:        genai.TypeString,
				Description: "Desired request protocol for the telemetry: For example, 'http' or 'grpc'. Optional",
			},
			"quantiles": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of quantiles for histogram metrics (e.g., '0.5,0.95,0.99'). Optional. Default is 0.5,0.95,0.99,0.999.",
			},
			"byLabels": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of labels to group metrics by (e.g., 'source_workload,destination_service'). Optional",
			},
		},
		Required: []string{"resourceType", "namespace", "resourceName"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_GetPodPerformance(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_pod_performance.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"namespace": {
				Type:        genai.TypeString,
				Description: "Kubernetes namespace of the Pod.",
			},
			"podName": {
				Type:        genai.TypeString,
				Description: "Kubernetes Pod name. If workloadName is provided, the tool will attempt to resolve a Pod from that workload first.",
			},
			"workloadName": {
				Type:        genai.TypeString,
				Description: "Kubernetes Workload name (e.g. Deployment/StatefulSet/etc). Tool will look up the workload and pick one of its Pods. If not found, it will fall back to treating this value as a podName.",
			},
			"timeRange": {
				Type:        genai.TypeString,
				Description: "Time window used to compute CPU rate (Prometheus duration like '5m', '10m', '1h', '1d'). Defaults to '10m'.",
			},
			"queryTime": {
				Type:        genai.TypeString,
				Description: "Optional end timestamp (RFC3339) for the query. Defaults to now.",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Optional cluster name. Defaults to the cluster name in the Kiali configuration (KubeConfig).",
			},
		},
		Required: []string{"namespace"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_ListOrGetResources(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "list_or_get_resources.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"resourceType": {
				Type:        genai.TypeString,
				Description: "The type of resource to query.",
				Enum:        []string{"service", "workload", "app", "namespace"},
			},
			"namespaces": {
				Type:        genai.TypeString,
				Description: "Comma-separated list of namespaces to query (e.g., 'bookinfo' or 'bookinfo,default'). If not provided, it will query across all accessible namespaces.",
			},
			"resourceName": {
				Type:        genai.TypeString,
				Description: "Optional. The specific name of the resource. If left empty, the tool returns a list of all resources of the specified type. If provided, the tool returns deep details for this specific resource.",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Optional. Name of the cluster to get resources from. If not provided, will use the default cluster name in the Kiali KubeConfig.",
			},
		},
		Required: []string{"resourceType"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_ListTraces(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "list_traces.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"namespace": {
				Type:        genai.TypeString,
				Description: "Kubernetes namespace of the service (required).",
			},
			"serviceName": {
				Type:        genai.TypeString,
				Description: "Service name to search traces for (required). Returns multiple traces up to limit.",
			},
			"errorOnly": {
				Type:        genai.TypeBoolean,
				Description: "If true, only consider traces that contain errors. Default false.",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Optional cluster name. Defaults to the cluster name in the Kiali configuration.",
			},
			"lookbackSeconds": {
				Type:        genai.TypeInteger,
				Description: "How far back to search. Default 600 (10m).",
			},
			"limit": {
				Type:        genai.TypeInteger,
				Description: "Maximum number of traces to return. Default 10.",
			},
		},
		Required: []string{"namespace", "serviceName"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_ManageIstioConfig(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "manage_istio_config.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"action": {
				Type:        genai.TypeString,
				Description: "Action to perform (write)",
				Enum:        []string{"create", "patch", "delete"},
			},
			"confirmed": {
				Type:        genai.TypeBoolean,
				Description: "CRITICAL: If 'true', the destructive action (create/patch/delete) is executed. If 'false' (or omitted) for create/patch, the tool returns a YAML PREVIEW. Display it to the user and ask for confirmation before calling again with confirmed=true.",
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
			},
			"namespace": {
				Type:        genai.TypeString,
				Description: "Namespace containing the Istio object.",
			},
			"group": {
				Type:        genai.TypeString,
				Description: "API group of the Istio object (e.g., 'networking.istio.io', 'gateway.networking.k8s.io').",
			},
			"version": {
				Type:        genai.TypeString,
				Description: "API version. Use 'v1' for VirtualService, DestinationRule, and Gateway.",
			},
			"kind": {
				Type:        genai.TypeString,
				Description: "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule').",
			},
			"object": {
				Type:        genai.TypeString,
				Description: "Name of the Istio object.",
			},
			"data": {
				Type:        genai.TypeString,
				Description: "Complete JSON or YAML data to apply or create the object. Required for create and patch actions. You MUST provide a COMPLETE and VALID manifest with ALL required fields for the resource type. Arrays (like servers, http, etc.) are REPLACED entirely, so you must include ALL required fields within each array element.",
			},
			"dataFormat": {
				Type:        genai.TypeString,
				Description: "Optional hint for the payload format. Usually leave as 'auto'.",
				Enum:        []string{"auto", "json", "yaml"},
			},
		},
		Required: []string{"action", "confirmed", "namespace", "group", "version", "kind", "object"},
	}

	assert.Equal(t, expected, converted)
}

func TestConvertToolToGoogle_FromToolDefinition_ManageIstioConfigRead(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "manage_istio_config_read.yaml"))
	require.NoError(t, err)

	converted := mapToGenAISchema(tool.GetDefinition())

	expected := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"action": {
				Type:        genai.TypeString,
				Description: "Action to perform (read-only)",
				Enum:        []string{"list", "get"},
			},
			"clusterName": {
				Type:        genai.TypeString,
				Description: "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
			},
			"namespace": {
				Type:        genai.TypeString,
				Description: "Namespace containing the Istio object. For 'list', if not provided, returns objects across all namespaces. For 'get', required.",
			},
			"group": {
				Type:        genai.TypeString,
				Description: "API group of the Istio object (e.g., 'networking.istio.io', 'gateway.networking.k8s.io'). Required for 'get' action.",
			},
			"version": {
				Type:        genai.TypeString,
				Description: "API version. Use 'v1' for VirtualService, DestinationRule, and Gateway. Required for 'get' action.",
			},
			"kind": {
				Type:        genai.TypeString,
				Description: "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule'). Required for 'get' action.",
			},
			"object": {
				Type:        genai.TypeString,
				Description: "Name of the Istio object. Required for 'get' action.",
			},
			"serviceName": {
				Type:        genai.TypeString,
				Description: "Filter Istio configurations (VirtualServices, DestinationRules, and their referenced Gateways) that affect a specific service. Only applicable for 'list' action.",
			},
		},
		Required: []string{"action"},
	}

	assert.Equal(t, expected, converted)
}
