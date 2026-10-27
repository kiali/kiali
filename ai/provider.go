package ai

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers"
	anthropicProvider "github.com/kiali/kiali/ai/providers/anthropic"
	googleProvider "github.com/kiali/kiali/ai/providers/google"
	lightspeedProvider "github.com/kiali/kiali/ai/providers/lightspeed"
	openaiProvider "github.com/kiali/kiali/ai/providers/openai"
	aiTypes "github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
)

// NewAIProvider builds the AI provider configured for the given model name.
func NewAIProvider(conf *config.Config, providerName string, modelName string) (providers.AIProvider, error) {
	if err := mcp.LoadTools(); err != nil {
		return nil, err
	}
	provider, err := getProvider(conf, providerName)
	if err != nil {
		return nil, err
	}
	return newAIProvider(conf, provider, modelName)
}

// NewAIProviderFromConfig builds an AI provider from an explicit provider config.
// Troubleshooting chat uses this so it talks to ai.troubleshooting.ai_support.provider
// instead of a provider selected from the chat list.
func NewAIProviderFromConfig(conf *config.Config, provider *config.ProviderConfig, modelName string) (providers.AIProvider, error) {
	if err := mcp.LoadTools(); err != nil {
		return nil, err
	}
	if provider == nil || !provider.Enabled || strings.TrimSpace(provider.Name) == "" {
		return nil, fmt.Errorf("provider %q not found or disabled", providerName(provider))
	}
	return newAIProvider(conf, provider, modelName)
}

func newAIProvider(conf *config.Config, provider *config.ProviderConfig, modelName string) (providers.AIProvider, error) {
	model, err := getModel(*provider, modelName)
	if err != nil {
		return nil, err
	}
	switch provider.Type {
	case config.OpenAIProvider:
		return openaiProvider.NewOpenAIProvider(conf, provider, model)
	case config.AnthropicProvider:
		return anthropicProvider.NewAnthropicProvider(conf, provider, model)
	case config.GoogleProvider:
		return googleProvider.NewGoogleAIProvider(conf, provider, model)
	case config.LightSpeedProvider:
		return lightspeedProvider.NewLightSpeedProvider(conf, provider, model)
	default:
		return nil, fmt.Errorf("unsupported provider type %q", provider.Type)
	}
}

func ResolveUsageMetadata(conf *config.Config, providerName string, modelName string) (*aiTypes.UsageMetric, error) {
	provider, err := getProvider(conf, providerName)
	if err != nil {
		return nil, err
	}
	return resolveUsageMetadata(provider, modelName)
}

func ResolveUsageMetadataFromConfig(provider *config.ProviderConfig, modelName string) (*aiTypes.UsageMetric, error) {
	if provider == nil || !provider.Enabled {
		return nil, fmt.Errorf("provider %q not found or disabled", providerName(provider))
	}
	return resolveUsageMetadata(provider, modelName)
}

func resolveUsageMetadata(provider *config.ProviderConfig, modelName string) (*aiTypes.UsageMetric, error) {
	model, err := getModel(*provider, modelName)
	if err != nil {
		return nil, err
	}

	return &aiTypes.UsageMetric{
		Provider: string(provider.Type),
		Model:    model.Model,
	}, nil
}

func providerName(provider *config.ProviderConfig) string {
	if provider == nil {
		return ""
	}
	return strings.TrimSpace(provider.Name)
}

func getProvider(conf *config.Config, providerName string) (*config.ProviderConfig, error) {
	for i := range conf.AI.ChatAI.Providers {
		if conf.AI.ChatAI.Providers[i].Name == providerName && conf.AI.ChatAI.Providers[i].Enabled {
			return &conf.AI.ChatAI.Providers[i], nil
		}
	}
	return nil, fmt.Errorf("provider %q not found or disabled", providerName)
}

func getModel(provider config.ProviderConfig, modelName string) (*config.AIModel, error) {
	for i := range provider.Models {
		if provider.Models[i].Name == modelName && provider.Models[i].Enabled {
			return &provider.Models[i], nil
		}
	}
	return nil, fmt.Errorf("model %q not found or disabled", modelName)
}
