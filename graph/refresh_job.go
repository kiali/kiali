package graph

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/log"
)

// GraphGenerator is a function that generates a graph from options.
// This is injected into the cache to allow refresh jobs to regenerate graphs.
type GraphGenerator func(ctx context.Context, options Options) (TrafficMap, error)

// RefreshJob manages background refresh for a single user's graph.
// It runs on a ticker and updates the cached graph with current data.
type RefreshJob struct {
	cache           *graphCacheImpl
	cancel          context.CancelFunc
	ctx             context.Context
	graphGenerator  GraphGenerator
	graphOptions    Options
	mu              sync.Mutex
	refreshInterval time.Duration
	stopChan        chan struct{}
	stopped         bool
	ticker          *time.Ticker
	userID          string
}

// NewRefreshJob creates a new refresh job for a user's graph.
func NewRefreshJob(
	ctx context.Context,
	userID string,
	options Options,
	cache *graphCacheImpl,
	generator GraphGenerator,
	refreshInterval time.Duration,
) *RefreshJob {
	jobCtx, cancel := context.WithCancel(ctx)

	return &RefreshJob{
		cache:           cache,
		cancel:          cancel,
		ctx:             jobCtx,
		graphGenerator:  generator,
		graphOptions:    options,
		refreshInterval: refreshInterval,
		stopChan:        make(chan struct{}),
		stopped:         false,
		userID:          userID,
	}
}

// Start begins the background refresh loop.
// This method blocks until Stop() is called or the context is cancelled.
func (j *RefreshJob) Start() {
	j.mu.Lock()
	if j.stopped {
		j.mu.Unlock()
		return
	}

	j.ticker = time.NewTicker(j.refreshInterval)
	j.mu.Unlock()

	log.Debugf("Starting refresh job for user %s (interval: %v)", j.userID, j.refreshInterval)

	// Run initial refresh immediately
	go j.refresh()

	// Background refresh loop
	for {
		select {
		case <-j.ticker.C:
			go j.refresh()
		case <-j.stopChan:
			log.Debugf("Stopping refresh job for user %s", j.userID)
			j.cleanup()
			return
		case <-j.ctx.Done():
			log.Debugf("Context cancelled for refresh job (user %s)", j.userID)
			j.cleanup()
			return
		}
	}
}

// Stop halts the refresh job.
func (j *RefreshJob) Stop() {
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.stopped {
		return
	}

	j.stopped = true
	close(j.stopChan)
	j.cancel()
}

// cleanup performs cleanup when the job stops.
func (j *RefreshJob) cleanup() {
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.ticker != nil {
		j.ticker.Stop()
	}
	j.stopped = true
}

// refresh performs a single refresh cycle.
// This is the core logic that:
// 1. Checks if the user's graph still exists (not evicted)
// 2. Checks if the user is still active (within inactivity timeout)
// 3. Updates QueryTime to current time (moving window)
// 4. Generates a fresh graph
// 5. Updates the cache
func (j *RefreshJob) refresh() {
	// Check if user's graph still exists (use internal method to not update LastAccessed)
	cached, found := j.cache.getUserGraphInternal(j.userID)
	if !found {
		log.Debugf("Graph for user %s not found in cache, stopping refresh job", j.userID)
		j.Stop()
		return
	}

	// Check inactivity timeout
	cached.mu.RLock()
	lastAccessed := cached.LastAccessed
	cached.mu.RUnlock()

	inactiveDuration := time.Since(lastAccessed)
	if inactiveDuration > j.cache.config.InactivityTimeout {
		log.Infof("User %s inactive for %v (timeout: %v), evicting and stopping refresh",
			j.userID, inactiveDuration, j.cache.config.InactivityTimeout)
		j.cache.Evict(j.userID)
		j.Stop()
		return
	}

	// CRITICAL: Update QueryTime to current time for moving window
	// This ensures the graph always shows current data as time progresses
	refreshedOptions := j.graphOptions
	refreshedOptions.TelemetryOptions.QueryTime = time.Now().Unix()

	log.Tracef("Refreshing graph for user %s (duration: %v, moving window to: %v)",
		j.userID,
		refreshedOptions.TelemetryOptions.Duration,
		time.Unix(refreshedOptions.TelemetryOptions.QueryTime, 0))

	// Generate fresh graph
	startTime := time.Now()
	trafficMap, err := j.graphGenerator(j.ctx, refreshedOptions)
	generateDuration := time.Since(startTime)

	if err != nil {
		log.Errorf("Failed to refresh graph for user %s: %v", j.userID, err)
		// Keep the old graph in cache rather than evicting on error
		return
	}

	// Calculate memory for the new graph
	newMemoryMB := EstimateGraphMemory(trafficMap)

	// Update cache with fresh graph
	newCached := &CachedGraph{
		LastAccessed:    cached.LastAccessed, // Preserve last access time
		Options:         refreshedOptions,
		RefreshInterval: j.refreshInterval,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	err = j.cache.SetUserGraph(j.userID, newCached)
	if err != nil {
		log.Errorf("Failed to update cache for user %s: %v", j.userID, err)
		return
	}

	log.Debugf("Refreshed graph for user %s (%d nodes, %.2f MB, generated in %v)",
		j.userID, len(trafficMap), newMemoryMB, generateDuration)
}

// RefreshJobManager manages all active refresh jobs across users.
type RefreshJobManager struct {
	cancel context.CancelFunc
	ctx    context.Context
	jobs   map[string]*RefreshJob
	mu     sync.RWMutex
}

// NewRefreshJobManager creates a new refresh job manager.
func NewRefreshJobManager(ctx context.Context) *RefreshJobManager {
	managerCtx, cancel := context.WithCancel(ctx)

	return &RefreshJobManager{
		cancel: cancel,
		ctx:    managerCtx,
		jobs:   make(map[string]*RefreshJob),
	}
}

// StartJob creates and starts a refresh job for a user.
// If a job already exists for the user, it's stopped and replaced.
func (m *RefreshJobManager) StartJob(
	userID string,
	options Options,
	cache *graphCacheImpl,
	generator GraphGenerator,
	refreshInterval time.Duration,
) {
	m.mu.Lock()

	// Stop existing job if present
	if existingJob, exists := m.jobs[userID]; exists {
		log.Debugf("Replacing existing refresh job for user %s", userID)
		existingJob.Stop()
		delete(m.jobs, userID)
	}

	// Create and start new job
	job := NewRefreshJob(m.ctx, userID, options, cache, generator, refreshInterval)
	m.jobs[userID] = job
	m.mu.Unlock()

	// Start the job in a goroutine
	go job.Start()

	log.Infof("Started refresh job for user %s (interval: %v)", userID, refreshInterval)
}

// StopJob stops the refresh job for a specific user.
func (m *RefreshJobManager) StopJob(userID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if job, exists := m.jobs[userID]; exists {
		job.Stop()
		delete(m.jobs, userID)
		log.Infof("Stopped refresh job for user %s", userID)
	}
}

// StopAll stops all refresh jobs.
func (m *RefreshJobManager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	log.Infof("Stopping all refresh jobs (%d active)", len(m.jobs))

	for userID, job := range m.jobs {
		job.Stop()
		delete(m.jobs, userID)
	}

	m.cancel()
}

// ActiveJobCount returns the number of currently active refresh jobs.
func (m *RefreshJobManager) ActiveJobCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.jobs)
}

// HasJob returns true if a refresh job exists for the given user.
func (m *RefreshJobManager) HasJob(userID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.jobs[userID]
	return exists
}

// SetGraphGenerator sets the graph generator for the cache.
// This must be called before starting any refresh jobs.
func (c *graphCacheImpl) SetGraphGenerator(generator GraphGenerator) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.graphGenerator = generator
}

// GetGraphGenerator returns the graph generator if set.
func (c *graphCacheImpl) GetGraphGenerator() GraphGenerator {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.graphGenerator
}
