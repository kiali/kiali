package providers

import (
	"fmt"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/config"
)

type BaseURL string

const (
	OpenAIBaseURL BaseURL = "https://api.openai.com/v1"
	OpenGemini    BaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
)

func getProviderConfig(provider *config.ProviderConfig, model *config.AIModel) (openai.ClientConfig, error) {
	key := model.Key
	if key == "" {
		key = provider.Key
	}
	baseURL := model.Endpoint
	switch provider.Config {
	case config.OpenAIProviderConfigGemini:
		config := openai.DefaultConfig(key)
		if baseURL == "" {
			baseURL = string(OpenGemini)
		}
		config.BaseURL = baseURL
		return config, nil
	case config.OpenAIProviderConfigDefault:
		config := openai.DefaultConfig(key)
		if baseURL != "" {
			config.BaseURL = baseURL
		}
		return config, nil
	case config.OpenAIProviderConfigAzure:
		if model.Endpoint == "" {
			return openai.ClientConfig{}, fmt.Errorf("endpoint is required for azure provider")
		}
		return openai.DefaultAzureConfig(key, model.Endpoint), nil
	default:
		return openai.ClientConfig{}, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}
