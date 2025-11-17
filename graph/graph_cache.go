package graph

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var (
	// Prometheus metrics for graph cache
	cacheEvictionsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "kiali_graph_cache_evictions_total",
		Help: "Total number of graph cache evictions",
	})
	cacheHitsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "kiali_graph_cache_hits_total",
		Help: "Total number of graph cache hits",
	})
	cacheMissesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "kiali_graph_cache_misses_total",
		Help: "Total number of graph cache misses",
	})
)

func init() {
	// Register metrics with Prometheus
	prometheus.MustRegister(cacheEvictionsTotal)
	prometheus.MustRegister(cacheHitsTotal)
	prometheus.MustRegister(cacheMissesTotal)
}

// GraphCache provides per-session graph caching with background refresh.
// Each session's graph is cached and refreshed in the background
// with a moving time window to ensure users always see current traffic data.
// Sessions are uniquely identified by sessionID, allowing multiple concurrent
// sessions per user (e.g., different browsers/tabs).
type GraphCache interface {
	// ActiveSessions returns the number of sessions with cached graphs
	ActiveSessions() int

	// Clear removes all cached graphs (useful for testing and shutdown)
	Clear()

	// Config returns the cache configuration
	Config() *GraphCacheConfig

	// Enabled returns true if graph caching is enabled
	Enabled() bool

	// Evict removes a session's graph from cache and stops background refresh
	Evict(sessionID string)

	// GetGraphGenerator returns the current graph generator (may be nil)
	GetGraphGenerator() GraphGenerator

	// GetSessionGraph retrieves a session's cached graph if it exists
	GetSessionGraph(sessionID string) (*CachedGraph, bool)

	// SetGraphGenerator sets the graph generator function for background refresh
	SetGraphGenerator(generator GraphGenerator)

	// SetSessionGraph stores or updates a session's cached graph
	SetSessionGraph(sessionID string, cached *CachedGraph) error

	// TotalMemoryMB returns estimated total memory usage of all cached graphs
	TotalMemoryMB() float64
}

// CachedGraph represents a user's cached graph with metadata
type CachedGraph struct {
	LastAccessed    time.Time // When last retrieved by user
	Options         Options
	RefreshInterval time.Duration // User's requested refresh interval
	Timestamp       time.Time     // When the graph was generated
	TrafficMap      TrafficMap
	estimatedMB     float64      // Estimated memory usage in MB
	mu              sync.RWMutex // Protects LastAccessed field
}

// GraphCacheConfig holds graph cache configuration
type GraphCacheConfig struct {
	Enabled           bool
	InactivityTimeout time.Duration // How long to keep inactive graphs
	MaxCacheMemoryMB  int           // Maximum memory for all cached graphs
	RefreshInterval   time.Duration // Default refresh interval
}

// GraphCacheImpl implements GraphCache interface
// Exported so RefreshJob can access internal methods (type assertion from interface)
type GraphCacheImpl struct {
	config         *GraphCacheConfig
	ctx            context.Context
	graphGenerator GraphGenerator // Injected function for refresh jobs to regenerate graphs
	mu             sync.RWMutex
	sessionGraphs  map[string]*CachedGraph // map key is sessionID
}

// NewGraphCache creates a new graph cache instance
func NewGraphCache(ctx context.Context, config *GraphCacheConfig) GraphCache {
	if config == nil {
		// Default configuration
		config = &GraphCacheConfig{
			Enabled:           false, // Disabled by default
			InactivityTimeout: 10 * time.Minute,
			MaxCacheMemoryMB:  100,
			RefreshInterval:   60 * time.Second,
		}
	}

	return &GraphCacheImpl{
		config:        config,
		ctx:           ctx,
		sessionGraphs: make(map[string]*CachedGraph),
	}
}

// GetSessionGraph retrieves a session's cached graph and updates last accessed time
func (c *GraphCacheImpl) GetSessionGraph(sessionID string) (*CachedGraph, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, found := c.sessionGraphs[sessionID]
	if !found {
		return nil, false
	}

	// Update last accessed time
	cached.mu.Lock()
	cached.LastAccessed = time.Now()
	cached.mu.Unlock()

	return cached, true
}

// getSessionGraphInternal retrieves a session's cached graph without updating last accessed time
// This is used internally by refresh jobs to check inactivity without affecting the access time
func (c *GraphCacheImpl) getSessionGraphInternal(sessionID string) (*CachedGraph, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, found := c.sessionGraphs[sessionID]
	return cached, found
}

// SetSessionGraph stores a graph for a session
func (c *GraphCacheImpl) SetSessionGraph(sessionID string, cached *CachedGraph) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Estimate memory if not already set
	if cached.estimatedMB == 0 {
		cached.estimatedMB = EstimateGraphMemory(cached.TrafficMap)
	}

	// Check memory limits before adding
	if err := c.checkMemoryLimits(sessionID, cached); err != nil {
		return err
	}

	c.sessionGraphs[sessionID] = cached

	log.Infof("Set graph cache for session [%s] (%d nodes, %.2f MB)",
		sessionID, len(cached.TrafficMap), cached.estimatedMB)

	return nil
}

// Evict removes a session's graph from cache
func (c *GraphCacheImpl) Evict(sessionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if cached, found := c.sessionGraphs[sessionID]; found {
		delete(c.sessionGraphs, sessionID)
		cacheEvictionsTotal.Inc()
		log.Infof("Evicted graph cache for session [%s] (%.2f MB freed)", sessionID, cached.estimatedMB)
	}
}

// Clear removes all cached graphs
func (c *GraphCacheImpl) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := len(c.sessionGraphs)
	c.sessionGraphs = make(map[string]*CachedGraph)

	log.Infof("Cleared graph cache (%d sessions removed)", count)
}

// TotalMemoryMB returns total cache memory usage
func (c *GraphCacheImpl) TotalMemoryMB() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var totalMB float64
	for _, cached := range c.sessionGraphs {
		totalMB += cached.estimatedMB
	}
	return totalMB
}

// Enabled returns true if graph caching is enabled
func (c *GraphCacheImpl) Enabled() bool {
	return c.config.Enabled
}

// ActiveSessions returns the number of sessions with cached graphs
func (c *GraphCacheImpl) ActiveSessions() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.sessionGraphs)
}

// checkMemoryLimits ensures we don't exceed memory limits
// Must be called with write lock held
func (c *GraphCacheImpl) checkMemoryLimits(sessionID string, newCached *CachedGraph) error {
	// Calculate current memory usage
	currentMemory := c.totalMemoryMBLocked()

	// Subtract old graph memory if replacing
	if old, exists := c.sessionGraphs[sessionID]; exists {
		currentMemory -= old.estimatedMB
	}

	// Calculate projected memory
	projectedMemory := currentMemory + newCached.estimatedMB

	// If over limit, evict LRU sessions until under limit
	if projectedMemory > float64(c.config.MaxCacheMemoryMB) {
		log.Infof("Approaching graph cache memory limit: %.2f MB / %d MB", projectedMemory, c.config.MaxCacheMemoryMB)

		excessMB := projectedMemory - float64(c.config.MaxCacheMemoryMB)
		c.evictLRU(excessMB)
	}

	return nil
}

// totalMemoryMBLocked returns total memory usage (must be called with lock held)
func (c *GraphCacheImpl) totalMemoryMBLocked() float64 {
	var totalMB float64
	for _, cached := range c.sessionGraphs {
		totalMB += cached.estimatedMB
	}
	return totalMB
}

// evictLRU evicts least recently accessed sessions until targetMB is freed
// Must be called with write lock held
func (c *GraphCacheImpl) evictLRU(targetMB float64) {
	// Create list of sessions sorted by last accessed time (oldest first)
	type sessionEntry struct {
		lastAccessed time.Time
		memoryMB     float64
		sessionID    string
	}

	var sessions []sessionEntry
	for sessionID, cached := range c.sessionGraphs {
		cached.mu.RLock()
		lastAccess := cached.LastAccessed
		cached.mu.RUnlock()

		sessions = append(sessions, sessionEntry{
			lastAccessed: lastAccess,
			memoryMB:     cached.estimatedMB,
			sessionID:    sessionID,
		})
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

		log.Infof("Evicting graph cache session [%s] due to memory limit (last accessed: %v ago, %.2f MB)",
			session.sessionID,
			time.Since(session.lastAccessed).Round(time.Second),
			session.memoryMB)

		delete(c.sessionGraphs, session.sessionID)
		cacheEvictionsTotal.Inc()
		freedMB += session.memoryMB
		evictedCount++
	}

	log.Infof("Freed %.2f MB by evicting %d graph cache sessions", freedMB, evictedCount)
}

// EstimateGraphMemory estimates the memory usage of a TrafficMap in MB
// This is a rough estimation based on node and edge counts
func EstimateGraphMemory(trafficMap TrafficMap) float64 {
	if trafficMap == nil {
		return 0
	}

	nodeCount := len(trafficMap)

	// Count edges across all nodes
	var edgeCount int
	for _, node := range trafficMap {
		if node != nil && node.Edges != nil {
			edgeCount += len(node.Edges)
		}
	}

	// Rough estimation:
	// - Average memory per node: ~3KB (includes Node struct + metadata)
	// - Average memory per edge: ~1KB (includes Edge struct + metadata)
	// These are conservative estimates
	estimatedBytes := (nodeCount * 3000) + (edgeCount * 1000)

	// Convert to MB
	estimatedMB := float64(estimatedBytes) / (1024 * 1024)

	// Add overhead for map structure (roughly 10%)
	estimatedMB *= 1.1

	return estimatedMB
}

// LoadGraphCacheConfig loads graph cache configuration from Kiali config
func LoadGraphCacheConfig(cfg config.Config) *GraphCacheConfig {
	// Parse duration strings from config
	refreshInterval, err := time.ParseDuration(cfg.KialiInternal.GraphCache.RefreshInterval)
	if err != nil {
		log.Warningf("Invalid kiali_internal.graph_cache.refresh_interval '%s', using default 60s", cfg.KialiInternal.GraphCache.RefreshInterval)
		refreshInterval = 60 * time.Second
	}

	inactivityTimeout, err := time.ParseDuration(cfg.KialiInternal.GraphCache.InactivityTimeout)
	if err != nil {
		log.Warningf("Invalid kiali_internal.graph_cache.inactivity_timeout '%s', using default 10m", cfg.KialiInternal.GraphCache.InactivityTimeout)
		inactivityTimeout = 10 * time.Minute
	}

	maxMemory := cfg.KialiInternal.GraphCache.MaxCacheMemoryMB
	if maxMemory <= 0 {
		log.Warningf("Invalid kiali_internal.graph_cache.max_cache_memory_mb %d, using default 100", maxMemory)
		maxMemory = 100
	}

	return &GraphCacheConfig{
		Enabled:           cfg.KialiInternal.GraphCache.Enabled,
		InactivityTimeout: inactivityTimeout,
		MaxCacheMemoryMB:  maxMemory,
		RefreshInterval:   refreshInterval,
	}
}

// SetGraphGenerator sets the graph generator function for background refresh
func (c *GraphCacheImpl) SetGraphGenerator(generator GraphGenerator) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.graphGenerator = generator
}

// GetGraphGenerator returns the current graph generator (may be nil)
func (c *GraphCacheImpl) GetGraphGenerator() GraphGenerator {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.graphGenerator
}

// Config returns the cache configuration
func (c *GraphCacheImpl) Config() *GraphCacheConfig {
	return c.config
}

// IncrementCacheHit increments the cache hit counter for Prometheus metrics
func IncrementCacheHit() {
	cacheHitsTotal.Inc()
}

// IncrementCacheMiss increments the cache miss counter for Prometheus metrics
func IncrementCacheMiss() {
	cacheMissesTotal.Inc()
}

// Interface guard
var _ GraphCache = (*GraphCacheImpl)(nil)
