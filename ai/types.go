package ai

import "encoding/json"

type AIContext struct {
	PageDescription string          `json:"page_description"`
	PageState       json.RawMessage `json:"page_state"`
}

// AIRequest holds the user query and optional context.
type AIRequest struct {
	ConversationID string    `json:"conversation_id,omitempty"`
	Query          string    `json:"query"`
	Context        AIContext `json:"context,omitempty"`
}

// Citation represents a citation to a document.
type Citation struct {
	Link string `json:"link"`
	Title string `json:"title"`
	Body string `json:"body"`
}

// ActionKind represents the type of action.
type ActionKind string

const (
	ActionKindNavigation ActionKind = "navigation"
	ActionKindTool ActionKind = "tool"
)

// Action represents a button the user can click.
type Action struct {
	Title string `json:"title"`
	Kind ActionKind `json:"kind"`
	Payload string `json:"payload"`
}

// AIResponse represents the provider reply (shape aligns with frontend expectations).
type AIResponse struct {
	Actions    []Action `json:"actions,omitempty"`
	Answer     string   `json:"answer"`
	Citations  []Citation `json:"citations,omitempty"`
	Error      string    `json:"error,omitempty"`
}