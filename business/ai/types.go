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

// AIResponse represents the provider reply (shape aligns with frontend expectations).
type AIResponse struct {
	Answer     string   `json:"answer"`
	// TODO: Add citations and used models
	//Citations  []string `json:"citations,omitempty"`
	//UsedModels []string `json:"used_models,omitempty"`
	//Truncated  bool     `json:"truncated,omitempty"`
}