package providers

import (
	"context"
	"net/http"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest)
	ReduceConversation(ctx context.Context, conversation []types.ConversationMessage, reduceThreshold int) []types.ConversationMessage
	GetToolDefinitions() interface{}
	TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string)
	ConversationToProvider(conversation []types.ConversationMessage) interface{}
	ProviderToConversation(providerMessage interface{}) types.ConversationMessage
	SendChat(r *http.Request,
		req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface,
		clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int)
}
