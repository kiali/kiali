package providers

import (
	"context"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
)

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest)
	ReduceConversation(ctx context.Context, conversation []types.ConversationMessage, reduceThreshold int) []types.ConversationMessage
	GetToolDefinitions() interface{}
	TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string)
	ConversationToProvider(conversation []types.ConversationMessage) interface{}
	ProviderToConversation(providerMessage interface{}) types.ConversationMessage
	SendChat(kialiInterface *mcputil.KialiInterface,
		req types.AIRequest, aiStore types.AIStore) (*types.AIResponse, int)
}
