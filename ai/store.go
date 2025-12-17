package ai

import (
	"context"
	"maps"
	"slices"
	"sort"
	"sync"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// AIChatConversation represents a user's cached conversation with metadata
type AIChatConversation struct {
	Conversation map[string]*types.Conversation // map key is conversationID
	LastAccessed time.Time                      // When last retrieved by user this session
	mu           sync.RWMutex                   // Protects LastAccessed field
}

type AiStoreConfig struct {
	Enabled           bool
	InactivityTimeout time.Duration // How long to keep inactive conversations
	MaxCacheMemoryMB  int           // Maximum memory for all conversations
	ReduceWithAI      bool          // Reduce conversations with AI if memory limit is reached
	ReduceThreshold   int           // Threshold for reducing conversations
}

type AIStoreImpl struct {
	config        *AiStoreConfig
	ctx           context.Context
	mu            sync.RWMutex
	conversations map[string]*AIChatConversation // map key is sessionID
	cleanupJob    *CleanupJob
}

// NewAIStore creates a new AI store instance
func NewAIStore(ctx context.Context, config *AiStoreConfig) types.AIStore {
	if config == nil {
		// Default configuration
		config = &AiStoreConfig{
			Enabled:           true,
			InactivityTimeout: 60 * time.Minute,
			MaxCacheMemoryMB:  1024,
			ReduceWithAI:      false,
			ReduceThreshold:   15,
		}
	}
	self := &AIStoreImpl{
		config:        config,
		ctx:           ctx,
		conversations: make(map[string]*AIChatConversation),
	}
	self.cleanupJob = NewCleanupJob(ctx, self, config.InactivityTimeout/4)
	if config.Enabled {
		self.cleanupJob.Start()
	}
	return self
}

// ReduceWithAI returns true if AI should be used to reduce conversations
func (s *AIStoreImpl) ReduceWithAI() bool {
	return s.config.ReduceWithAI
}

// ReduceThreshold returns the threshold for reducing conversations
func (s *AIStoreImpl) ReduceThreshold() int {
	return s.config.ReduceThreshold
}

// Enabled returns true if graph caching is enabled
func (s *AIStoreImpl) Enabled() bool {
	return s.config.Enabled
}

// GetConversation retrieves a conversation by sessionID
func (s *AIStoreImpl) GetConversation(sessionID string, conversationID string) (*types.Conversation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessionConversation, found := s.conversations[sessionID]
	if !found {
		return nil, false
	}
	sessionConversation.mu.RLock()
	defer sessionConversation.mu.RUnlock()
	sessionConversation.LastAccessed = time.Now()
	conversation, found := sessionConversation.Conversation[conversationID]
	if !found {
		return nil, false
	}
	conversation.Mu.Lock()
	conversation.LastAccessed = time.Now()
	conversation.Mu.Unlock()
	return conversation, true
}

// SetConversation stores a conversation by sessionID
func (s *AIStoreImpl) SetConversation(sessionID string, conversationID string, conversation *types.Conversation) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	conversation.EstimatedMB = EstimateConversationMemory(conversation.Conversation)
	// Check memory limits before adding
	if err := s.checkMemoryLimits(sessionID, conversationID, conversation); err != nil {
		return err
	}
	conversation.LastAccessed = time.Now()
	if _, exists := s.conversations[sessionID]; !exists {
		s.conversations[sessionID] = &AIChatConversation{
			Conversation: make(map[string]*types.Conversation),
			LastAccessed: time.Now(),
			mu:           sync.RWMutex{},
		}
	} else {
		s.conversations[sessionID].mu.Lock()
		defer s.conversations[sessionID].mu.Unlock()
		s.conversations[sessionID].LastAccessed = time.Now()
	}
	s.conversations[sessionID].Conversation[conversationID] = conversation
	return nil
}

// checkMemoryLimits ensures we don't exceed memory limits
// Must be called with write lock held
func (s *AIStoreImpl) checkMemoryLimits(sessionID string, conversationID string, newConversation *types.Conversation) error {
	// Calculate current memory usage
	currentMemory := s.totalMemoryMBLocked()

	// Subtract old conversation memory if replacing
	if sessionConversation, exists := s.conversations[sessionID]; exists {
		sessionConversation.mu.Lock()
		defer sessionConversation.mu.Unlock()
		if conversation, exists := sessionConversation.Conversation[conversationID]; exists {
			sessionConversation.Conversation[conversationID].Mu.Lock()
			defer sessionConversation.Conversation[conversationID].Mu.Unlock()
			currentMemory -= conversation.EstimatedMB
		}
	}

	// Calculate projected memory
	projectedMemory := currentMemory + newConversation.EstimatedMB

	// If over limit, evict LRU sessions until under limit
	if projectedMemory > float64(s.config.MaxCacheMemoryMB) {
		log.Debugf("Approaching AI store memory limit: %.2f MB / %d MB", projectedMemory, s.config.MaxCacheMemoryMB)

		excessMB := projectedMemory - float64(s.config.MaxCacheMemoryMB)
		s.evictLRUConversations(excessMB)
	}

	return nil
}

func (s *AIStoreImpl) evictLRUConversations(targetMB float64) {
	// Create list of sessions sorted by last accessed time (oldest first)
	type sessionConversationEntry struct {
		lastAccessed   time.Time
		memoryMB       float64
		sessionID      string
		conversationID string
	}

	var sessions []sessionConversationEntry
	for sessionID, sessionConversation := range s.conversations {
		sessionConversation.mu.RLock()
		for conversationID, conversation := range sessionConversation.Conversation {
			conversation.Mu.RLock()
			lastAccessed := conversation.LastAccessed
			memoryMB := conversation.EstimatedMB
			conversation.Mu.RUnlock()
			sessions = append(sessions, sessionConversationEntry{
				lastAccessed:   lastAccessed,
				memoryMB:       memoryMB,
				sessionID:      sessionID,
				conversationID: conversationID,
			})
		}
		sessionConversation.mu.RUnlock()
	}

	// Sort by last accessed (oldest first)
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].lastAccessed.Before(sessions[j].lastAccessed)
	})

	// Evict oldest sessions until target memory is freed
	var freedMB float64
	evictedCount := 0
	for _, session := range sessions {
		if freedMB >= targetMB {
			break
		}

		log.Debugf("Evicting AI store conversation [%s] in session [%s] due to memory limit (last accessed: %v ago, %.2f MB)",
			session.conversationID,
			session.sessionID,
			time.Since(session.lastAccessed).Round(time.Second),
			session.memoryMB)

		delete(s.conversations[session.sessionID].Conversation, session.conversationID)
		freedMB += session.memoryMB
		evictedCount++
	}

	log.Debugf("Freed %.2f MB by evicting %d AI store conversations", freedMB, evictedCount)

}

// totalMemoryMBLocked returns total memory usage (must be called with lock held)
func (s *AIStoreImpl) totalMemoryMBLocked() float64 {
	var totalMB float64
	for _, sessionConversations := range s.conversations {
		for _, conversation := range sessionConversations.Conversation {
			totalMB += conversation.EstimatedMB
		}
	}
	return totalMB
}

// GetSessionIDs returns the list of session IDs
func (s *AIStoreImpl) GetConversationIDs(sessionID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessionConversation, exists := s.conversations[sessionID]
	if !exists {
		log.Debugf("Returned empty list for session [%s]: no session found", sessionID)
		return []string{}
	}
	sessionConversation.mu.RLock()
	defer sessionConversation.mu.RUnlock()
	return slices.Collect(maps.Keys(sessionConversation.Conversation))
}

// DeleteConversation deletes a conversation by sessionID and conversationID
func (s *AIStoreImpl) DeleteConversations(sessionID string, conversationIDs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sessionConversation, exists := s.conversations[sessionID]
	if !exists {
		log.Debugf("No session found for sessionID [%s]", sessionID)
		return nil
	}
	sessionConversation.mu.Lock()
	defer sessionConversation.mu.Unlock()

	for _, conversationID := range conversationIDs {
		if _, exists := sessionConversation.Conversation[conversationID]; exists {
			delete(sessionConversation.Conversation, conversationID)
			log.Debugf("Deleted conversation [%s] for session [%s]", conversationID, sessionID)
		} else {
			log.Debugf("Conversation [%s] not found for session [%s]", conversationID, sessionID)
		}
	}
	return nil
}

// LoadAIStoreConfig loads AI store configuration from Kiali config
func LoadAIStoreConfig(cfg *config.Config) *AiStoreConfig { // Parse duration strings from config
	inactivityTimeout, err := time.ParseDuration(cfg.ChatAI.StoreConfig.InactivityTimeout)
	if err != nil {
		log.Warningf("Invalid chat_ai.store_config.inactivity_timeout '%s', using default 60m", cfg.ChatAI.StoreConfig.InactivityTimeout)
		inactivityTimeout = 10 * time.Minute
	}

	maxMemory := cfg.ChatAI.StoreConfig.MaxCacheMemoryMB
	if maxMemory <= 0 {
		log.Warningf("Invalid chat_ai.store_config.max_cache_memory_mb %d, using default 1024", maxMemory)
		maxMemory = 1024
	}

	return &AiStoreConfig{
		Enabled:           cfg.ChatAI.StoreConfig.Enabled,
		InactivityTimeout: inactivityTimeout,
		MaxCacheMemoryMB:  maxMemory,
		ReduceWithAI:      cfg.ChatAI.StoreConfig.ReduceWithAI,
		ReduceThreshold:   cfg.ChatAI.StoreConfig.ReduceThreshold,
	}
}

func EstimateConversationMemory(conversation []openai.ChatCompletionMessage) float64 {
	estimatedMB := 0.0
	for _, message := range conversation {
		estimatedMB += EstimateMessageMemory(message)
	}
	return estimatedMB
}

func EstimateMessageMemory(message openai.ChatCompletionMessage) float64 {
	return float64(len(message.Content)) / 1024 / 1024
}
