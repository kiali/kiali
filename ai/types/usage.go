package types

import "time"

// TokenUsage captures prompt/completion token counts for a single chat request.
type TokenUsage struct {
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
}

func (u TokenUsage) HasTokens() bool {
	return u.PromptTokens > 0 || u.CompletionTokens > 0 || u.TotalTokens > 0
}

func (u *TokenUsage) Add(other TokenUsage) {
	if u == nil || !other.HasTokens() {
		return
	}
	u.PromptTokens += other.PromptTokens
	u.CompletionTokens += other.CompletionTokens
	u.TotalTokens += other.TotalTokens
	if u.TotalTokens == 0 {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
}

func NewTokenUsage(promptTokens, completionTokens, totalTokens int64) TokenUsage {
	if totalTokens == 0 {
		totalTokens = promptTokens + completionTokens
	}
	return TokenUsage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      totalTokens,
	}
}

// UsageMetric stores aggregated usage data for one session, request type, provider, and model.
type UsageMetric struct {
	CompletionTokens int64     `json:"completion_tokens"`
	LastUpdated      time.Time `json:"last_updated"`
	Model            string    `json:"model"`
	PromptTokens     int64     `json:"prompt_tokens"`
	Provider         string    `json:"provider"`
	Request          string    `json:"request"`
	RequestCount     int64     `json:"request_count"`
	Since            time.Time `json:"since"`
	TotalTokens      int64     `json:"total_tokens"`
	UserID           string    `json:"user_id"`
}
