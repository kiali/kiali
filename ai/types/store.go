package types

// AIStore defines the interface for storing AI conversations
type AIStore interface {
	Enabled() bool
	ReduceWithAI() bool
	ReduceThreshold() int
	GetConversation(sessionID string, conversationID string) (*Conversation, bool)
	SetConversation(sessionID string, conversationID string, conversation *Conversation) error
	GetConversationIDs(sessionID string) []string
	DeleteConversations(sessionID string, conversationIDs []string) error
}
