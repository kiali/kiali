package graph

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

// Helper function to create a simple test traffic map
func createTestTrafficMap(nodeCount int) TrafficMap {
	tm := make(TrafficMap)
	for i := 0; i < nodeCount; i++ {
		node := &Node{
			ID:       string(rune('A' + i)),
			NodeType: NodeTypeWorkload,
			Edges:    []*Edge{},
		}
		// Add a few edges to each node
		if i < nodeCount-1 {
			edge := &Edge{
				Source:   node,
				Dest:     &Node{ID: string(rune('A' + i + 1))},
				Metadata: make(Metadata),
			}
			node.Edges = append(node.Edges, edge)
		}
		tm[node.ID] = node
	}
	return tm
}

func TestNewGraphCache(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   30 * time.Second,
	}

	cache := NewGraphCache(ctx, config)
	require.NotNil(t, cache)
	assert.True(t, cache.Enabled())
	assert.Equal(t, 0, cache.ActiveSessions())
	assert.Equal(t, 0.0, cache.TotalMemoryMB())
}

func TestNewGraphCache_NilConfig(t *testing.T) {
	ctx := context.Background()

	// Should create with default config
	cache := NewGraphCache(ctx, nil)
	require.NotNil(t, cache)
	assert.False(t, cache.Enabled()) // Default is disabled
}

func TestGraphCache_SetAndGet(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)
	sessionID := "test-session-1"

	// Create a cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         Options{},
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	// Set the graph
	err := cache.SetSessionGraph(sessionID, cached)
	require.NoError(t, err)

	// Verify it was set
	assert.Equal(t, 1, cache.ActiveSessions())
	assert.Greater(t, cache.TotalMemoryMB(), 0.0)

	// Get the graph
	retrieved, found := cache.GetSessionGraph(sessionID)
	require.True(t, found)
	assert.Equal(t, len(trafficMap), len(retrieved.TrafficMap))
}

func TestGraphCache_GetNonExistent(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)

	// Try to get a non-existent user's graph
	_, found := cache.GetSessionGraph("non-existent-session")
	assert.False(t, found)
}

func TestGraphCache_Evict(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)
	sessionID := "test-session-1"

	// Set a graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         Options{},
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	err := cache.SetSessionGraph(sessionID, cached)
	require.NoError(t, err)
	assert.Equal(t, 1, cache.ActiveSessions())

	// Evict the graph
	cache.Evict(sessionID)

	// Verify it was evicted
	assert.Equal(t, 0, cache.ActiveSessions())
	_, found := cache.GetSessionGraph(sessionID)
	assert.False(t, found)
}

func TestGraphCache_Clear(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)

	// Add multiple users
	for i := 0; i < 3; i++ {
		sessionID := "session-" + string(rune('A'+i))
		trafficMap := createTestTrafficMap(5)
		cached := &CachedGraph{
			LastAccessed:    time.Now(),
			Options:         Options{},
			RefreshInterval: 60 * time.Second,
			Timestamp:       time.Now(),
			TrafficMap:      trafficMap,
		}
		err := cache.SetSessionGraph(sessionID, cached)
		require.NoError(t, err)
	}

	assert.Equal(t, 3, cache.ActiveSessions())

	// Clear all
	cache.Clear()

	// Verify all were cleared
	assert.Equal(t, 0, cache.ActiveSessions())
	assert.Equal(t, 0.0, cache.TotalMemoryMB())
}

func TestGraphCache_MemoryEstimation(t *testing.T) {
	// Test with empty traffic map
	emptyMap := make(TrafficMap)
	memory := EstimateGraphMemory(emptyMap)
	assert.Equal(t, 0.0, memory)

	// Test with nil traffic map
	memory = EstimateGraphMemory(nil)
	assert.Equal(t, 0.0, memory)

	// Test with small traffic map (5 nodes)
	smallMap := createTestTrafficMap(5)
	memory = EstimateGraphMemory(smallMap)
	assert.Greater(t, memory, 0.0)
	assert.Less(t, memory, 1.0) // Should be less than 1 MB for 5 nodes

	// Test with larger traffic map (100 nodes)
	largeMap := createTestTrafficMap(100)
	largeMemory := EstimateGraphMemory(largeMap)
	assert.Greater(t, largeMemory, memory) // Large map should use more memory
}

func TestGraphCache_MemoryLimit(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1, // Very small limit to trigger eviction
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)

	// Add multiple users until we exceed the limit
	// The LRU eviction should kick in
	for i := 0; i < 5; i++ {
		sessionID := "session-" + string(rune('A'+i))
		trafficMap := createTestTrafficMap(50) // Larger graphs
		cached := &CachedGraph{
			LastAccessed:    time.Now().Add(-time.Duration(i) * time.Minute), // Older users first
			Options:         Options{},
			RefreshInterval: 60 * time.Second,
			Timestamp:       time.Now(),
			TrafficMap:      trafficMap,
		}
		err := cache.SetSessionGraph(sessionID, cached)
		require.NoError(t, err)

		// Small sleep to ensure different last accessed times
		time.Sleep(10 * time.Millisecond)
	}

	// Should have evicted some users to stay under limit
	assert.Less(t, cache.ActiveSessions(), 5)
	assert.LessOrEqual(t, cache.TotalMemoryMB(), float64(config.MaxCacheMemoryMB)*1.1) // Allow 10% overhead
}

func TestGraphCache_UpdateLastAccessed(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)
	sessionID := "test-session"

	// Set a graph with old last accessed time
	oldTime := time.Now().Add(-5 * time.Minute)
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    oldTime,
		Options:         Options{},
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	err := cache.SetSessionGraph(sessionID, cached)
	require.NoError(t, err)

	// Get the graph (should update LastAccessed)
	retrieved, found := cache.GetSessionGraph(sessionID)
	require.True(t, found)

	// LastAccessed should be updated to recent time
	assert.True(t, retrieved.LastAccessed.After(oldTime))
	assert.WithinDuration(t, time.Now(), retrieved.LastAccessed, 1*time.Second)
}

func TestGraphCache_ReplaceExistingGraph(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)
	sessionID := "test-session"

	// Set initial graph
	trafficMap1 := createTestTrafficMap(5)
	cached1 := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         Options{},
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap1,
	}

	err := cache.SetSessionGraph(sessionID, cached1)
	require.NoError(t, err)

	initialMemory := cache.TotalMemoryMB()

	// Replace with larger graph
	trafficMap2 := createTestTrafficMap(20)
	cached2 := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         Options{},
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap2,
	}

	err = cache.SetSessionGraph(sessionID, cached2)
	require.NoError(t, err)

	// Should still have only 1 user
	assert.Equal(t, 1, cache.ActiveSessions())

	// Memory should have increased
	assert.Greater(t, cache.TotalMemoryMB(), initialMemory)

	// Retrieved graph should be the new one
	retrieved, found := cache.GetSessionGraph(sessionID)
	require.True(t, found)
	assert.Equal(t, len(trafficMap2), len(retrieved.TrafficMap))
}

func TestLoadGraphCacheConfig(t *testing.T) {
	cfg := config.Config{
		KialiInternal: config.KialiInternalConfig{
			GraphCache: config.GraphCacheConfig{
				Enabled:           true,
				InactivityTimeout: "5m",
				MaxCacheMemoryMB:  50,
				RefreshInterval:   "30s",
			},
		},
	}

	graphCfg := LoadGraphCacheConfig(cfg)

	assert.True(t, graphCfg.Enabled)
	assert.Equal(t, 30*time.Second, graphCfg.RefreshInterval)
	assert.Equal(t, 5*time.Minute, graphCfg.InactivityTimeout)
	assert.Equal(t, 50, graphCfg.MaxCacheMemoryMB)
}

func TestLoadGraphCacheConfig_InvalidDurations(t *testing.T) {
	cfg := config.Config{
		KialiInternal: config.KialiInternalConfig{
			GraphCache: config.GraphCacheConfig{
				Enabled:           true,
				InactivityTimeout: "also-invalid",
				MaxCacheMemoryMB:  0, // Invalid
				RefreshInterval:   "invalid",
			},
		},
	}

	graphCfg := LoadGraphCacheConfig(cfg)

	// Should fall back to defaults
	assert.True(t, graphCfg.Enabled)
	assert.Equal(t, 60*time.Second, graphCfg.RefreshInterval)   // Default
	assert.Equal(t, 10*time.Minute, graphCfg.InactivityTimeout) // Default
	assert.Equal(t, 1024, graphCfg.MaxCacheMemoryMB)            // Default
}

func TestGraphCache_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
		RefreshInterval:   60 * time.Second,
	}

	cache := NewGraphCache(ctx, config)

	// Test concurrent writes and reads
	done := make(chan bool)

	// Goroutine 1: Writing
	go func() {
		for i := 0; i < 10; i++ {
			sessionID := "session-" + string(rune('A'+i%3))
			trafficMap := createTestTrafficMap(5)
			cached := &CachedGraph{
				TrafficMap:      trafficMap,
				Options:         Options{},
				Timestamp:       time.Now(),
				LastAccessed:    time.Now(),
				RefreshInterval: 60 * time.Second,
			}
			_ = cache.SetSessionGraph(sessionID, cached)
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Goroutine 2: Reading
	go func() {
		for i := 0; i < 10; i++ {
			sessionID := "session-" + string(rune('A'+i%3))
			_, _ = cache.GetSessionGraph(sessionID)
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Goroutine 3: Reading metrics
	go func() {
		for i := 0; i < 10; i++ {
			_ = cache.ActiveSessions()
			_ = cache.TotalMemoryMB()
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Wait for all goroutines
	<-done
	<-done
	<-done

	// Should not panic and should have some data
	assert.Greater(t, cache.ActiveSessions(), 0)
}
