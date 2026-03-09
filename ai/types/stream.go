package types

import (
	"encoding/json"
	"io"
)

// StreamWriter is an io.Writer that can flush (e.g. for SSE incremental delivery).
type StreamWriter interface {
	io.Writer
	Flush()
}

// StreamEvent represents a single SSE event envelope: {"event": "<name>", "data": <payload>}.
type StreamEvent struct {
	Data  json.RawMessage `json:"data"`
	Event string          `json:"event"`
}

// StreamStartData is the payload for event "start".
type StreamStartData struct {
	ConversationID string `json:"conversation_id"`
}

// StreamToolCallData is the payload for event "tool_call".
type StreamToolCallData struct {
	Args map[string]any `json:"args"`
	ID   string         `json:"id"`
	Name string         `json:"name"`
	Type string         `json:"type"` // "tool_call"
}

// StreamToolResultData is the payload for event "tool_result".
type StreamToolResultData struct {
	Content string `json:"content"`
	ID      string `json:"id"`
	Round   int    `json:"round"`
	Status  string `json:"status"` // "success" or "error"
	Type    string `json:"type"`   // "tool_result"
}

// StreamTokenData is the payload for event "token".
type StreamTokenData struct {
	ID    int    `json:"id"`
	Token string `json:"token"`
}

// ReferencedDocument is an item in end.referenced_documents.
type ReferencedDocument struct {
	DocTitle string `json:"doc_title"`
	DocURL   string `json:"doc_url"`
}

// StreamEndData is the payload for event "end".
type StreamEndData struct {
	AvailableQuotas     map[string]any       `json:"available_quotas,omitempty"`
	InputTokens         int64                `json:"input_tokens"`
	OutputTokens        int64                `json:"output_tokens"`
	ReferencedDocuments []ReferencedDocument `json:"referenced_documents,omitempty"`
	Truncated           bool                 `json:"truncated"`
}
