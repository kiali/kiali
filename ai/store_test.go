package ai

import (
	"context"
	"sync"
	"testing"

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
}

func TestNewAIStore_CustomConfig(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:          true,
		MaxCacheMemoryMB: 512,
		ReduceWithAI:     true,
		ReduceThreshold:  10,
	}
	store := NewAIStore(context.Background(), cfg)
	require.NotNil(t, store)
	assert.True(t, store.Enabled())
	assert.True(t, store.ReduceWithAI())
	assert.Equal(t, 10, store.ReduceThreshold())
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

// --- GetConversationIDs tests ---

func TestStore_GetConversationIDs(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	for _, conv := range []string{"conv-a", "conv-b", "conv-c"} {
		c := &types.Conversation{
			Conversation: []types.ConversationMessage{{Role: "user", Content: conv}},
		}
		require.NoError(t, store.SetConversation("session-1", conv, c))
	}

	ids := store.GetConversationIDs("session-1")
	assert.Len(t, ids, 3)
	assert.ElementsMatch(t, []string{"conv-a", "conv-b", "conv-c"}, ids)
}

func TestStore_GetConversationIDs_NoSession(t *testing.T) {
	store := NewAIStore(context.Background(), nil)
	ids := store.GetConversationIDs("nonexistent")
	assert.Empty(t, ids)
}

// --- DeleteConversations tests ---

func TestStore_DeleteConversations(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	for _, conv := range []string{"conv-a", "conv-b", "conv-c"} {
		c := &types.Conversation{
			Conversation: []types.ConversationMessage{{Role: "user", Content: conv}},
		}
		require.NoError(t, store.SetConversation("session-1", conv, c))
	}

	err := store.DeleteConversations("session-1", []string{"conv-a", "conv-c"})
	require.NoError(t, err)

	ids := store.GetConversationIDs("session-1")
	assert.Equal(t, []string{"conv-b"}, ids)
}

func TestStore_DeleteConversations_NonexistentSession(t *testing.T) {
	store := NewAIStore(context.Background(), nil)
	err := store.DeleteConversations("nonexistent", []string{"conv-1"})
	assert.NoError(t, err)
}

func TestStore_DeleteConversations_NonexistentConversation(t *testing.T) {
	store := NewAIStore(context.Background(), nil)
	c := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("session-1", "conv-1", c))

	err := store.DeleteConversations("session-1", []string{"conv-999"})
	assert.NoError(t, err)

	ids := store.GetConversationIDs("session-1")
	assert.Len(t, ids, 1, "existing conversation should not be deleted")
}

// --- Memory management tests ---

func TestStore_EvictsLRUWhenOverMemoryLimit(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:          true,
		MaxCacheMemoryMB: 1, // 1 MB limit
		ReduceWithAI:     false,
		ReduceThreshold:  15,
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
	conf.ChatAI.StoreConfig.MaxCacheMemoryMB = 2048
	conf.ChatAI.StoreConfig.ReduceWithAI = true
	conf.ChatAI.StoreConfig.ReduceThreshold = 20

	storeCfg := LoadAIStoreConfig(conf)

	assert.True(t, storeCfg.Enabled)
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

func TestStore_ConcurrentDeleteAndGet(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv))

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			store.GetConversation("s1", "c1")
		}()
		go func() {
			defer wg.Done()
			_ = store.DeleteConversations("s1", []string{"c1"})
		}()
	}
	wg.Wait()
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

	before := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv))

	after := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)
	assert.Greater(t, after, before, "kiali_ai_store_conversations_total should increase after SetConversation")
}

func TestStore_MetricsConversationsTotalUpdatedOnDelete(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, store.SetConversation("s1", "c1", conv))
	require.NoError(t, store.SetConversation("s1", "c2", conv))

	afterSet := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)

	require.NoError(t, store.DeleteConversations("s1", []string{"c1"}))

	afterDelete := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)
	assert.Less(t, afterDelete, afterSet, "kiali_ai_store_conversations_total should decrease after DeleteConversations")
}

func TestStore_MetricsEvictionsTotalIncrementedOnEviction(t *testing.T) {
	cfg := &AiStoreConfig{
		Enabled:          true,
		MaxCacheMemoryMB: 1,
		ReduceWithAI:     false,
		ReduceThreshold:  15,
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

func TestStore_MetricsConversationsTotalAccurateAcrossOperations(t *testing.T) {
	store := NewAIStore(context.Background(), nil)

	conv := &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}

	require.NoError(t, store.SetConversation("s1", "c1", conv))
	require.NoError(t, store.SetConversation("s1", "c2", conv))
	require.NoError(t, store.SetConversation("s2", "c3", conv))

	afterThreeAdds := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)

	require.NoError(t, store.DeleteConversations("s1", []string{"c1", "c2"}))

	afterTwoDeletes := getGaugeValue(internalmetrics.Metrics.AIStoreConversationsTotal)

	delta := afterThreeAdds - afterTwoDeletes
	assert.InDelta(t, 2.0, delta, 0.01,
		"deleting 2 of 3 conversations should reduce the gauge by 2")
}

func makeTestString(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}
