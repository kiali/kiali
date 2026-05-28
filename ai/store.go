package ai

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// AIChatConversation represents a user's cached conversation with metadata
type AIChatConversation struct {
	Conversation map[string]*types.Conversation // map key is conversationID
	UsageMetrics map[string]*types.UsageMetric  // map key is provider|model
	LastAccessed time.Time                      // When last retrieved by user this session
	mu           sync.RWMutex                   // Protects LastAccessed field
}

type AiStoreConfig struct {
	Enabled           bool
	InactivityTimeout time.Duration
	MaxCacheMemoryMB  int  // Maximum memory for all conversations
	ReduceWithAI      bool // Reduce conversations with AI if memory limit is reached
	ReduceThreshold   int  // Threshold for reducing conversations
}

type AIStoreImpl struct {
	config        *AiStoreConfig
	ctx           context.Context
	mu            sync.RWMutex
	conversations map[string]*AIChatConversation // map key is sessionID
}

// NewAIStore creates a new AI store instance
func NewAIStore(ctx context.Context, config *AiStoreConfig) types.AIStore {
	if ctx == nil {
		ctx = context.Background()
	}
	if config == nil {
		// Default configuration
		config = &AiStoreConfig{
			Enabled:           true,
			InactivityTimeout: 30 * time.Minute,
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
	if self.config.Enabled && self.config.InactivityTimeout > 0 {
		go self.startInactivityCleanupLoop()
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

// DeleteConversations removes the given conversations from a session but
// preserves the session's UsageMetrics so token accounting is not lost.
func (s *AIStoreImpl) DeleteConversations(sessionID string, conversationIDs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionConversation, exists := s.conversations[sessionID]
	if !exists {
		return nil
	}

	sessionConversation.mu.Lock()
	defer sessionConversation.mu.Unlock()

	for _, id := range conversationIDs {
		delete(sessionConversation.Conversation, id)
	}

	internalmetrics.SetAIStoreConversationsTotal(s.totalConversationsLocked())
	return nil
}

// GetConversation retrieves a conversation by sessionID
func (s *AIStoreImpl) GetConversation(sessionID string, conversationID string) (*types.Conversation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessionConversation, found := s.conversations[sessionID]
	if !found {
		return &types.Conversation{}, false
	}
	sessionConversation.mu.Lock()
	defer sessionConversation.mu.Unlock()
	sessionConversation.LastAccessed = time.Now()
	conversation, found := sessionConversation.Conversation[conversationID]
	if !found {
		return &types.Conversation{}, false
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
			UsageMetrics: make(map[string]*types.UsageMetric),
			LastAccessed: time.Now(),
			mu:           sync.RWMutex{},
		}
	} else {
		s.conversations[sessionID].mu.Lock()
		defer s.conversations[sessionID].mu.Unlock()
		s.conversations[sessionID].LastAccessed = time.Now()
	}
	s.conversations[sessionID].Conversation[conversationID] = conversation
	internalmetrics.SetAIStoreConversationsTotal(s.totalConversationsLocked())
	return nil
}

func usageMetricKey(provider string, model string) string {
	return provider + "|" + model
}

func (s *AIStoreImpl) RecordUsage(sessionID string, provider string, model string, usage types.TokenUsage) error {
	if !usage.HasTokens() {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	sessionConversation, exists := s.conversations[sessionID]
	if !exists {
		sessionConversation = &AIChatConversation{
			Conversation: make(map[string]*types.Conversation),
			UsageMetrics: make(map[string]*types.UsageMetric),
			LastAccessed: time.Now(),
			mu:           sync.RWMutex{},
		}
		s.conversations[sessionID] = sessionConversation
	}

	sessionConversation.mu.Lock()
	defer sessionConversation.mu.Unlock()
	sessionConversation.LastAccessed = time.Now()

	if sessionConversation.UsageMetrics == nil {
		sessionConversation.UsageMetrics = make(map[string]*types.UsageMetric)
	}

	key := usageMetricKey(provider, model)
	metric, found := sessionConversation.UsageMetrics[key]
	if !found {
		now := time.Now()
		metric = &types.UsageMetric{
			UserID:   sessionID,
			Provider: provider,
			Model:    model,
			Since:    now,
		}
		sessionConversation.UsageMetrics[key] = metric
	}

	now := time.Now()
	metric.RequestCount++
	metric.PromptTokens += usage.PromptTokens
	metric.CompletionTokens += usage.CompletionTokens
	metric.TotalTokens += usage.TotalTokens
	if metric.TotalTokens == 0 {
		metric.TotalTokens = metric.PromptTokens + metric.CompletionTokens
	}
	metric.LastUpdated = now

	return nil
}

func (s *AIStoreImpl) GetUsageMetrics(sessionID string) []types.UsageMetric {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessionConversation, exists := s.conversations[sessionID]
	if !exists {
		return []types.UsageMetric{}
	}

	sessionConversation.mu.Lock()
	defer sessionConversation.mu.Unlock()
	sessionConversation.LastAccessed = time.Now()

	if len(sessionConversation.UsageMetrics) == 0 {
		return []types.UsageMetric{}
	}

	metrics := make([]types.UsageMetric, 0, len(sessionConversation.UsageMetrics))
	for _, metric := range sessionConversation.UsageMetrics {
		if metric == nil {
			continue
		}
		metrics = append(metrics, *metric)
	}

	sort.Slice(metrics, func(i, j int) bool {
		if metrics[i].Provider != metrics[j].Provider {
			return metrics[i].Provider < metrics[j].Provider
		}
		return metrics[i].Model < metrics[j].Model
	})

	return metrics
}

// checkMemoryLimits ensures we don't exceed memory limits
// Must be called with write lock held
func (s *AIStoreImpl) checkMemoryLimits(sessionID string, conversationID string, newConversation *types.Conversation) error {
	maxMemoryMB := float64(s.config.MaxCacheMemoryMB)
	if newConversation.EstimatedMB > maxMemoryMB {
		return fmt.Errorf("conversation [%s] requires %.2f MB but max cache memory is %d MB", conversationID, newConversation.EstimatedMB, s.config.MaxCacheMemoryMB)
	}

	// Calculate current memory usage
	currentMemory := s.totalMemoryMBLocked()

	// Subtract old conversation memory if replacing
	if sessionConversation, exists := s.conversations[sessionID]; exists {
		sessionConversation.mu.Lock()
		if conversation, exists := sessionConversation.Conversation[conversationID]; exists {
			sessionConversation.Conversation[conversationID].Mu.Lock()
			currentMemory -= conversation.EstimatedMB
			sessionConversation.Conversation[conversationID].Mu.Unlock()
		}
		sessionConversation.mu.Unlock()
	}

	// Calculate projected memory
	projectedMemory := currentMemory + newConversation.EstimatedMB

	// If over limit, evict LRU sessions until under limit
	if projectedMemory > maxMemoryMB {
		log.Debugf("Approaching AI store memory limit: %.2f MB / %d MB", projectedMemory, s.config.MaxCacheMemoryMB)

		excessMB := projectedMemory - maxMemoryMB
		s.evictLRUConversations(excessMB)

		currentMemory = s.totalMemoryMBLocked()
		if sessionConversation, exists := s.conversations[sessionID]; exists {
			sessionConversation.mu.RLock()
			if conversation, exists := sessionConversation.Conversation[conversationID]; exists {
				conversation.Mu.RLock()
				currentMemory -= conversation.EstimatedMB
				conversation.Mu.RUnlock()
			}
			sessionConversation.mu.RUnlock()
		}
		projectedMemory = currentMemory + newConversation.EstimatedMB
		if projectedMemory > maxMemoryMB {
			return fmt.Errorf("conversation [%s] cannot be stored without exceeding max cache memory (%0.2f MB > %d MB)", conversationID, projectedMemory, s.config.MaxCacheMemoryMB)
		}
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
		if len(s.conversations[session.sessionID].Conversation) == 0 {
			delete(s.conversations, session.sessionID)
		}
		internalmetrics.GetAIStoreEvictionsTotalMetric().Inc()
		freedMB += session.memoryMB
		evictedCount++
	}

	log.Debugf("Freed %.2f MB by evicting %d AI store conversations", freedMB, evictedCount)
	internalmetrics.SetAIStoreConversationsTotal(s.totalConversationsLocked())

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

func (s *AIStoreImpl) totalConversationsLocked() int {
	total := 0
	for _, sessionConversations := range s.conversations {
		total += len(sessionConversations.Conversation)
	}
	return total
}

// LoadAIStoreConfig loads AI store configuration from Kiali config
func LoadAIStoreConfig(cfg *config.Config) *AiStoreConfig { // Parse duration strings from config
	inactivityTimeout, err := cfg.ChatAI.StoreConfig.InactivityTimeout.ToDuration()
	if err != nil || inactivityTimeout <= 0 {
		log.Warningf("Invalid chat_ai.store_config.inactivity_timeout %q, using default 30m", cfg.ChatAI.StoreConfig.InactivityTimeout)
		inactivityTimeout = 30 * time.Minute
	}
	maxMemory := cfg.ChatAI.StoreConfig.MaxCacheMemoryMB
	if maxMemory <= 0 {
		log.Warningf("Invalid chat_ai.store_config.max_cache_memory_mb %d, using default 1024", maxMemory)
		maxMemory = 1024
	}

	return &AiStoreConfig{
		Enabled:           cfg.ChatAI.Enabled && cfg.ChatAI.StoreConfig.Enabled,
		InactivityTimeout: inactivityTimeout,
		MaxCacheMemoryMB:  maxMemory,
		ReduceWithAI:      cfg.ChatAI.StoreConfig.ReduceWithAI,
		ReduceThreshold:   cfg.ChatAI.StoreConfig.ReduceThreshold,
	}
}

func (s *AIStoreImpl) startInactivityCleanupLoop() {
	cleanupInterval := s.config.InactivityTimeout / 2
	if cleanupInterval <= 0 {
		cleanupInterval = time.Minute
	}
	if cleanupInterval > time.Minute {
		cleanupInterval = time.Minute
	}
	if cleanupInterval < 50*time.Millisecond {
		cleanupInterval = 50 * time.Millisecond
	}

	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.purgeInactiveSessions(time.Now())
		}
	}
}

func (s *AIStoreImpl) purgeInactiveSessions(now time.Time) int {
	if s.config.InactivityTimeout <= 0 {
		return 0
	}

	cutoff := now.Add(-s.config.InactivityTimeout)
	purgedConversations := 0

	s.mu.Lock()
	defer s.mu.Unlock()

	for sessionID, sessionConversation := range s.conversations {
		sessionConversation.mu.RLock()
		lastAccessed := sessionConversation.LastAccessed
		conversationCount := len(sessionConversation.Conversation)
		sessionConversation.mu.RUnlock()

		if lastAccessed.Before(cutoff) {
			delete(s.conversations, sessionID)
			purgedConversations += conversationCount
		}
	}

	if purgedConversations > 0 {
		log.Debugf("Purged %d inactive AI store conversations older than %s", purgedConversations, s.config.InactivityTimeout)
		internalmetrics.SetAIStoreConversationsTotal(s.totalConversationsLocked())
	}

	return purgedConversations
}

func EstimateConversationMemory(conversation []types.ConversationMessage) float64 {
	estimatedMB := 0.0
	for _, message := range conversation {
		estimatedMB += EstimateMessageMemory(message)
	}
	return estimatedMB
}

func EstimateMessageMemory(message types.ConversationMessage) float64 {
	return float64(len(message.Content)) / 1024 / 1024
}

// GenerateConversationID generates a new unique conversation ID
func (s *AIStoreImpl) GenerateConversationID() string {
	return uuid.New().String()
}
