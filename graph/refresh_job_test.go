package graph

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock graph generator for testing
func createMockGenerator(nodeCount int, shouldFail bool) GraphGenerator {
	return func(ctx context.Context, options Options) (TrafficMap, error) {
		if shouldFail {
			return nil, assert.AnError
		}
		return createTestTrafficMap(nodeCount), nil
	}
}

// Mock generator that counts calls
func createCountingGenerator(counter *int32, nodeCount int) GraphGenerator {
	return func(ctx context.Context, options Options) (TrafficMap, error) {
		atomic.AddInt32(counter, 1)
		return createTestTrafficMap(nodeCount), nil
	}
}

// Mock generator that tracks QueryTime updates
func createQueryTimeTrackingGenerator(queryTimes *[]int64, nodeCount int) GraphGenerator {
	return func(ctx context.Context, options Options) (TrafficMap, error) {
		*queryTimes = append(*queryTimes, options.TelemetryOptions.QueryTime)
		return createTestTrafficMap(nodeCount), nil
	}
}

func TestNewRefreshJob(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   30 * time.Second,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration: 120 * time.Second,
			},
		},
	}

	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	require.NotNil(t, job)
	assert.Equal(t, "test-user", job.userID)
	assert.Equal(t, 30*time.Second, job.refreshInterval)
	assert.NotNil(t, job.stopChan)
	assert.False(t, job.stopped)
}

func TestRefreshJob_Stop(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   30 * time.Second,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration: 120 * time.Second,
			},
		},
	}

	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	// Stop the job
	job.Stop()

	assert.True(t, job.stopped)

	// Stopping again should be safe
	job.Stop()
	assert.True(t, job.stopped)
}

func TestRefreshJob_RefreshUpdatesQueryTime(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour, // Long interval, we'll call refresh manually
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)

	// Track QueryTime values passed to generator
	var queryTimes []int64
	generator := createQueryTimeTrackingGenerator(&queryTimes, 5)
	cache.SetGraphGenerator(generator)

	// Create initial graph with old QueryTime
	oldQueryTime := time.Now().Add(-5 * time.Minute).Unix()
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: oldQueryTime,
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 30 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	// Create refresh job
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	// Manually call refresh
	job.refresh()

	// Verify QueryTime was updated (should be recent, not the old time)
	require.Len(t, queryTimes, 1)
	newQueryTime := queryTimes[0]

	// New query time should be much more recent than old time
	assert.Greater(t, newQueryTime, oldQueryTime)

	// New query time should be within the last few seconds
	timeDiff := time.Now().Unix() - newQueryTime
	assert.Less(t, timeDiff, int64(5)) // Within 5 seconds
}

func TestRefreshJob_InactivityTimeout(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 1 * time.Second, // Very short timeout for testing
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration: 120 * time.Second,
			},
		},
	}

	// Set initial cached graph with old LastAccessed
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now().Add(-2 * time.Second), // Older than timeout
		Options:         options,
		RefreshInterval: 30 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	// Create refresh job
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	// Manually call refresh
	job.refresh()

	// Job should have stopped itself due to inactivity
	assert.True(t, job.stopped)

	// Graph should be evicted from cache
	_, found := cache.GetUserGraph("test-user")
	assert.False(t, found)
}

func TestRefreshJob_GraphNotFound(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   30 * time.Second,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration: 120 * time.Second,
			},
		},
	}

	// Create job but don't add graph to cache
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	// Manually call refresh
	job.refresh()

	// Job should have stopped itself since graph doesn't exist
	assert.True(t, job.stopped)
}

func TestRefreshJob_GeneratorError(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)

	// Generator that fails
	generator := createMockGenerator(5, true)
	cache.SetGraphGenerator(generator)

	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration: 120 * time.Second,
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 30 * time.Second,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	// Create refresh job
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 30*time.Second)

	// Manually call refresh
	job.refresh()

	// Job should NOT have stopped (keeps old graph on error)
	assert.False(t, job.stopped)

	// Old graph should still be in cache
	retrieved, found := cache.GetUserGraph("test-user")
	require.True(t, found)
	assert.Equal(t, len(trafficMap), len(retrieved.TrafficMap))
}

func TestRefreshJob_StartAndStop(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   100 * time.Millisecond, // Fast interval for testing
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)

	// Count how many times generator is called
	var callCount int32
	generator := createCountingGenerator(&callCount, 5)
	cache.SetGraphGenerator(generator)

	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 100 * time.Millisecond,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	// Create and start job
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 100*time.Millisecond)
	go job.Start()

	// Wait for a few refresh cycles
	time.Sleep(350 * time.Millisecond)

	// Stop the job
	job.Stop()

	// Should have been called multiple times (initial + refreshes)
	calls := atomic.LoadInt32(&callCount)
	assert.Greater(t, calls, int32(2)) // At least 2-3 calls
}

func TestRefreshJob_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   100 * time.Millisecond,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	cache.SetGraphGenerator(generator)

	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 100 * time.Millisecond,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	// Create and start job
	job := NewRefreshJob(ctx, "test-user", options, cache, generator, 100*time.Millisecond)
	done := make(chan bool)
	go func() {
		job.Start()
		done <- true
	}()

	// Let it run briefly
	time.Sleep(50 * time.Millisecond)

	// Cancel context
	cancel()

	// Wait for job to stop
	select {
	case <-done:
		// Job stopped successfully
	case <-time.After(1 * time.Second):
		t.Fatal("Job did not stop after context cancellation")
	}

	assert.True(t, job.stopped)
}

func TestNewRefreshJobManager(t *testing.T) {
	ctx := context.Background()
	manager := NewRefreshJobManager(ctx)

	require.NotNil(t, manager)
	assert.NotNil(t, manager.jobs)
	assert.Equal(t, 0, manager.ActiveJobCount())
}

func TestRefreshJobManager_StartJob(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 1 * time.Hour,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	manager := NewRefreshJobManager(ctx)

	// Start a job
	manager.StartJob("test-user", options, cache, generator, 1*time.Hour)

	// Give it a moment to start
	time.Sleep(50 * time.Millisecond)

	assert.Equal(t, 1, manager.ActiveJobCount())
	assert.True(t, manager.HasJob("test-user"))

	// Clean up
	manager.StopAll()
}

func TestRefreshJobManager_StopJob(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options,
		RefreshInterval: 1 * time.Hour,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	manager := NewRefreshJobManager(ctx)

	// Start a job
	manager.StartJob("test-user", options, cache, generator, 1*time.Hour)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, 1, manager.ActiveJobCount())

	// Stop the job
	manager.StopJob("test-user")
	time.Sleep(50 * time.Millisecond)

	assert.Equal(t, 0, manager.ActiveJobCount())
	assert.False(t, manager.HasJob("test-user"))
}

func TestRefreshJobManager_ReplaceJob(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)
	options1 := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  120 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}
	options2 := Options{
		TelemetryOptions: TelemetryOptions{
			CommonOptions: CommonOptions{
				Duration:  240 * time.Second,
				QueryTime: time.Now().Unix(),
			},
		},
	}

	// Set initial cached graph
	trafficMap := createTestTrafficMap(5)
	cached := &CachedGraph{
		LastAccessed:    time.Now(),
		Options:         options1,
		RefreshInterval: 1 * time.Hour,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}
	err := cache.SetUserGraph("test-user", cached)
	require.NoError(t, err)

	manager := NewRefreshJobManager(ctx)

	// Start first job
	manager.StartJob("test-user", options1, cache, generator, 1*time.Hour)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, 1, manager.ActiveJobCount())

	// Start second job for same user (should replace)
	manager.StartJob("test-user", options2, cache, generator, 1*time.Hour)
	time.Sleep(50 * time.Millisecond)

	// Should still have only 1 job
	assert.Equal(t, 1, manager.ActiveJobCount())
	assert.True(t, manager.HasJob("test-user"))

	// Clean up
	manager.StopAll()
}

func TestRefreshJobManager_StopAll(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)

	manager := NewRefreshJobManager(ctx)

	// Start multiple jobs
	for i := 0; i < 3; i++ {
		userID := "user-" + string(rune('A'+i))
		options := Options{
			TelemetryOptions: TelemetryOptions{
				CommonOptions: CommonOptions{
					Duration:  120 * time.Second,
					QueryTime: time.Now().Unix(),
				},
			},
		}

		// Set cached graph for each user
		trafficMap := createTestTrafficMap(5)
		cached := &CachedGraph{
			LastAccessed:    time.Now(),
			Options:         options,
			RefreshInterval: 1 * time.Hour,
			Timestamp:       time.Now(),
			TrafficMap:      trafficMap,
		}
		err := cache.SetUserGraph(userID, cached)
		require.NoError(t, err)

		manager.StartJob(userID, options, cache, generator, 1*time.Hour)
	}

	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, 3, manager.ActiveJobCount())

	// Stop all jobs
	manager.StopAll()

	assert.Equal(t, 0, manager.ActiveJobCount())
}

func TestRefreshJobManager_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   1 * time.Hour,
	}
	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)

	manager := NewRefreshJobManager(ctx)

	// Concurrent job operations
	done := make(chan bool, 3)

	// Goroutine 1: Start jobs
	go func() {
		for i := 0; i < 5; i++ {
			userID := "user-" + string(rune('A'+i))
			options := Options{
				TelemetryOptions: TelemetryOptions{
					CommonOptions: CommonOptions{
						Duration:  120 * time.Second,
						QueryTime: time.Now().Unix(),
					},
				},
			}

			trafficMap := createTestTrafficMap(5)
			cached := &CachedGraph{
				TrafficMap:      trafficMap,
				Options:         options,
				Timestamp:       time.Now(),
				LastAccessed:    time.Now(),
				RefreshInterval: 1 * time.Hour,
			}
			_ = cache.SetUserGraph(userID, cached)

			manager.StartJob(userID, options, cache, generator, 1*time.Hour)
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Goroutine 2: Stop jobs
	go func() {
		for i := 0; i < 5; i++ {
			userID := "user-" + string(rune('A'+i))
			manager.StopJob(userID)
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Goroutine 3: Check status
	go func() {
		for i := 0; i < 10; i++ {
			_ = manager.ActiveJobCount()
			_ = manager.HasJob("user-A")
			time.Sleep(5 * time.Millisecond)
		}
		done <- true
	}()

	// Wait for all goroutines
	<-done
	<-done
	<-done

	// Should not panic
	manager.StopAll()
}

func TestGraphCache_SetAndGetGraphGenerator(t *testing.T) {
	ctx := context.Background()
	config := &GraphCacheConfig{
		Enabled:           true,
		InactivityTimeout: 5 * time.Minute,
		MaxCacheMemoryMB:  50,
		RefreshInterval:   30 * time.Second,
	}

	cache := NewGraphCache(ctx, config).(*graphCacheImpl)
	generator := createMockGenerator(5, false)

	// Should be nil initially
	assert.Nil(t, cache.GetGraphGenerator())

	// Set generator
	cache.SetGraphGenerator(generator)

	// Should now be set
	assert.NotNil(t, cache.GetGraphGenerator())
}
