package providers

import (
	"context"
	"net/http"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
)

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	GetName() string
	InitializeConversation(ptr *types.Conversation, query string)
	ReduceConversation(ctx context.Context, ptr *types.Conversation, reduceThreshold int)
	GetToolDefinitions() interface{}
	LookupToolHandler(toolName string) (mcp.ToolDef, bool)
	TransformToolCallToToolsProcessor(toolCall any) ([]types.StreamToolCallData, []string, error)
	ConversationToProvider(conversation []types.ConversationMessage) interface{}
	ProviderToConversation(providerMessage interface{}) types.ConversationMessage
	SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore)
}
