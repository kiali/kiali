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
	u.TotalTokens = u.PromptTokens + u.CompletionTokens
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

// UsageMetric stores aggregated usage data for one session/provider/model tuple.
type UsageMetric struct {
	UserID           string    `json:"user_id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	RequestCount     int64     `json:"request_count"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	Since            time.Time `json:"since"`
	LastUpdated      time.Time `json:"last_updated"`
}
