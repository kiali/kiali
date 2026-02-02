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

func TestConvertToolToOpenAI(t *testing.T) {
	tool := mcp.ToolDef{
		Name:        "get_resource_detail",
		Description: "Returns details for a Kiali resource",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type": "string",
				},
				"name": map[string]interface{}{
					"type": "string",
				},
			},
			"required": []interface{}{"namespace", "name"},
		},
	}

	converted := convertToolToOpenAI(tool)

	require.NotNil(t, converted.OfFunction)
	assert.Equal(t, tool.Name, converted.OfFunction.Function.Name)
	assert.Equal(t, openai.String(tool.Description), converted.OfFunction.Function.Description)
	assert.Equal(t, openai.FunctionParameters(tool.InputSchema), converted.OfFunction.Function.Parameters)
}

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
