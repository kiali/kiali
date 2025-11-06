package graph

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// GraphCache provides per-user graph caching with background refresh.
// Each user's most recent graph is cached and refreshed in the background
// with a moving time window to ensure users always see current traffic data.
type GraphCache interface {
	// GetUserGraph retrieves a user's cached graph if it exists
	GetUserGraph(userID string) (*CachedGraph, bool)

	// SetUserGraph stores or updates a user's cached graph
	SetUserGraph(userID string, cached *CachedGraph) error

	// Evict removes a user's graph from cache and stops background refresh
	Evict(userID string)

	// Clear removes all cached graphs (useful for testing and shutdown)
	Clear()

	// TotalMemoryMB returns estimated total memory usage of all cached graphs
	TotalMemoryMB() float64

	// Enabled returns true if graph caching is enabled
	Enabled() bool

	// ActiveUsers returns the number of users with cached graphs
	ActiveUsers() int
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

// graphCacheImpl implements GraphCache interface
type graphCacheImpl struct {
	config         *GraphCacheConfig
	ctx            context.Context
	graphGenerator GraphGenerator // Injected function for refresh jobs to regenerate graphs
	mu             sync.RWMutex
	userGraphs     map[string]*CachedGraph
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

	return &graphCacheImpl{
		config:     config,
		ctx:        ctx,
		userGraphs: make(map[string]*CachedGraph),
	}
}

// GetUserGraph retrieves a user's cached graph and updates last accessed time
func (c *graphCacheImpl) GetUserGraph(userID string) (*CachedGraph, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, found := c.userGraphs[userID]
	if !found {
		return nil, false
	}

	// Update last accessed time
	cached.mu.Lock()
	cached.LastAccessed = time.Now()
	cached.mu.Unlock()

	return cached, true
}

// getUserGraphInternal retrieves a user's cached graph without updating last accessed time
// This is used internally by refresh jobs to check inactivity without affecting the access time
func (c *graphCacheImpl) getUserGraphInternal(userID string) (*CachedGraph, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, found := c.userGraphs[userID]
	return cached, found
}

// SetUserGraph stores a graph for a user
func (c *graphCacheImpl) SetUserGraph(userID string, cached *CachedGraph) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Estimate memory if not already set
	if cached.estimatedMB == 0 {
		cached.estimatedMB = EstimateGraphMemory(cached.TrafficMap)
	}

	// Check memory limits before adding
	if err := c.checkMemoryLimits(userID, cached); err != nil {
		return err
	}

	c.userGraphs[userID] = cached

	log.Debugf("Cached graph for user %s (%d nodes, %.2f MB)",
		userID, len(cached.TrafficMap), cached.estimatedMB)

	return nil
}

// Evict removes a user's graph from cache
func (c *graphCacheImpl) Evict(userID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if cached, found := c.userGraphs[userID]; found {
		delete(c.userGraphs, userID)
		log.Debugf("Evicted graph for user %s (%.2f MB freed)", userID, cached.estimatedMB)
	}
}

// Clear removes all cached graphs
func (c *graphCacheImpl) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := len(c.userGraphs)
	c.userGraphs = make(map[string]*CachedGraph)

	log.Infof("Cleared graph cache (%d users removed)", count)
}

// TotalMemoryMB returns total cache memory usage
func (c *graphCacheImpl) TotalMemoryMB() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var totalMB float64
	for _, cached := range c.userGraphs {
		totalMB += cached.estimatedMB
	}
	return totalMB
}

// Enabled returns true if graph caching is enabled
func (c *graphCacheImpl) Enabled() bool {
	return c.config.Enabled
}

// ActiveUsers returns the number of users with cached graphs
func (c *graphCacheImpl) ActiveUsers() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.userGraphs)
}

// checkMemoryLimits ensures we don't exceed memory limits
// Must be called with write lock held
func (c *graphCacheImpl) checkMemoryLimits(userID string, newCached *CachedGraph) error {
	// Calculate current memory usage
	currentMemory := c.totalMemoryMBLocked()

	// Subtract old graph memory if replacing
	if old, exists := c.userGraphs[userID]; exists {
		currentMemory -= old.estimatedMB
	}

	// Calculate projected memory
	projectedMemory := currentMemory + newCached.estimatedMB

	// If over limit, evict LRU users until under limit
	if projectedMemory > float64(c.config.MaxCacheMemoryMB) {
		log.Infof("Graph cache memory limit approaching: %.2f MB / %d MB",
			projectedMemory, c.config.MaxCacheMemoryMB)

		excessMB := projectedMemory - float64(c.config.MaxCacheMemoryMB)
		c.evictLRU(excessMB)
	}

	return nil
}

// totalMemoryMBLocked returns total memory usage (must be called with lock held)
func (c *graphCacheImpl) totalMemoryMBLocked() float64 {
	var totalMB float64
	for _, cached := range c.userGraphs {
		totalMB += cached.estimatedMB
	}
	return totalMB
}

// evictLRU evicts least recently accessed users until targetMB is freed
// Must be called with write lock held
func (c *graphCacheImpl) evictLRU(targetMB float64) {
	// Create list of users sorted by last accessed time (oldest first)
	type userEntry struct {
		userID       string
		lastAccessed time.Time
		memoryMB     float64
	}

	var users []userEntry
	for userID, cached := range c.userGraphs {
		cached.mu.RLock()
		lastAccess := cached.LastAccessed
		cached.mu.RUnlock()

		users = append(users, userEntry{
			userID:       userID,
			lastAccessed: lastAccess,
			memoryMB:     cached.estimatedMB,
		})
	}

	// Sort by last accessed (oldest first)
	sort.Slice(users, func(i, j int) bool {
		return users[i].lastAccessed.Before(users[j].lastAccessed)
	})

	// Evict oldest users until target memory is freed
	var freedMB float64
	for _, user := range users {
		if freedMB >= targetMB {
			break
		}

		log.Infof("Evicting user %s due to memory limit (last accessed: %v ago, %.2f MB)",
			user.userID,
			time.Since(user.lastAccessed).Round(time.Second),
			user.memoryMB)

		delete(c.userGraphs, user.userID)
		freedMB += user.memoryMB
	}

	log.Infof("Freed %.2f MB by evicting %d users", freedMB, len(users))
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
		RefreshInterval:   refreshInterval,
		InactivityTimeout: inactivityTimeout,
		MaxCacheMemoryMB:  maxMemory,
	}
}

// Interface guard
var _ GraphCache = (*graphCacheImpl)(nil)
