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

func getProviderConfig(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (openai.ClientConfig, error) {
	if conf == nil {
		return openai.ClientConfig{}, fmt.Errorf("config is required to resolve chat_ai credentials")
	}

	key := model.Key
	if key == "" {
		key = provider.Key
	}
	if key == "" {
		return openai.ClientConfig{}, fmt.Errorf("chat_ai provider %q model %q requires a key", provider.Name, model.Name)
	}

	resolvedKey, err := conf.GetCredential(key)
	if err != nil {
		return openai.ClientConfig{}, fmt.Errorf("failed to resolve chat_ai key for provider %q model %q: %w", provider.Name, model.Name, err)
	}

	baseURL := model.Endpoint
	switch provider.Config {
	case config.OpenAIProviderConfigGemini:
		config := openai.DefaultConfig(resolvedKey)
		if baseURL == "" {
			baseURL = string(OpenGemini)
		}
		config.BaseURL = baseURL
		return config, nil
	case config.OpenAIProviderConfigDefault:
		config := openai.DefaultConfig(resolvedKey)
		if baseURL != "" {
			config.BaseURL = baseURL
		}
		return config, nil
	case config.OpenAIProviderConfigAzure:
		if model.Endpoint == "" {
			return openai.ClientConfig{}, fmt.Errorf("endpoint is required for azure provider")
		}
		return openai.DefaultAzureConfig(resolvedKey, model.Endpoint), nil
	default:
		return openai.ClientConfig{}, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}
