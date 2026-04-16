package openai_provider

import (
	"os"
	"path/filepath"
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
)

// TestAllMCPToolYAMLsConvertToOpenAI ensures every file in ai/mcp/tools converts without
// requiring each tool to be listed in a separate golden test (those catch schema drift).
func TestAllMCPToolYAMLsConvertToOpenAI(t *testing.T) {
	toolsDir := filepath.Join("..", "..", "mcp", "tools")
	entries, err := os.ReadDir(toolsDir)
	require.NoError(t, err)
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".yaml" {
			continue
		}
		name := e.Name()
		t.Run(name, func(t *testing.T) {
			tool, err := mcp.LoadToolDefinition(filepath.Join(toolsDir, name))
			require.NoError(t, err)
			converted := convertToolToOpenAI(tool)
			require.NotNil(t, converted.OfFunction, "expected OpenAI function tool for %s", name)
		})
	}
}

func TestConvertToolToOpenAI_FromToolDefinition_GetActionUI(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_action_ui.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_action_ui",
				Description: openai.String("Call this tool WHENEVER the user asks to navigate, view, show, open, or get a visual representation of resources (like graphs, lists, or details). This tool automatically redirects the user's Kiali UI. You do NOT need to analyze the output of this tool; simply call it and acknowledge to the user that you are taking them to the requested view."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"properties": map[string]interface{}{
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces. Use the 'page_namespaces' context if the user doesn't specify one. If empty, uses all accessible namespaces.",
						},
						"resourceType": map[string]interface{}{
							"type":        "string",
							"description": "The main category of the view to open. Use 'list' for multiple resources, 'details' for a specific resource, 'graph' for topology, or 'overview' for the main dashboard.",
							"enum":        []interface{}{"service", "workload", "app", "istio", "graph", "overview", "namespaces"},
						},
						"resourceName": map[string]interface{}{
							"type":        "string",
							"description": "The specific name of the resource (e.g., 'reviews-v1'). Leave empty if the user wants a list view.",
						},
						"graph": map[string]interface{}{
							"type":        "string",
							"description": "REQUIRED ONLY IF resourceType is 'graph'. Specifies the graph visualization type.",
							"enum":        []interface{}{"mesh", "traffic"},
						},
						"graphType": map[string]interface{}{
							"type":        "string",
							"description": "Granularity of the graph. Default is 'versionedApp'.",
							"enum":        []interface{}{"versionedApp", "app", "service", "workload"},
						},
						"tab": map[string]interface{}{
							"type":        "string",
							"description": "The specific tab to open when viewing resource details. Default is 'info'.",
							"enum":        []interface{}{"info", "logs", "metrics", "in_metrics", "out_metrics", "traffic", "traces", "envoy"},
						},
					},
					"required": []interface{}{"resourceType"},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetCitations(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_referenced_docs.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_referenced_docs",
				Description: openai.String("Call this tool whenever the user asks a conceptual question, asks 'how to', or needs troubleshooting documentation. This tool automatically surfaces relevant Istio/Kiali documentation links directly in the user's UI chat interface. You do not need to read the output; just call it and proceed to answer their question."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"keywords",
					},
					"properties": map[string]interface{}{
						"keywords": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of core concepts or keywords extracted from the user's query.",
						},
						"domain": map[string]interface{}{
							"type":        "string",
							"description": "Optional. The specific documentation domain to search. Default is 'all'.",
							"enum": []interface{}{
								"kiali",
								"istio",
								"all",
							},
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetLogs(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_logs.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_logs",
				Description: openai.String("Get the logs of a Kubernetes Pod (or workload name that will be resolved to a pod) in a namespace. Output is plain text, matching kubernetes-mcp-server pods_log."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"namespace",
						"name",
					},
					"properties": map[string]interface{}{
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Namespace to get the Pod logs from",
						},
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Name of the Pod to get the logs from. If it does not exist, it will be treated as a workload name and a running pod will be selected.",
						},
						"workload": map[string]interface{}{
							"type":        "string",
							"description": "Optional workload name override (used when name lookup fails).",
						},
						"container": map[string]interface{}{
							"type":        "string",
							"description": "Name of the Pod container to get the logs from (Optional)",
						},
						"tail": map[string]interface{}{
							"type":        "integer",
							"description": "Number of lines to retrieve from the end of the logs (Optional, default: 50). Cannot exceed 200 lines.",
						},
						"severity": map[string]interface{}{
							"type":        "string",
							"description": "Optional severity filter applied client-side. Accepts 'ERROR', 'WARN' or combinations like 'ERROR,WARN'.",
						},
						"previous": map[string]interface{}{
							"type":        "boolean",
							"description": "Return previous terminated container logs (Optional)",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional cluster name. Defaults to the cluster name in the Kiali configuration.",
						},
						"format": map[string]interface{}{
							"type":        "string",
							"description": "Output formatting for chat. 'codeblock' wraps logs in ~~~ fences (recommended). 'plain' returns raw text like kubernetes-mcp-server pods_log.",
							"enum": []interface{}{
								"codeblock",
								"plain",
							},
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetMeshStatus(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_mesh_status.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_mesh_status",
				Description: openai.String("Retrieves the high-level health, topology, and environment details of the Istio service mesh. Returns multi-cluster control plane status (istiod), data plane namespace health (including ambient mesh status), observability stack health (Prometheus, Grafana...), and component connectivity. Use this tool as the first step to diagnose mesh-wide issues, verify Istio/Kiali versions, or check overall health before drilling into specific workloads."),
				Parameters: openai.FunctionParameters{
					"type": "object",
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetMeshGraph(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_mesh_traffic_graph.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_mesh_traffic_graph",
				Description: openai.String("Returns service-to-service traffic topology, dependencies, and network metrics (throughput, response time, mTLS) for the specified namespaces. Use this to diagnose routing issues, latency, or find upstream/downstream dependencies."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"namespaces",
					},
					"properties": map[string]interface{}{
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces to map",
						},
						"graphType": map[string]interface{}{
							"type":        "string",
							"description": "Granularity of the graph. 'app' aggregates by app name, 'versionedApp' separates by versions, 'workload' maps specific pods/deployments. Default: versionedApp.",
							"enum": []interface{}{
								"versionedApp",
								"app",
								"service",
								"workload",
							},
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional cluster name to include in the graph. Default is the cluster name in the Kiali configuration (KubeConfig).",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetMetrics(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_metrics.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_metrics",
				Description: openai.String("Returns a compact JSON summary of Istio metrics (latency quantiles, traffic trends, throughput, payload sizes) for the given resource."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"properties": map[string]interface{}{
						"resourceType": map[string]interface{}{
							"type":        "string",
							"description": "Type of resource to get metrics",
							"enum": []interface{}{
								"service",
								"workload",
								"app",
							},
						},
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Namespace to get metrics from.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Cluster name to get metrics from. Optional, defaults to the cluster name in the Kiali configuration (KubeConfig).",
						},
						"resourceName": map[string]interface{}{
							"type":        "string",
							"description": "Name of the resource to get metrics for.",
						},
						"step": map[string]interface{}{
							"type":        "string",
							"description": "Step between data points in seconds (e.g., '15'). Optional, defaults to 15 seconds",
						},
						"rateInterval": map[string]interface{}{
							"type":        "string",
							"description": "Rate interval for metrics (e.g., '1m', '5m'). Optional, defaults to '10m'",
						},
						"direction": map[string]interface{}{
							"type":        "string",
							"description": "Traffic direction. Optional, defaults to 'outbound'",
							"enum": []interface{}{
								"inbound",
								"outbound",
							},
						},
						"reporter": map[string]interface{}{
							"type":        "string",
							"description": "Metrics reporter: 'source', 'destination', or 'both'. Optional, defaults to 'source'",
							"enum": []interface{}{
								"source",
								"destination",
								"both",
							},
						},
						"requestProtocol": map[string]interface{}{
							"type":        "string",
							"description": "Desired request protocol for the telemetry: For example, 'http' or 'grpc'. Optional",
						},
						"quantiles": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of quantiles for histogram metrics (e.g., '0.5,0.95,0.99'). Optional. Default is 0.5,0.95,0.99,0.999.",
						},
						"byLabels": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of labels to group metrics by (e.g., 'source_workload,destination_service'). Optional",
						},
					},
					"required": []interface{}{
						"resourceType",
						"namespace",
						"resourceName",
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetPodPerformance(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_pod_performance.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_pod_performance",
				Description: openai.String("Returns a human-readable text summary with current Pod CPU/memory usage (from Prometheus) compared to Kubernetes requests/limits (from the Pod spec). Useful to answer questions like 'Is this workload using too much memory?'."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"namespace",
					},
					"anyOf": []interface{}{
						map[string]interface{}{
							"required": []interface{}{
								"podName",
							},
						},
						map[string]interface{}{
							"required": []interface{}{
								"workloadName",
							},
						},
					},
					"properties": map[string]interface{}{
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Kubernetes namespace of the Pod.",
						},
						"podName": map[string]interface{}{
							"type":        "string",
							"description": "Kubernetes Pod name. If workloadName is provided, the tool will attempt to resolve a Pod from that workload first.",
						},
						"workloadName": map[string]interface{}{
							"type":        "string",
							"description": "Kubernetes Workload name (e.g. Deployment/StatefulSet/etc). Tool will look up the workload and pick one of its Pods. If not found, it will fall back to treating this value as a podName.",
						},
						"timeRange": map[string]interface{}{
							"type":        "string",
							"description": "Time window used to compute CPU rate (Prometheus duration like '5m', '10m', '1h', '1d'). Defaults to '10m'.",
						},
						"queryTime": map[string]interface{}{
							"type":        "string",
							"description": "Optional end timestamp (RFC3339) for the query. Defaults to now.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional cluster name. Defaults to the cluster name in the Kiali configuration (KubeConfig).",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_ListOrGetResources(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "list_or_get_resources.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "list_or_get_resources",
				Description: openai.String("Fetches a list of resources OR retrieves detailed data for a specific resource. If 'resourceName' is omitted, it returns a list. If 'resourceName' is provided, it returns details for that specific resource."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"resourceType",
					},
					"properties": map[string]interface{}{
						"resourceType": map[string]interface{}{
							"type":        "string",
							"description": "The type of resource to query.",
							"enum": []interface{}{
								"service",
								"workload",
								"app",
								"namespace",
							},
						},
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces to query (e.g., 'bookinfo' or 'bookinfo,default'). If not provided, it will query across all accessible namespaces.",
						},
						"resourceName": map[string]interface{}{
							"type":        "string",
							"description": "Optional. The specific name of the resource. If left empty, the tool returns a list of all resources of the specified type. If provided, the tool returns deep details for this specific resource.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Name of the cluster to get resources from. If not provided, will use the default cluster name in the Kiali KubeConfig.",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_ListTraces(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "list_traces.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "list_traces",
				Description: openai.String("Lists distributed traces for a service in a namespace. Returns a summary (namespace, service, total_found, avg_duration_ms) and a list of traces with id, duration_ms, spans_count, root_op, slowest_service, has_errors. Use get_trace_details with a trace id to get full hierarchy."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"namespace",
						"serviceName",
					},
					"properties": map[string]interface{}{
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Kubernetes namespace of the service (required).",
						},
						"serviceName": map[string]interface{}{
							"type":        "string",
							"description": "Service name to search traces for (required). Returns multiple traces up to limit.",
						},
						"errorOnly": map[string]interface{}{
							"type":        "boolean",
							"description": "If true, only consider traces that contain errors. Default false.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional cluster name. Defaults to the cluster name in the Kiali configuration.",
						},
						"lookbackSeconds": map[string]interface{}{
							"type":        "integer",
							"description": "How far back to search. Default 600 (10m).",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Maximum number of traces to return. Default 10.",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetTraceDetails(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_trace_details.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_trace_details",
				Description: openai.String("Fetches a single distributed trace by trace_id and returns its call hierarchy (service tree with duration, status, and nested calls). Use this after list_traces to drill into a specific trace."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"properties": map[string]interface{}{
						"traceId": map[string]interface{}{
							"type":        "string",
							"description": "Trace ID to fetch (required). Obtain from list_traces list response.",
						},
					},
					"required": []interface{}{
						"traceId",
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_ManageIstioConfig(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "manage_istio_config.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "manage_istio_config",
				Description: openai.String("Create, patch, or delete Istio config. For list and get (read-only) use manage_istio_config_read."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"action",
						"confirmed",
						"namespace",
						"group",
						"version",
						"kind",
						"object",
					},
					"properties": map[string]interface{}{
						"action": map[string]interface{}{
							"type":        "string",
							"description": "Action to perform (write)",
							"enum": []interface{}{
								"create",
								"patch",
								"delete",
							},
						},
						"confirmed": map[string]interface{}{
							"type":        "boolean",
							"description": "CRITICAL: If 'true', the destructive action (create/patch/delete) is executed. If 'false' (or omitted) for create/patch, the tool returns a YAML PREVIEW. Display it to the user and ask for confirmation before calling again with confirmed=true.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
						},
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Namespace containing the Istio object.",
						},
						"group": map[string]interface{}{
							"type":        "string",
							"description": "API group of the Istio object.",
							"enum": []interface{}{
								"networking.istio.io",
								"security.istio.io",
							},
						},
						"version": map[string]interface{}{
							"type":        "string",
							"description": "API version. Use 'v1' for VirtualService, DestinationRule, and Gateway.",
						},
						"kind": map[string]interface{}{
							"type":        "string",
							"description": "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule').",
							"enum": []interface{}{
								"VirtualService",
								"DestinationRule",
								"Gateway",
								"ServiceEntry",
								"Sidecar",
								"WorkloadEntry",
								"WorkloadGroup",
								"EnvoyFilter",
								"AuthorizationPolicy",
								"PeerAuthentication",
								"RequestAuthentication",
							},
						},
						"object": map[string]interface{}{
							"type":        "string",
							"description": "Name of the Istio object.",
						},
						"data": map[string]interface{}{
							"type":        "string",
							"description": "Complete JSON or YAML data to apply or create the object. Required for create and patch actions. You MUST provide a COMPLETE and VALID manifest with ALL required fields for the resource type. Arrays (like servers, http, etc.) are REPLACED entirely, so you must include ALL required fields within each array element.",
						},
						"dataFormat": map[string]interface{}{
							"type":        "string",
							"description": "Optional hint for the payload format. Usually leave as 'auto'.",
							"enum": []interface{}{
								"auto",
								"json",
								"yaml",
							},
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_ManageIstioConfigRead(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "manage_istio_config_read.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "manage_istio_config_read",
				Description: openai.String("Read-only Istio config: list or get objects. For action 'list', returns an array of objects with {name, namespace, type, validation}. For create, patch, or delete use manage_istio_config."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"action",
					},
					"properties": map[string]interface{}{
						"action": map[string]interface{}{
							"type":        "string",
							"description": "Action to perform (read-only)",
							"enum": []interface{}{
								"list",
								"get",
							},
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
						},
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Namespace containing the Istio object. For 'list', if not provided, returns objects across all namespaces. For 'get', required.",
						},
						"group": map[string]interface{}{
							"type":        "string",
							"description": "API group of the Istio object. Required for 'get' action.",
							"enum": []interface{}{
								"networking.istio.io",
								"security.istio.io",
							},
						},
						"version": map[string]interface{}{
							"type":        "string",
							"description": "API version. Use 'v1' for VirtualService, DestinationRule, and Gateway. Required for 'get' action.",
						},
						"kind": map[string]interface{}{
							"type":        "string",
							"description": "Kind of the Istio object. Required for 'get' action.",
							"enum": []interface{}{
								"VirtualService",
								"DestinationRule",
								"Gateway",
								"ServiceEntry",
								"Sidecar",
								"WorkloadEntry",
								"WorkloadGroup",
								"EnvoyFilter",
								"AuthorizationPolicy",
								"PeerAuthentication",
								"RequestAuthentication",
							},
						},
						"object": map[string]interface{}{
							"type":        "string",
							"description": "Name of the Istio object. Required for 'get' action.",
						},
						"serviceName": map[string]interface{}{
							"type":        "string",
							"description": "Filter Istio configurations (VirtualServices, DestinationRules, and their referenced Gateways) that affect a specific service. Only applicable for 'list' action.",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}
