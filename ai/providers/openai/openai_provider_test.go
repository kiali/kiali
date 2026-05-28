package openai_provider

import (
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/config"
)

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

func TestNewOpenAIProvider_DefaultConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-openai",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "test-api-key",
	}
	model := &config.AIModel{
		Name:  "gpt-4o",
		Model: "gpt-4o",
	}

	p, err := NewOpenAIProvider(conf, provider, model)
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, "gpt-4o", p.model)
	assert.Equal(t, "OpenAI", p.GetName())
}

func TestNewOpenAIProvider_GeminiConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "gemini-via-openai",
		Type:   config.OpenAIProvider,
		Config: config.ProviderConfigGemini,
		Key:    "gemini-key",
	}
	model := &config.AIModel{
		Name:  "gemini-1.5-pro",
		Model: "gemini-1.5-pro",
	}

	p, err := NewOpenAIProvider(conf, provider, model)
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, "gemini-1.5-pro", p.model)
}

func TestNewOpenAIProvider_InvalidConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "bad-config",
		Config: "unsupported-type",
		Key:    "key",
	}
	model := &config.AIModel{Model: "model"}

	_, err := NewOpenAIProvider(conf, provider, model)
	require.Error(t, err)
}

func TestGetProviderOptions_GeminiConfig_Success(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "gemini-provider",
		Type:   config.OpenAIProvider,
		Config: config.ProviderConfigGemini,
		Key:    "gemini-api-key",
	}
	model := &config.AIModel{
		Name:  "gemini-pro",
		Model: "gemini-1.5-pro",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.NotEmpty(t, opts)
}

func TestGetProviderOptions_GeminiConfig_CustomEndpoint(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "gemini-provider",
		Type:   config.OpenAIProvider,
		Config: config.ProviderConfigGemini,
		Key:    "gemini-api-key",
	}
	model := &config.AIModel{
		Name:     "gemini-pro",
		Model:    "gemini-1.5-pro",
		Endpoint: "https://custom.endpoint.example.com/v1",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.NotEmpty(t, opts)
}

func TestGetProviderOptions_DefaultConfig_NoBaseURL(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "openai-provider",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "openai-api-key",
	}
	model := &config.AIModel{
		Name:  "gpt-4o",
		Model: "gpt-4o",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.NotEmpty(t, opts)
}

func TestGetProviderOptions_DefaultConfig_WithBaseURL(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "openai-provider",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "openai-api-key",
	}
	model := &config.AIModel{
		Name:     "gpt-4o",
		Model:    "gpt-4o",
		Endpoint: "https://my-custom-openai.example.com/v1",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.NotEmpty(t, opts)
}

func TestGetProviderOptions_AzureConfig_WithEndpoint(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "azure-provider",
		Type:   config.OpenAIProvider,
		Config: config.OpenAIProviderConfigAzure,
		Key:    "azure-api-key",
	}
	model := &config.AIModel{
		Name:     "gpt-4",
		Model:    "gpt-4",
		Endpoint: "https://my-deployment.openai.azure.com",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.NotEmpty(t, opts)
}

func TestGetToolDefinitions_ReturnsToolList(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	p := &OpenAIProvider{conf: config.NewConfig()}
	result := p.GetToolDefinitions()
	tools, ok := result.([]openai.ChatCompletionToolUnionParam)
	require.True(t, ok)
	assert.NotEmpty(t, tools)
}

func TestGetToolDefinitions_FiltersTraceToolsWhenDisabled(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	confWith := config.NewConfig()
	confWith.ExternalServices.Tracing.Enabled = true
	confWithout := config.NewConfig()
	confWithout.ExternalServices.Tracing.Enabled = false

	pWith := &OpenAIProvider{conf: confWith}
	pWithout := &OpenAIProvider{conf: confWithout}

	withTracing := pWith.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)
	withoutTracing := pWithout.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)

	assert.Less(t, len(withoutTracing), len(withTracing))
}

func TestGetToolDefinitions_FiltersMetricToolsWhenPrometheusDisabled(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	confWith := config.NewConfig()
	confWith.ExternalServices.Prometheus.Enabled = true
	confWithout := config.NewConfig()
	confWithout.ExternalServices.Prometheus.Enabled = false

	pWith := &OpenAIProvider{conf: confWith}
	pWithout := &OpenAIProvider{conf: confWithout}

	withMetrics := pWith.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)
	withoutMetrics := pWithout.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)

	assert.Less(t, len(withoutMetrics), len(withMetrics))
}

func TestGetToolDefinitions_AppliesGlobalAndProviderToolFilters(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	conf := config.NewConfig()
	conf.ChatAI.Tools.Include = []string{"get_logs", "get_metrics"}
	conf.ChatAI.Providers = []config.ProviderConfig{
		{
			Name:  "test-openai",
			Tools: config.ToolFilterConfig{Exclude: []string{"get_metrics"}},
		},
	}

	p := &OpenAIProvider{conf: conf, providerName: "test-openai"}
	tools := p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)

	require.Len(t, tools, 1)
	require.NotNil(t, tools[0].OfFunction)
	assert.Equal(t, "get_logs", tools[0].OfFunction.Function.Name)
}

func TestTransformToolCallToToolsProcessor_InvalidJSON(t *testing.T) {
	provider := &OpenAIProvider{}

	_, _, err := provider.TransformToolCallToToolsProcessor([]openai.ChatCompletionMessageToolCallUnion{{
		ID:   "call-1",
		Type: "function",
		Function: openai.ChatCompletionMessageFunctionToolCallFunction{
			Name:      "get_logs",
			Arguments: "{not-json}",
		},
	}})

	require.Error(t, err)
	assert.Contains(t, err.Error(), `invalid arguments for tool "get_logs"`)
}
