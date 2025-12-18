package business

import (
	"context"
	"fmt"

	"github.com/kiali/kiali/business/ai"
	"github.com/kiali/kiali/business/ai/tools"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

type AiService struct {
	businessLayer *Layer
	conf          *config.Config
	grafana       *grafana.Service
	prom          prometheus.ClientInterface
	userClients   map[string]kubernetes.UserClientInterface
}

func NewAIService(businessLayer *Layer, conf *config.Config, prom prometheus.ClientInterface, grafana *grafana.Service, userClients map[string]kubernetes.UserClientInterface) AiService {
	return AiService{
		businessLayer: businessLayer,
		conf:          conf,
		grafana:       grafana,
		prom:          prom,
		userClients:   userClients,
	}
}
// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	SendChat(ctx context.Context, req ai.AIRequest, toolHandlers []tools.ToolHandler) (*ai.AIResponse, error)
}

// NewAIProvider builds the AI provider configured for the given model name.
func NewAIProvider(conf *config.Config, modelName string) (AIProvider, error) {
	if conf == nil || !conf.ChatAI.Enabled {
		return nil, fmt.Errorf("chat AI is disabled")
	}

	var selected *config.AIModel
	for i := range conf.ChatAI.Models {
		if conf.ChatAI.Models[i].Name == modelName {
			selected = &conf.ChatAI.Models[i]
			break
		}
	}
	if selected == nil {
		return nil, fmt.Errorf("model %q not found", modelName)
	}

	return ai.NewOpenAIProvider(selected), nil
}
