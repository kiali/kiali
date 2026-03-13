package openai_provider

import (
	"path/filepath"
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/config"
)

func TestConvertToolToOpenAI_FromToolDefinition(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_action_ui.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_action_ui",
				Description: openai.String("Returns the action to navigate in the Kiali UI when user request see graph or mesh graph,list/get/show resources or a detailed resource information"),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"properties": map[string]interface{}{
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces in case of list/show resources or graph, just one namespace in case of get or show resource. If empty, will use all namespaces accessible to the user.",
						},
						"resourceType": map[string]interface{}{
							"type":        "string",
							"description": "Type of resource to get a view of : list resources,details of a resource, traffic/mesh graph or overview of namespaces",
							"enum":        []interface{}{"service", "workload", "app", "istio", "graph", "overview"},
						},
						"resourceName": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Name of the resource to get details for (optional string - if provided, gets details; if empty, lists all).",
						},
						"graph": map[string]interface{}{
							"type":        "string",
							"description": "Optional. If resourceType is graph, you can specify the type of graph to return: Mesh if user request mesh or traffic graph (Values: mesh|traffic). Mesh graph no required namespaces parameter, traffic graph have an optional namespaces parameter. Default graph is traffic",
							"enum":        []interface{}{"mesh", "traffic"},
						},
						"graphType": map[string]interface{}{
							"type":        "string",
							"description": "Optional type of graph to return. Default is 'versionedApp'.",
							"enum":        []interface{}{"versionedApp", "app", "service", "workload"},
						},
						"tab": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Tab to open in case of show resource details. Default is info.",
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

func TestGetProviderOptions_NilConfig(t *testing.T) {
	provider := &config.ProviderConfig{
		Name: "test-provider",
		Key:  "some-key",
	}
	model := &config.AIModel{
		Name: "test-model",
	}

	_, err := getProviderOptions(nil, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "config is required")
}

func TestGetProviderOptions_AzureRequiresEndpoint(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "azure-provider",
		Type:   config.OpenAIProvider,
		Config: config.OpenAIProviderConfigAzure,
		Key:    "azure-key",
	}
	model := &config.AIModel{
		Name:     "azure-model",
		Model:    "gpt-4",
		Endpoint: "", // Empty - should error for Azure
	}

	_, err := getProviderOptions(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "endpoint is required for azure")
}

func TestGetProviderOptions_UnsupportedProviderConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: "unsupported-config-type",
		Key:    "some-key",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
	}

	_, err := getProviderOptions(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported provider config type")
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

func TestConvertToolToOpenAI_FromToolDefinition_GetMeshGraph(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_mesh_graph.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_mesh_graph",
				Description: openai.String("Returns the mesh graph data for the given namespaces and graph type."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"namespaces",
					},
					"properties": map[string]interface{}{
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces to include in the graph",
						},
						"graphType": map[string]interface{}{
							"type":        "string",
							"description": "Type of graph to return. Possible values: versionedApp, app, service, workload. Default is versionedApp.",
							"enum": []interface{}{
								"versionedApp",
								"app",
								"service",
								"workload",
							},
						},
						"rateInterval": map[string]interface{}{
							"type":        "string",
							"description": "Optional rate interval for fetching (e.g., '10m', '5m', '1h'). Default is '10m'.",
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
				Description: openai.String("Returns metrics for the given resource type, namespaces and resource name."),
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

func TestConvertToolToOpenAI_FromToolDefinition_GetResourceDetail(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_resource_detail.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_resource_detail",
				Description: openai.String("Returns the resource detail data for the given resource type, namespaces and resource name."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"resourceType",
					},
					"properties": map[string]interface{}{
						"resourceType": map[string]interface{}{
							"type":        "string",
							"description": "Type of resource to get list/details",
							"enum": []interface{}{
								"service",
								"workload",
							},
						},
						"namespaces": map[string]interface{}{
							"type":        "string",
							"description": "Comma-separated list of namespaces to get services from (e.g. 'bookinfo' or 'bookinfo,default'). If not provided, will list services from all accessible namespaces",
						},
						"resourceName": map[string]interface{}{
							"type":        "string",
							"description": "Name of the resource to get details for (optional string - if provided, gets details; if empty, lists all).",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Name of the cluster to get resources from. If not provided, will use the cluster name in the Kiali configuration (KubeConfig).",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}

func TestConvertToolToOpenAI_FromToolDefinition_GetTraces(t *testing.T) {
	tool, err := mcp.LoadToolDefinition(filepath.Join("..", "..", "mcp", "tools", "get_traces.yaml"))
	require.NoError(t, err)

	converted := convertToolToOpenAI(tool)

	expected := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        "get_traces",
				Description: openai.String("Fetches a distributed trace (Jaeger/Tempo) by trace_id or searches by service_name (optionally only error traces) and summarizes bottlenecks and error spans."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"properties": map[string]interface{}{
						"traceId": map[string]interface{}{
							"type":        "string",
							"description": "Trace ID to fetch and summarize. If provided, namespace/service_name are ignored.",
						},
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Kubernetes namespace of the service (required when trace_id is not provided).",
						},
						"serviceName": map[string]interface{}{
							"type":        "string",
							"description": "Service name to search traces for (required when trace_id is not provided).",
						},
						"errorOnly": map[string]interface{}{
							"type":        "boolean",
							"description": "If true, only consider traces that contain errors (e.g. error=true / non-200 status). Default false.",
						},
						"clusterName": map[string]interface{}{
							"type":        "string",
							"description": "Optional cluster name. Defaults to the cluster name in the Kiali configuration.",
						},
						"lookbackSeconds": map[string]interface{}{
							"type":        "integer",
							"description": "How far back to search when using service_name. Default 600 (10m).",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of traces to consider when searching by service_name. Default 10.",
						},
						"maxSpans": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of spans to return in each summary section (bottlenecks, errors, roots). Default 7.",
						},
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
				Description: openai.String("Manages the Istio config for the given cluster, namespace, group, version, kind and object."),
				Parameters: openai.FunctionParameters{
					"type": "object",
					"required": []interface{}{
						"action",
						"confirmed",
					},
					"properties": map[string]interface{}{
						"action": map[string]interface{}{
							"type":        "string",
							"description": "Action to perform",
							"enum": []interface{}{
								"list",
								"get",
								"create",
								"patch",
								"delete",
							},
						},
						"confirmed": map[string]interface{}{
							"type":        "boolean",
							"description": "CRITICAL: For 'create', 'patch', or 'delete' actions. If 'true', the destructive action (create/patch/delete) is executed. If 'false' (or omitted) for create/patch, the tool will return a YAML PREVIEW of the object. You should display this YAML to the user and ask for confirmation before calling this tool again with confirmed=true.",
						},
						"cluster": map[string]interface{}{
							"type":        "string",
							"description": "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
						},
						"namespace": map[string]interface{}{
							"type":        "string",
							"description": "Namespace containing the Istio object, if not provided, will return all istio objects across all namespaces in the cluster",
						},
						"group": map[string]interface{}{
							"type":        "string",
							"description": "API group of the Istio object (e.g., 'networking.istio.io', 'gateway.networking.k8s.io'). Required for create, patch, and get actions.",
						},
						"version": map[string]interface{}{
							"type":        "string",
							"description": "API version. IMPORTANT: Use 'v1' for VirtualService, DestinationRule, and Gateway. Do NOT use 'v1alpha3'.. Required for create, patch, and get actions.",
						},
						"kind": map[string]interface{}{
							"type":        "string",
							"description": "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule'). Required for create, patch, and get actions.",
						},
						"object": map[string]interface{}{
							"type":        "string",
							"description": "Name of the Istio object. Required for patch,get,create and delete actions.",
						},
						"jsonData": map[string]interface{}{
							"type":        "string",
							"description": "JSON data to apply or create the object. Required for create and patch actions.",
						},
					},
				},
			},
		},
	}

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, expected, converted)
}
