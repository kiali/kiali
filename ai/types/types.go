package types

import (
	"encoding/json"
	"sync"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_citations"
)

// AIContext represents the context information for an AI request
type AIContext struct {
	PageDescription string          `json:"page_description"`
	PageState       json.RawMessage `json:"page_state"`
	PageURL         string          `json:"page_url"`
}

// AIRequest holds the user query and optional context.
type AIRequest struct {
	ConversationID string    `json:"conversation_id,omitempty"`
	Username       string    `json:"username,omitempty"`
	Query          string    `json:"query"`
	Context        AIContext `json:"context,omitempty"`
}

// AIResponse represents the provider reply (shape aligns with frontend expectations).
type AIResponse struct {
	Actions   []get_action_ui.Action   `json:"actions,omitempty"`
	Answer    string                   `json:"answer"`
	Citations []get_citations.Citation `json:"citations,omitempty"`
	Error     string                   `json:"error,omitempty"`
	Mu        sync.Mutex               `json:"-"`
}

// Conversation represents a stored conversation
type Conversation struct {
	Conversation []openai.ChatCompletionMessage // map key is conversationID
	LastAccessed time.Time                      // When last retrieved by user this conversation
	EstimatedMB  float64                        // Estimated memory usage in MB
	Mu           sync.RWMutex                   // Protects LastAccessed field
}
