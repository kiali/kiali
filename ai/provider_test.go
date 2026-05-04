package ai

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func newTestConfig(providers []config.ProviderConfig) *config.Config {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.ChatAI.Providers = providers
	return conf
}

func TestGetProvider_Found(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{Name: "openai-prod", Type: config.OpenAIProvider, Enabled: true},
		{Name: "google-prod", Type: config.GoogleProvider, Enabled: true},
	})

	p, err := getProvider(conf, "openai-prod")
	require.NoError(t, err)
	assert.Equal(t, "openai-prod", p.Name)
	assert.Equal(t, config.OpenAIProvider, p.Type)

	p, err = getProvider(conf, "google-prod")
	require.NoError(t, err)
	assert.Equal(t, "google-prod", p.Name)
}

func TestGetProvider_NotFound(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{Name: "openai-prod", Type: config.OpenAIProvider, Enabled: true},
	})

	_, err := getProvider(conf, "nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestGetProvider_DisabledIsRejected(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{Name: "openai-disabled", Type: config.OpenAIProvider, Enabled: false},
	})

	_, err := getProvider(conf, "openai-disabled")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestGetProvider_NoProviders(t *testing.T) {
	conf := newTestConfig(nil)

	_, err := getProvider(conf, "any")
	require.Error(t, err)
}

func TestGetModel_Found(t *testing.T) {
	provider := config.ProviderConfig{
		Name: "test-provider",
		Models: []config.AIModel{
			{Name: "gpt-4", Model: "gpt-4", Enabled: true},
			{Name: "gpt-3.5", Model: "gpt-3.5-turbo", Enabled: true},
		},
	}

	m, err := getModel(provider, "gpt-4")
	require.NoError(t, err)
	assert.Equal(t, "gpt-4", m.Name)

	m, err = getModel(provider, "gpt-3.5")
	require.NoError(t, err)
	assert.Equal(t, "gpt-3.5", m.Name)
}

func TestGetModel_NotFound(t *testing.T) {
	provider := config.ProviderConfig{
		Name: "test-provider",
		Models: []config.AIModel{
			{Name: "gpt-4", Model: "gpt-4", Enabled: true},
		},
	}

	_, err := getModel(provider, "nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestGetModel_DisabledIsRejected(t *testing.T) {
	provider := config.ProviderConfig{
		Name: "test-provider",
		Models: []config.AIModel{
			{Name: "gpt-4", Model: "gpt-4", Enabled: false},
		},
	}

	_, err := getModel(provider, "gpt-4")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestGetModel_NoModels(t *testing.T) {
	provider := config.ProviderConfig{Name: "empty-provider"}

	_, err := getModel(provider, "any")
	require.Error(t, err)
}

func TestNewAIProvider_UnsupportedProviderType(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{
			Name:    "custom-provider",
			Type:    config.ProviderType("unsupported"),
			Enabled: true,
			Models: []config.AIModel{
				{Name: "model-1", Model: "model-1", Enabled: true, Key: "test-key"},
			},
			Key: "test-key",
		},
	})

	_, err := NewAIProvider(conf, "custom-provider", "model-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported provider type")
}

func TestNewAIProvider_ProviderNotFound(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{Name: "existing", Type: config.OpenAIProvider, Enabled: true},
	})

	_, err := NewAIProvider(conf, "nonexistent", "any-model")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestNewAIProvider_ModelNotFound(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{
			Name:    "openai-prod",
			Type:    config.OpenAIProvider,
			Enabled: true,
			Models: []config.AIModel{
				{Name: "gpt-4", Model: "gpt-4", Enabled: true},
			},
		},
	})

	_, err := NewAIProvider(conf, "openai-prod", "nonexistent-model")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or disabled")
}

func TestGetProvider_SelectsCorrectAmongMultiple(t *testing.T) {
	conf := newTestConfig([]config.ProviderConfig{
		{Name: "provider-a", Type: config.OpenAIProvider, Enabled: true},
		{Name: "provider-b", Type: config.GoogleProvider, Enabled: true},
		{Name: "provider-c", Type: config.OpenAIProvider, Enabled: false},
	})

	p, err := getProvider(conf, "provider-b")
	require.NoError(t, err)
	assert.Equal(t, config.GoogleProvider, p.Type)

	_, err = getProvider(conf, "provider-c")
	require.Error(t, err, "disabled provider should not be selectable")
}

func TestGetModel_SelectsCorrectAmongMultiple(t *testing.T) {
	provider := config.ProviderConfig{
		Name: "test",
		Models: []config.AIModel{
			{Name: "model-a", Model: "a", Enabled: true},
			{Name: "model-b", Model: "b", Enabled: false},
			{Name: "model-c", Model: "c", Enabled: true},
		},
	}

	m, err := getModel(provider, "model-c")
	require.NoError(t, err)
	assert.Equal(t, "c", m.Model)

	_, err = getModel(provider, "model-b")
	require.Error(t, err, "disabled model should not be selectable")
}
