package client

// LLMRequest is the body sent to POST /v1/query.
type LLMRequest struct {
	Query          string `json:"query"`
	ConversationID string `json:"conversation_id,omitempty"`
	Mode           string `json:"mode,omitempty"`
	MediaType      string `json:"media_type,omitempty"`
}

// QueryResponse is the response body from POST /v1/query.
type QueryResponse struct {
	ConversationID string `json:"conversation_id,omitempty"`
	Response       string `json:"response"`
}

// AuthorizationResponse is the response from POST /authorized.
type AuthorizationResponse struct {
	SkipUserIDCheck bool   `json:"skip_user_id_check"`
	UserID          string `json:"user_id"`
	Username        string `json:"username"`
}

// ReadinessResponse is the response from GET /readiness.
type ReadinessResponse struct {
	Reason string `json:"reason"`
	Ready  bool   `json:"ready"`
}

// LivenessResponse is the response from GET /liveness.
type LivenessResponse struct {
	Alive bool `json:"alive"`
}
