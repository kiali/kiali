package types

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
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

type ReferencedDocument struct {
	DocTitle string `json:"doc_title"`
	DocURL   string `json:"doc_url"`
}

type AIResponse struct {
	AvailableQuotas     map[string]int         `json:"available_quotas"`
	ConversationID      string                 `json:"conversation_id"`
	InputTokens         int                    `json:"input_tokens"`
	OutputTokens        int                    `json:"output_tokens"`
	ReferencedDocuments []ReferencedDocument   `json:"referenced_documents"`
	Actions             []get_action_ui.Action `json:"actions,omitempty"`
	Response            string                 `json:"response"`
	ToolCalls           []any                  `json:"tool_calls"`
	ToolResults         []any                  `json:"tool_results"`
	Truncated           bool                   `json:"truncated"`
	Error               string                 `json:"error,omitempty"`
}

// ConversationMessage represents a stored message in a conversation.
type ConversationMessage struct {
	Content string
	Name    string
	Param   interface{}
	Role    string
}

// Conversation represents a stored conversation
type Conversation struct {
	Conversation []ConversationMessage // map key is conversationID
	LastAccessed time.Time             // When last retrieved by user this conversation
	EstimatedMB  float64               // Estimated memory usage in MB
	Mu           sync.RWMutex          // Protects LastAccessed field
}
