package ai

import (
	"context"
	"sync"
	"testing"
	"time"

	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// --- NewAIStore tests ---

func TestNewAIStore_DefaultConfig(t *testing.T) {
	store := NewAIStore(context.Background(), nil)
	require.NotNil(t, store)
	assert.True(t, store.Enabled())
	assert.False(t, store.ReduceWithAI())
	assert.Equal(t, 15, store.ReduceThreshold())
	assert.Equal(t, 30*time.Minute, store.(*AIStoreImpl).config.InactivityTimeout)
}

func TestNewAIStore_CustomConfig(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:           true,
		InactivityTimeout: 45 * time.Minute,
		MaxCacheMemoryMB:  512,
		ReduceWithAI:      true,
		ReduceThreshold:   10,
	}
	store := NewAIStore(context.Background(), cfg)
	require.NotNil(t, store)
	assert.True(t, store.Enabled())
	assert.True(t, store.ReduceWithAI())
	assert.Equal(t, 10, store.ReduceThreshold())
	assert.Equal(t, 45*time.Minute, store.(*AIStoreImpl).config.InactivityTimeout)
}

func TestNewAIStore_DisabledConfig(t *testing.T) {
	cfg := &AiStoreConfig{Enabled: false}
	store := NewAIStore(context.Background(), cfg)
	assert.False(t, store.Enabled())
}

// --- SetConversation / GetConversation tests ---

func TestStore_SetAndGetConversation(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "user", Content: "hello"},
			{Role: "assistant", Content: "hi there"},
		},
	}

	err := store.SetConversation("session-1", "conv-1", conv)
	require.NoError(t, err)

	got, found := store.GetConversation("session-1", "conv-1")
	require.True(t, found)
	require.NotNil(t, got)
	assert.Len(t, got.Conversation, 2)
	assert.Equal(t, "hello", got.Conversation[0].Content)
}

func TestStore_GetConversation_NotFound(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	_, found := store.GetConversation("nonexistent-session", "conv-1")
	assert.False(t, found)
}

func TestStore_GetConversation_SessionExistsButConvMissing(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("session-1", "conv-1", conv))

	_, found := store.GetConversation("session-1", "conv-999")
	assert.False(t, found)
}

func TestStore_SetConversation_OverwriteExisting(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv1 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "first"}},
	}
	require.NoError(t, store.SetConversation("session-1", "conv-1", conv1))

	conv2 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "second"}},
	}
	require.NoError(t, store.SetConversation("session-1", "conv-1", conv2))

	got, found := store.GetConversation("session-1", "conv-1")
	require.True(t, found)
	require.Len(t, got.Conversation, 1)
	assert.Equal(t, "second", got.Conversation[0].Content)
}

func TestStore_MultipleSessionsAndConversations(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	for _, session := range []string{"s1", "s2"} {
		for _, conv := range []string{"c1", "c2"} {
			c := &types.Conversation{
				Conversation: []types.ConversationMessage{{Role: "user", Content: session + "-" + conv}},
			}
			require.NoError(t, store.SetConversation(session, conv, c))
		}
	}

	for _, session := range []string{"s1", "s2"} {
		for _, conv := range []string{"c1", "c2"} {
			got, found := store.GetConversation(session, conv)
			require.True(t, found, "session=%s conv=%s should exist", session, conv)
			assert.Equal(t, session+"-"+conv, got.Conversation[0].Content)
		}
	}
}

// --- Memory management tests ---

func TestStore_EvictsLRUWhenOverMemoryLimit(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:           true,
		InactivityTimeout: 30 * time.Minute,
		MaxCacheMemoryMB:  1, // 1 MB limit
		ReduceWithAI:      false,
		ReduceThreshold:   15,
	}
	store := NewAIStore(context.Background(), cfg)

	largeContent := makeTestString(600 * 1024) // ~0.6 MB
	conv1 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: largeContent}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv1))

	conv2 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: largeContent}},
	}
	require.NoError(t, store.SetConversation("s2", "c2", conv2))

	// c1 should have been evicted to make room for c2
	_, found := store.GetConversation("s1", "c1")
	assert.False(t, found, "oldest conversation should be evicted when over memory limit")

	_, found = store.GetConversation("s2", "c2")
	assert.True(t, found, "newest conversation should remain")
}

func TestStore_RejectsSingleConversationLargerThanLimit(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:           true,
		InactivityTimeout: 30 * time.Minute,
		MaxCacheMemoryMB:  1,
		ReduceWithAI:      false,
		ReduceThreshold:   15,
	}
	store := NewAIStore(context.Background(), cfg)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: makeTestString(2 * 1024 * 1024)}},
	}

	err := store.SetConversation("s1", "c1", conv)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "requires")

	_, found := store.GetConversation("s1", "c1")
	assert.False(t, found)
}

func TestStore_EstimateConversationMemory(t *testing.T) {
	msg := types.ConversationMessage{Content: makeTestString(1024 * 1024)} // 1 MB
	estimate := EstimateConversationMemory([]types.ConversationMessage{msg})
	assert.InDelta(t, 1.0, estimate, 0.01, "1 MB content should estimate ~1 MB")
}

func TestStore_EstimateMessageMemory(t *testing.T) {
	msg := types.ConversationMessage{Content: makeTestString(512 * 1024)} // 512 KB
	estimate := EstimateMessageMemory(msg)
	assert.InDelta(t, 0.5, estimate, 0.01)
}

func TestStore_EstimateConversationMemory_Empty(t *testing.T) {
	estimate := EstimateConversationMemory(nil)
	assert.Equal(t, 0.0, estimate)
}

// --- LoadAIStoreConfig tests ---

func TestLoadAIStoreConfig_FromConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.ChatAI.StoreConfig.Enabled = true
	conf.ChatAI.StoreConfig.InactivityTimeout = "45m"
	conf.ChatAI.StoreConfig.MaxCacheMemoryMB = 2048
	conf.ChatAI.StoreConfig.ReduceWithAI = true
	conf.ChatAI.StoreConfig.ReduceThreshold = 20

	storeCfg := LoadAIStoreConfig(conf)

	assert.True(t, storeCfg.Enabled)
	assert.Equal(t, 45*time.Minute, storeCfg.InactivityTimeout)
	assert.Equal(t, 2048, storeCfg.MaxCacheMemoryMB)
	assert.True(t, storeCfg.ReduceWithAI)
	assert.Equal(t, 20, storeCfg.ReduceThreshold)
}

func TestLoadAIStoreConfig_DisabledWhenChatAIDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = false
	conf.ChatAI.StoreConfig.Enabled = true

	storeCfg := LoadAIStoreConfig(conf)
	assert.False(t, storeCfg.Enabled, "store should be disabled when ChatAI is disabled")
}

func TestLoadAIStoreConfig_InvalidMemoryUsesDefault(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.ChatAI.StoreConfig.Enabled = true
	conf.ChatAI.StoreConfig.MaxCacheMemoryMB = -1

	storeCfg := LoadAIStoreConfig(conf)
	assert.Equal(t, 1024, storeCfg.MaxCacheMemoryMB, "invalid memory should default to 1024")
}

func TestLoadAIStoreConfig_ZeroMemoryUsesDefault(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.ChatAI.StoreConfig.Enabled = true
	conf.ChatAI.StoreConfig.MaxCacheMemoryMB = 0

	storeCfg := LoadAIStoreConfig(conf)
	assert.Equal(t, 1024, storeCfg.MaxCacheMemoryMB, "zero memory should default to 1024")
}

func TestLoadAIStoreConfig_InvalidTimeoutUsesDefault(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.ChatAI.StoreConfig.Enabled = true
	conf.ChatAI.StoreConfig.InactivityTimeout = "not-a-duration"

	storeCfg := LoadAIStoreConfig(conf)

	assert.Equal(t, 30*time.Minute, storeCfg.InactivityTimeout, "invalid timeout should default to 30m")
}

// --- Concurrent access tests ---

func TestStore_ConcurrentSetAndGet(t *testing.T) {
	store := NewAIStore(context.Background(), nil)
	const numGoroutines = 50
	var wg sync.WaitGroup

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			conv := &types.Conversation{
				Conversation: []types.ConversationMessage{
					{Role: "user", Content: "msg"},
				},
			}
			session := "session"
			convID := "conv"
			_ = store.SetConversation(session, convID, conv)
			store.GetConversation(session, convID)
		}(i)
	}

	wg.Wait()

	_, found := store.GetConversation("session", "conv")
	assert.True(t, found)
}

// --- Token logging accuracy: Prometheus metrics tests ---

func getGaugeValue(g interface{ Write(*dto.Metric) error }) float64 {
	m := &dto.Metric{}
	if err := g.Write(m); err != nil {
		return 0
	}
	return m.Gauge.GetValue()
}

func getCounterValue(c interface{ Write(*dto.Metric) error }) float64 {
	m := &dto.Metric{}
	if err := c.Write(m); err != nil {
		return 0
	}
	return m.Counter.GetValue()
}

func TestStore_MetricsConversationsTotalUpdatedOnSet(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv))

	after := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)
	assert.Equal(t, 1.0, after, "kiali_ai_store_conversations_total should reflect the store conversation count")
}

func TestStore_MetricsEvictionsTotalIncrementedOnEviction(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:           true,
		InactivityTimeout: 30 * time.Minute,
		MaxCacheMemoryMB:  1,
		ReduceWithAI:      false,
		ReduceThreshold:   15,
	}
	store := NewAIStore(context.Background(), cfg)

	before := getCounterValue(internalmetrics.GetAIStoreEvictionsTotalMetric())

	largeContent := makeTestString(600 * 1024) // ~0.6 MB
	conv1 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: largeContent}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv1))

	conv2 := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: largeContent}},
	}
	require.NoError(t, store.SetConversation("s2", "c2", conv2))

	after := getCounterValue(internalmetrics.GetAIStoreEvictionsTotalMetric())
	assert.Greater(t, after, before, "kiali_ai_store_evictions_total should increase when conversations are evicted")
}

func TestStore_PurgesInactiveSessions(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store := NewAIStore(ctx, &AiStoreConfig{
		Enabled:           true,
		InactivityTimeout: 100 * time.Millisecond,
		MaxCacheMemoryMB:  1024,
		ReduceWithAI:      false,
		ReduceThreshold:   15,
	}).(*AIStoreImpl)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("stale-session", "conv-1", conv))

	require.Eventually(t, func() bool {
		store.mu.RLock()
		defer store.mu.RUnlock()
		_, exists := store.conversations["stale-session"]
		return !exists
	}, time.Second, 25*time.Millisecond)
}

func makeTestString(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}
