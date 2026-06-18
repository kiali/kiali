package types

import (
	"encoding/json"
	"sync"
	"time"
)

// AIContext represents the context information for an AI request
type AIContext struct {
	PageDescription string          `json:"page_description"`
	PageState       json.RawMessage `json:"page_state"`
	PageURL         string          `json:"page_url"`
}

// ChatInteractionMode represents the interaction mode for the chat.
// "ask" is for standard Q&A; "troubleshoot" activates a troubleshooting-focused persona.
type ChatInteractionMode string

const (
	ChatInteractionModeAsk          ChatInteractionMode = "ask"
	ChatInteractionModeTroubleshoot ChatInteractionMode = "troubleshoot"
)

// AIRequest holds the user query and optional context.
type AIRequest struct {
	Context         AIContext           `json:"context,omitempty"`
	ConversationID  string              `json:"conversation_id,omitempty"`
	InteractionMode ChatInteractionMode `json:"interaction_mode,omitempty"`
	Query           string              `json:"query"`
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
