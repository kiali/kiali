package providers

import (
	"fmt"

	"github.com/openai/openai-go/v3/azure"
	"github.com/openai/openai-go/v3/option"

	"github.com/kiali/kiali/config"
)

type BaseURL string

const (
	OpenGemini BaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
)

const azureAPIVersion = "2024-06-01"

func resolveProviderKey(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (string, error) {
	if conf == nil {
		return "", fmt.Errorf("config is required to resolve chat_ai credentials")
	}

	key := model.Key
	if key == "" {
		key = provider.Key
	}
	if key == "" {
		return "", fmt.Errorf("chat_ai provider %q model %q requires a key", provider.Name, model.Name)
	}

	resolvedKey, err := conf.GetCredential(key)
	if err != nil {
		return "", fmt.Errorf("failed to resolve chat_ai key for provider %q model %q: %w", provider.Name, model.Name, err)
	}
	return resolvedKey, nil
}

func GetProviderOptions(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) ([]option.RequestOption, error) {
	resolvedKey, err := resolveProviderKey(conf, provider, model)
	if err != nil {
		return nil, err
	}

	baseURL := model.Endpoint
	switch provider.Config {
	case config.OpenAIProviderConfigGemini:
		if baseURL == "" {
			baseURL = string(OpenGemini)
		}
		return []option.RequestOption{
			option.WithAPIKey(resolvedKey),
			option.WithBaseURL(baseURL),
		}, nil
	case config.OpenAIProviderConfigDefault:
		opts := []option.RequestOption{
			option.WithAPIKey(resolvedKey),
		}
		if baseURL != "" {
			opts = append(opts, option.WithBaseURL(baseURL))
		}
		return opts, nil
	case config.OpenAIProviderConfigAzure:
		if model.Endpoint == "" {
			return nil, fmt.Errorf("endpoint is required for azure provider")
		}
		return []option.RequestOption{
			azure.WithEndpoint(model.Endpoint, azureAPIVersion),
			azure.WithAPIKey(resolvedKey),
		}, nil
	default:
		return nil, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}
