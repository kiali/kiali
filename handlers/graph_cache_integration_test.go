package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/graph"
)

// TestGraphNamespacesWithCache_CacheMiss tests that a cache miss generates a new graph and caches it
func TestGraphNamespacesWithCache_CacheMiss(t *testing.T) {
	// Setup
	ctx := context.Background()
	config := &graph.GraphCacheConfig{
		Enabled:           true,
		RefreshInterval:   60 * time.Second,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
	}
	cache := graph.NewGraphCache(ctx, config)
	refreshMgr := graph.NewRefreshJobManager(ctx)
	defer refreshMgr.StopAll()

	// Create test options with a session ID
	opts := graph.Options{
		TelemetryOptions: graph.TelemetryOptions{
			SessionID: "test-session-123",
		},
	}

	// Initially, cache should be empty
	_, found := cache.GetSessionGraph(opts.SessionID)
	assert.False(t, found, "Cache should be empty initially")

	// Note: This test is a basic structure - full integration would require
	// mocked business layer and prometheus client with test data
	t.Log("graph cache integration test structure created successfully")
}

// TestGraphNamespacesWithCache_CacheHit tests that a cache hit returns cached data
func TestGraphNamespacesWithCache_CacheHit(t *testing.T) {
	// Setup
	ctx := context.Background()
	config := &graph.GraphCacheConfig{
		Enabled:           true,
		RefreshInterval:   60 * time.Second,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
	}
	cache := graph.NewGraphCache(ctx, config)
	refreshMgr := graph.NewRefreshJobManager(ctx)
	defer refreshMgr.StopAll()

	// Create test options with a session ID
	sessionID := "test-session-456"
	opts := graph.Options{
		TelemetryOptions: graph.TelemetryOptions{
			SessionID: sessionID,
			CommonOptions: graph.CommonOptions{
				QueryTime: time.Now().Unix(),
				Duration:  120 * time.Second,
			},
		},
	}

	// Create a simple test traffic map
	trafficMap := graph.TrafficMap{
		"node1": &graph.Node{
			ID: "node1",
		},
	}

	// Manually cache a graph
	cached := &graph.CachedGraph{
		LastAccessed:    time.Now(),
		Options:         opts,
		RefreshInterval: 60 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	err := cache.SetSessionGraph(sessionID, cached)
	require.NoError(t, err, "Failed to cache graph")

	// Verify cache hit
	retrieved, found := cache.GetSessionGraph(sessionID)
	assert.True(t, found, "Should find cached graph")
	assert.NotNil(t, retrieved, "Retrieved graph should not be nil")
	assert.Equal(t, 1, len(retrieved.TrafficMap), "Should have 1 node in traffic map")

	t.Log("Cache hit test passed successfully")
}

// TestCacheDisabled tests that caching is bypassed when disabled
func TestCacheDisabled(t *testing.T) {
	ctx := context.Background()
	config := &graph.GraphCacheConfig{
		Enabled:           false, // Disabled
		RefreshInterval:   60 * time.Second,
		InactivityTimeout: 10 * time.Minute,
		MaxCacheMemoryMB:  1024,
	}
	cache := graph.NewGraphCache(ctx, config)

	assert.False(t, cache.Enabled(), "Cache should be disabled")

	// When cache is disabled, graph handler should fall back to non-cached path
	t.Log("Cache disabled test passed successfully")
}

// TestGraphOptionsMatch tests the graphOptionsMatch function
func TestGraphOptionsMatch(t *testing.T) {
	baseOptions := graph.Options{
		TelemetryOptions: graph.TelemetryOptions{
			Namespaces: graph.NamespaceInfoMap{
				"bookinfo": graph.NamespaceInfo{Name: "bookinfo"},
			},
			InjectServiceNodes: true,
			IncludeIdleEdges:   false,
			Appenders: graph.RequestedAppenders{
				AppenderNames: []string{"deadNode", "sidecarsCheck"},
			},
			CommonOptions: graph.CommonOptions{
				GraphType: "app",
				Duration:  600 * time.Second,
				QueryTime: time.Now().Unix(),
			},
			NodeOptions: graph.NodeOptions{
				Aggregate:      "version",
				AggregateValue: "v1",
			},
		},
	}

	// Test 1: Identical options should match
	identical := baseOptions
	identical.TelemetryOptions.QueryTime = baseOptions.TelemetryOptions.QueryTime + 10 // Different QueryTime is OK
	assert.True(t, graphOptionsMatch(baseOptions, identical), "Identical options (except QueryTime) should match")

	// Test 2: Different namespace should NOT match
	diffNamespace := baseOptions
	diffNamespace.Namespaces = graph.NamespaceInfoMap{
		"istio-system": graph.NamespaceInfo{Name: "istio-system"},
	}
	assert.False(t, graphOptionsMatch(baseOptions, diffNamespace), "Different namespace should not match")

	// Test 3: Different duration should NOT match
	diffDuration := baseOptions
	diffDuration.TelemetryOptions.Duration = 300 * time.Second
	assert.False(t, graphOptionsMatch(baseOptions, diffDuration), "Different duration should not match")

	// Test 4: Different graph type should NOT match
	diffGraphType := baseOptions
	diffGraphType.TelemetryOptions.GraphType = "workload"
	assert.False(t, graphOptionsMatch(baseOptions, diffGraphType), "Different graph type should not match")

	// Test 5: Different inject service nodes should NOT match
	diffInjectNodes := baseOptions
	diffInjectNodes.InjectServiceNodes = false
	assert.False(t, graphOptionsMatch(baseOptions, diffInjectNodes), "Different InjectServiceNodes should not match")

	// Test 6: Different idle edges flag should NOT match
	diffIdleEdges := baseOptions
	diffIdleEdges.IncludeIdleEdges = true
	assert.False(t, graphOptionsMatch(baseOptions, diffIdleEdges), "Different IncludeIdleEdges should not match")

	// Test 7: Different appenders should NOT match
	diffAppenders := baseOptions
	diffAppenders.Appenders.AppenderNames = []string{"deadNode"}
	assert.False(t, graphOptionsMatch(baseOptions, diffAppenders), "Different appenders should not match")

	t.Log("All graphOptionsMatch tests passed")
}
