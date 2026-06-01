package types

// AIStore defines the interface for storing AI conversations
type AIStore interface {
	DeleteConversations(sessionID string, conversationIDs []string) error
	Enabled() bool
	GenerateConversationID() string
	GetConversation(sessionID string, conversationID string) (*Conversation, bool)
	GetUsageMetrics(sessionID string) []UsageMetric
	RecordUsage(sessionID string, provider string, model string, usage TokenUsage) error
	ReduceThreshold() int
	ReduceWithAI() bool
	SetConversation(sessionID string, conversationID string, conversation *Conversation) error
}
