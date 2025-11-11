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

// RefreshJob manages background refresh for a single session's graph.
// It runs on a ticker and updates the cached graph with current data.
// Each browser session (identified by sessionID) gets its own refresh job.
type RefreshJob struct {
	cache           *GraphCacheImpl
	cancel          context.CancelFunc
	ctx             context.Context
	graphGenerator  GraphGenerator
	graphOptions    Options
	mu              sync.Mutex
	refreshInterval time.Duration
	sessionID       string // Unique session identifier (different per browser/tab)
	stopChan        chan struct{}
	stopped         bool
	ticker          *time.Ticker
}

// NewRefreshJob creates a new refresh job for a session's graph.
func NewRefreshJob(
	ctx context.Context,
	sessionID string,
	options Options,
	cache *GraphCacheImpl,
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
		sessionID:       sessionID,
		stopChan:        make(chan struct{}),
		stopped:         false,
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

	log.Debugf("Starting refresh job for session %s (interval: %v)", j.sessionID, j.refreshInterval)

	// Run initial refresh immediately
	go j.refresh()

	// Background refresh loop
	for {
		select {
		case <-j.ticker.C:
			go j.refresh()
		case <-j.stopChan:
			log.Debugf("Stopping refresh job for session %s", j.sessionID)
			j.cleanup()
			return
		case <-j.ctx.Done():
			log.Debugf("Context cancelled for refresh job (session %s)", j.sessionID)
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
// 1. Checks if the session's graph still exists (not evicted)
// 2. Checks if the session is still active (within inactivity timeout)
// 3. Updates QueryTime to current time (moving window)
// 4. Generates a fresh graph
// 5. Updates the cache
func (j *RefreshJob) refresh() {
	// Check if session's graph still exists (use internal method to not update LastAccessed)
	cached, found := j.cache.getSessionGraphInternal(j.sessionID)
	if !found {
		log.Debugf("Graph for session %s not found in cache, stopping refresh job", j.sessionID)
		j.Stop()
		return
	}

	// Check inactivity timeout
	cached.mu.RLock()
	lastAccessed := cached.LastAccessed
	cached.mu.RUnlock()

	inactiveDuration := time.Since(lastAccessed)
	if inactiveDuration > j.cache.config.InactivityTimeout {
		log.Infof("Session %s inactive for %v (timeout: %v), evicting and stopping refresh",
			j.sessionID, inactiveDuration, j.cache.config.InactivityTimeout)
		j.cache.Evict(j.sessionID)
		j.Stop()
		return
	}

	// CRITICAL: Update QueryTime to current time for moving window
	// This ensures the graph always shows current data as time progresses
	refreshedOptions := j.graphOptions
	refreshedOptions.TelemetryOptions.QueryTime = time.Now().Unix()

	log.Tracef("Refreshing graph for session %s (duration: %v, moving window to: %v)",
		j.sessionID,
		refreshedOptions.TelemetryOptions.Duration,
		time.Unix(refreshedOptions.TelemetryOptions.QueryTime, 0))

	// Generate fresh graph
	startTime := time.Now()
	trafficMap, err := j.graphGenerator(j.ctx, refreshedOptions)
	generateDuration := time.Since(startTime)

	if err != nil {
		log.Errorf("Failed to refresh graph for session %s: %v", j.sessionID, err)
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

	err = j.cache.SetSessionGraph(j.sessionID, newCached)
	if err != nil {
		log.Errorf("Failed to update cache for session %s: %v", j.sessionID, err)
		return
	}

	log.Debugf("Refreshed graph for session %s (%d nodes, %.2f MB, generated in %v)",
		j.sessionID, len(trafficMap), newMemoryMB, generateDuration)
}

// RefreshJobManager manages all active refresh jobs across sessions.
// Each session (identified by sessionID) can have its own refresh job.
type RefreshJobManager struct {
	cancel context.CancelFunc
	ctx    context.Context
	jobs   map[string]*RefreshJob // map key is sessionID
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

// StartJob creates and starts a refresh job for a session.
// If a job already exists for the session, it's stopped and replaced.
func (m *RefreshJobManager) StartJob(
	sessionID string,
	options Options,
	cache *GraphCacheImpl,
	generator GraphGenerator,
	refreshInterval time.Duration,
) {
	m.mu.Lock()

	// Stop existing job if present
	if existingJob, exists := m.jobs[sessionID]; exists {
		log.Debugf("Replacing existing refresh job for session %s", sessionID)
		existingJob.Stop()
		delete(m.jobs, sessionID)
	}

	// Create and start new job
	job := NewRefreshJob(m.ctx, sessionID, options, cache, generator, refreshInterval)
	m.jobs[sessionID] = job
	m.mu.Unlock()

	// Start the job in a goroutine
	go job.Start()

	log.Infof("Started refresh job for session %s (interval: %v)", sessionID, refreshInterval)
}

// StopJob stops the refresh job for a specific session.
func (m *RefreshJobManager) StopJob(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if job, exists := m.jobs[sessionID]; exists {
		job.Stop()
		delete(m.jobs, sessionID)
		log.Infof("Stopped refresh job for session %s", sessionID)
	}
}

// StopAll stops all refresh jobs.
func (m *RefreshJobManager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	log.Infof("Stopping all refresh jobs (%d active)", len(m.jobs))

	for sessionID, job := range m.jobs {
		job.Stop()
		delete(m.jobs, sessionID)
	}

	m.cancel()
}

// ActiveJobCount returns the number of currently active refresh jobs.
func (m *RefreshJobManager) ActiveJobCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.jobs)
}

// HasJob returns true if a refresh job exists for the given session.
func (m *RefreshJobManager) HasJob(sessionID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.jobs[sessionID]
	return exists
}
