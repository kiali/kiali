package types

// AIStore defines the interface for storing AI conversations
type AIStore interface {
	Enabled() bool
	ReduceWithAI() bool
	ReduceThreshold() int
	GenerateConversationID() string
	GetConversation(sessionID string, conversationID string) (*Conversation, bool)
	SetConversation(sessionID string, conversationID string, conversation *Conversation) error
	RecordUsage(sessionID string, provider string, model string, usage TokenUsage) error
	GetUsageMetrics(sessionID string) []UsageMetric
}
