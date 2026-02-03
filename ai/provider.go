package ai

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/ai/mcp"
	openaiProvider "github.com/kiali/kiali/ai/providers/openai"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	GetToolDefinitions() interface{}
	TransformToolCallToToolsProcessor(toolCall any) []mcp.ToolsProcessor
	SendChat(r *http.Request,
		req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface,
		clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int)
}

// NewAIProvider builds the AI provider configured for the given model name.
func NewAIProvider(conf *config.Config, providerName string, modelName string) (AIProvider, error) {
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
