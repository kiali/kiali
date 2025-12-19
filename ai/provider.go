package ai

import (
	"context"
	"fmt"
	
	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/istio"
)

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	SendChat(ctx context.Context, req AIRequest, toolHandlers []mcp.ToolHandler, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*AIResponse, int)
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

	return NewOpenAIProvider(selected), nil
}
