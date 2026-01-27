package providers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestResolveProviderKey_ModelKeyTakesPrecedence(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.OpenAIProviderConfigDefault,
		Key:    "provider-key-value",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "model-key-value",
	}

	key, err := resolveProviderKey(conf, provider, model)
	require.NoError(t, err)

	// Verify model key was used, not provider key
	assert.Equal(t, "model-key-value", key,
		"Model key should take precedence over provider key")
}

func TestResolveProviderKey_FallbackToProviderKey(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.OpenAIProviderConfigDefault,
		Key:    "provider-key-value",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "", // Empty - should fall back to provider key
	}

	key, err := resolveProviderKey(conf, provider, model)
	require.NoError(t, err)

	// Verify provider key was used as fallback
	assert.Equal(t, "provider-key-value", key,
		"Should fall back to provider key when model key is empty")
}

func TestResolveProviderKey_BothKeysEmpty(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.OpenAIProviderConfigDefault,
		Key:    "",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "",
	}

	_, err := resolveProviderKey(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "requires a key")
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
