package ai

import (
	"fmt"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers"
	googleProvider "github.com/kiali/kiali/ai/providers/google"
	lightspeedProvider "github.com/kiali/kiali/ai/providers/lightspeed"
	openaiProvider "github.com/kiali/kiali/ai/providers/openai"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// NewAIProvider builds the AI provider configured for the given model name.
func NewAIProvider(conf *config.Config, providerName string, modelName string) (providers.AIProvider, error) {
	if len(mcp.DefaultToolHandlers) == 0 {
		log.Infof("[AI]Loading tools...")
		if err := mcp.LoadTools(); err != nil {
			return nil, err
		}
	}
	provider, err := getProvider(conf, providerName)
	if err != nil {
		return nil, err
	}
	model, err := getModel(*provider, modelName)
	if err != nil {
		return nil, err
	}
	switch provider.Type {
	case config.OpenAIProvider:
		return openaiProvider.NewOpenAIProvider(conf, provider, model)
	case config.GoogleProvider:
		return googleProvider.NewGoogleAIProvider(conf, provider, model)
	case config.LightSpeedProvider:
		return lightspeedProvider.NewLightSpeedProvider(conf, provider, model)
	default:
		return nil, fmt.Errorf("unsupported provider type %q", provider.Type)
	}
}

func getProvider(conf *config.Config, providerName string) (*config.ProviderConfig, error) {
	for i := range conf.ChatAI.Providers {
		if conf.ChatAI.Providers[i].Name == providerName && conf.ChatAI.Providers[i].Enabled {
			return &conf.ChatAI.Providers[i], nil
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
