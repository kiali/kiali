package openai_provider

import (
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

func TestUsageFromChatCompletion(t *testing.T) {
	usage := usageFromChatCompletion(&openai.ChatCompletion{
		Usage: openai.CompletionUsage{
			PromptTokens:     21,
			CompletionTokens: 34,
			TotalTokens:      55,
		},
	})

	assert.Equal(t, int64(21), usage.PromptTokens)
	assert.Equal(t, int64(34), usage.CompletionTokens)
	assert.Equal(t, int64(55), usage.TotalTokens)
}
