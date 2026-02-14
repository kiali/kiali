package client

// Types for OpenShift LightSpeed API (OpenAPI 1.0.9).
// Struct fields are ordered alphabetically per project style.

// Attachment represents an attachment sent with a query.
type Attachment struct {
	AttachmentType string `json:"attachment_type"`
	Content        string `json:"content"`
	ContentType    string `json:"content_type"`
}

// AuthorizationResponse is the response from POST /authorized.
type AuthorizationResponse struct {
	SkipUserIDCheck bool   `json:"skip_user_id_check"`
	UserID          string `json:"user_id"`
	Username        string `json:"username"`
}

// ConversationData is a single conversation in a list response.
type ConversationData struct {
	ConversationID       string  `json:"conversation_id"`
	LastMessageTimestamp float64 `json:"last_message_timestamp"`
	MessageCount         int     `json:"message_count,omitempty"`
	TopicSummary         string  `json:"topic_summary,omitempty"`
}

// ConversationDeleteResponse is the response from DELETE /v1/conversations/{id}.
type ConversationDeleteResponse struct {
	ConversationID string `json:"conversation_id"`
	Response       string `json:"response"`
	Success        bool   `json:"success"`
}

// ConversationDetailResponse is the response from GET /v1/conversations/{id}.
type ConversationDetailResponse struct {
	ChatHistory    []map[string]any `json:"chat_history"`
	ConversationID string           `json:"conversation_id"`
}

// ConversationUpdateRequest is the body for PUT /v1/conversations/{id}.
type ConversationUpdateRequest struct {
	TopicSummary string `json:"topic_summary"`
}

// ConversationUpdateResponse is the response from PUT /v1/conversations/{id}.
type ConversationUpdateResponse struct {
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message"`
	Success        bool   `json:"success"`
}

// ConversationsListResponse is the response from GET /v1/conversations.
type ConversationsListResponse struct {
	Conversations []ConversationData `json:"conversations"`
}

// ErrorResponse is a generic error response (detail is a map or string).
type ErrorResponse struct {
	Detail map[string]string `json:"detail"`
}

// FeedbackRequest is the body for POST /v1/feedback.
type FeedbackRequest struct {
	ConversationID string  `json:"conversation_id"`
	LLMResponse    string  `json:"llm_response"`
	Sentiment      *int    `json:"sentiment,omitempty"`
	UserFeedback   *string `json:"user_feedback,omitempty"`
	UserQuestion   string  `json:"user_question"`
}

// FeedbackResponse is the response from POST /v1/feedback.
type FeedbackResponse struct {
	Response string `json:"response"`
}

// ForbiddenResponse is returned when the client lacks permission.
type ForbiddenResponse struct {
	Detail string `json:"detail"`
}

// LivenessResponse is the response from GET /liveness.
type LivenessResponse struct {
	Alive bool `json:"alive"`
}

// LLMRequest is the body for POST /v1/query and POST /v1/streaming_query.
type LLMRequest struct {
	Attachments    []Attachment                 `json:"attachments,omitempty"`
	ConversationID *string                      `json:"conversation_id,omitempty"`
	MediaType      string                       `json:"media_type,omitempty"` // default "text/plain"
	MCPHeaders     map[string]map[string]string `json:"mcp_headers,omitempty"`
	Model          *string                      `json:"model,omitempty"`
	Provider       *string                      `json:"provider,omitempty"`
	Query          string                       `json:"query"`
	SystemPrompt   *string                      `json:"system_prompt,omitempty"`
}

// ReferencedDocument is a RAG-referenced document in an LLM response.
type ReferencedDocument struct {
	DocTitle string `json:"doc_title"`
	DocURL   string `json:"doc_url"`
}

// LLMResponse is the response from POST /v1/query.
type LLMResponse struct {
	AvailableQuotas     map[string]int       `json:"available_quotas"`
	ConversationID      string               `json:"conversation_id"`
	InputTokens         int                  `json:"input_tokens"`
	OutputTokens        int                  `json:"output_tokens"`
	ReferencedDocuments []ReferencedDocument `json:"referenced_documents"`
	Response            string               `json:"response"`
	ToolCalls           []any                `json:"tool_calls"`
	ToolResults         []any                `json:"tool_results"`
	Truncated           bool                 `json:"truncated"`
}

// MCPServerHeaderInfo describes headers required for an MCP server.
type MCPServerHeaderInfo struct {
	RequiredHeaders []string `json:"required_headers"`
	ServerName      string   `json:"server_name"`
}

// MCPHeadersResponse is the response from GET /v1/mcp/client-auth-headers.
type MCPHeadersResponse struct {
	Servers []MCPServerHeaderInfo `json:"servers"`
}

// NotAvailableResponse is returned when GET /readiness indicates not ready.
type NotAvailableResponse struct {
	Detail map[string]string `json:"detail"`
}

// ReadinessResponse is the response from GET /readiness.
type ReadinessResponse struct {
	Reason string `json:"reason"`
	Ready  bool   `json:"ready"`
}

// StatusResponse is the response from GET /v1/feedback/status.
type StatusResponse struct {
	Functionality string         `json:"functionality"`
	Status        map[string]any `json:"status"`
}

// UnauthorizedResponse is returned when credentials are missing or invalid.
type UnauthorizedResponse struct {
	Detail string `json:"detail"`
}
