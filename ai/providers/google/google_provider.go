package google_provider

import (
	"fmt"

	google "google.golang.org/genai"

	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/config"
)

// GoogleGenAIProvider implements AIProvider using google-go.
type GoogleAIProvider struct {
	client *google.Client
	config google.ClientConfig
	model  string
}

func NewGoogleAIProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (*GoogleAIProvider, error) {
	opts, err := getProviderOptions(conf, provider, model)
	if err != nil {
		return nil, fmt.Errorf("get provider config: %w", err)
	}
	return &GoogleAIProvider{client: nil, config: opts, model: model.Model}, nil
}

func getProviderOptions(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (google.ClientConfig, error) {
	resolvedKey, err := providers.ResolveProviderKey(conf, provider, model)
	if err != nil {
		return google.ClientConfig{}, err
	}

	// Defaults to BackendGeminiAPI if no baseURL is provided
	switch provider.Config {
	case config.ProviderConfigGemini:
		return google.ClientConfig{
			APIKey:  resolvedKey,
			Backend: google.BackendGeminiAPI,
		}, nil
	case config.DefaultProviderConfigType:
		return google.ClientConfig{
			APIKey:  resolvedKey,
			Backend: google.BackendGeminiAPI,
		}, nil
	default:
		return google.ClientConfig{}, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}
