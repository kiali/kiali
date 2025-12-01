# Phase 2: Requirements Definition - Metrics-Based Health Pre-Computation

**Approach**: Approach 5 - Metrics-Based Background Pre-Computation  
**Date**: 2025-11-25  
**Status**: In Progress

---

## Table of Contents

1. [Functional Requirements](#functional-requirements)
2. [Cache Structure Design](#cache-structure-design)
3. [Metrics Specification](#metrics-specification)
4. [API Contracts](#api-contracts)
5. [Configuration Schema](#configuration-schema)
6. [Background Job Design](#background-job-design)
7. [Integration Points](#integration-points)
8. [Non-Functional Requirements](#non-functional-requirements)
9. [Acceptance Criteria](#acceptance-criteria)
10. [Test Strategy](#test-strategy)
11. [Implementation Phases](#implementation-phases)

---

## Functional Requirements

### FR1: Background Health Computation

**Requirement**: System SHALL compute health data for all namespaces in all clusters at regular intervals in the background.

**Details**:

- Default interval: 2 minutes (configurable)
- Compute health for all entity types: apps, services, workloads
- Process all clusters sequentially (to avoid overwhelming Prometheus)
- Continue processing even if individual namespace computations fail
- Log errors but don't stop the entire refresh cycle

**Acceptance**:

- Background job runs on configured interval
- All accessible namespaces are processed
- Job completion time < refresh interval (doesn't fall behind)
- Failed namespace computations don't stop overall refresh

---

### FR2: Cache Storage

**Requirement**: System SHALL store computed health data in KialiCache with appropriate expiration.

**Details**:

- Store complete health objects (same structure as current API returns)
- Cache key structure: `health:{cluster}:{namespace}:{type}`
- All cached health uses the default rate interval (configured, typically "10m")
- Cache expiration: 3x refresh interval (6 minutes default) for staleness tolerance
- Thread-safe access to cache
- Cache survives across multiple refresh cycles

**Acceptance**:

- Health data retrievable from cache by key
- Cache entries expire after configured TTL
- No data races or corruption under concurrent access
- Cache persists between background refresh cycles

---

### FR3: API Handler Integration

**Requirement**: ClusterHealth endpoint SHALL serve health data from cache with ZERO breaking changes to API contract.

**Details**:

- Handler reads from cache instead of computing on-demand
- If cache miss (should be rare): return error indicating data not yet available
- API response structure remains identical
- Response times < 500ms for 100 namespaces
- Add optional response header indicating cache age

**Acceptance**:

- All existing API clients continue working without changes
- Response structure matches current implementation exactly
- P95 latency < 200ms, P99 latency < 500ms
- Cache hits > 99% after system is warmed up

---

### FR4: Prometheus Metrics Export

**Requirement**: System SHALL export computed health status as Prometheus metrics for observability.

**Details**:

- Export health grade/status (NOT raw error rates)
- Metrics updated during each background refresh
- Integrate with existing Kiali metrics endpoint
- Keep cardinality manageable (< 50k time series)
- Metrics available for Prometheus scraping immediately after computation

**Acceptance**:

- Metrics visible at `/metrics` endpoint
- Prometheus can scrape and store metrics successfully
- Cardinality stays within bounds (< 50k time series in test environment)
- Metrics update on each background refresh cycle

---

### FR5: Configuration Control

**Requirement**: System SHALL support configuration of refresh interval, cache TTL, and enable/disable flags.

**Details**:

- Configurable refresh interval (default: 2 minutes)
- Configurable cache expiration (default: 6 minutes)
- Feature flag to enable/disable background computation
- Feature flag to enable/disable metrics export
- Hot reload of configuration (pick up changes without restart)

**Acceptance**:

- Configuration changes take effect within one refresh cycle
- Invalid configuration values rejected with clear error messages
- System degrades gracefully when feature disabled (falls back to on-demand)
- Configuration documented in config schema

---

### FR6: Multi-Cluster Support

**Requirement**: System SHALL compute and cache health for all configured clusters.

**Details**:

- Process clusters sequentially (not in parallel)
- Use appropriate client for each cluster
- Handle cluster unavailability gracefully
- Cache health data per cluster independently
- Metrics include cluster label

**Acceptance**:

- Health computed for all accessible clusters
- Unavailable cluster doesn't block processing of other clusters
- Cache keys include cluster identifier
- Metrics include cluster dimension

---

## Cache Structure Design

### Cache Key Format

```
health:{cluster}:{namespace}:{type}
```

**Examples**:

```
health:cluster1:bookinfo:app
health:cluster1:bookinfo:service
health:cluster1:bookinfo:workload
health:cluster2:istio-system:app
```

**Rationale**:

- Clear hierarchical structure
- Easy to query/invalidate by cluster or namespace
- Rate interval not needed in key (dynamically calculated from refresh interval)
- Consistent with existing cache key patterns in Kiali
- Simpler key structure reduces complexity

---

### Cache Value Structure

Store the complete health object as returned by existing business layer methods:

```go
// For apps
type NamespaceAppHealth struct {
    // Map key is app name
    map[string]*models.AppHealth
}

// For services
type NamespaceServiceHealth struct {
    // Map key is service name
    map[string]*models.ServiceHealth
}

// For workloads
type NamespaceWorkloadHealth struct {
    // Map key is workload name
    map[string]*models.WorkloadHealth
}
```

**Metadata to include**:

```go
type CachedHealthData struct {
    Data          interface{} // One of the above types
    ComputedAt    time.Time   // When it was computed
    Cluster       string
    Namespace     string
    Type          string      // "app", "service", "workload"
    RateInterval  string      // The rate interval used (from config)
}
```

**Note**: `RateInterval` is stored in metadata for informational purposes and is dynamically calculated based on the refresh interval (e.g., if refresh interval is 2m, rate interval might be "2m" or "4m").

**Rationale**:

- Reuse existing data structures (no new models needed)
- Store metadata for staleness tracking
- Enables future features (cache age in responses)
- Simple serialization/deserialization

---

### Cache Integration with KialiCache

Add new store to `kialiCacheImpl`:

```go
type kialiCacheImpl struct {
    // ... existing fields ...

    // New field for health data
    healthStore store.Store[string, *CachedHealthData]
}
```

Add new interface methods:

```go
type KialiCache interface {
    // ... existing methods ...

    // GetHealth returns cached health data for a namespace
    GetHealth(cluster, namespace, healthType string) (*CachedHealthData, bool)

    // SetHealth stores health data in cache
    SetHealth(cluster, namespace, healthType string, data *CachedHealthData)

    // Health returns the underlying health store for direct access if needed
    Health() store.Store[string, *CachedHealthData]
}
```

---

## Metrics Specification

### Metric Naming Convention

Follow Kiali's existing convention: `kiali_*`

### Metrics to Export

#### 1. Namespace App Health Status

```promql
kiali_namespace_app_health_status{cluster="cluster1",namespace="bookinfo",app="reviews"} 0
```

**Labels**:

- `cluster`: Cluster name
- `namespace`: Namespace name
- `app`: Application name

**Values**:

- `0` = Healthy
- `1` = Degraded
- `2` = Failure
- `3` = Unknown/Not Available

---

#### 2. Namespace Service Health Status

```promql
kiali_namespace_service_health_status{cluster="cluster1",namespace="bookinfo",service="reviews"} 0
```

**Labels**:

- `cluster`: Cluster name
- `namespace`: Namespace name
- `service`: Service name

**Values**: Same as app health (0-3)

---

#### 3. Namespace Workload Health Status

```promql
kiali_namespace_workload_health_status{cluster="cluster1",namespace="bookinfo",workload="reviews-v1"} 1
```

**Labels**:

- `cluster`: Cluster name
- `namespace`: Namespace name
- `workload`: Workload name

**Values**: Same as app health (0-3)

---

#### 4. Background Job Metrics (Operational)

```promql
# Last successful refresh timestamp
kiali_health_cache_last_refresh_timestamp{cluster="cluster1"} 1732550400

# Refresh duration in seconds
kiali_health_cache_refresh_duration_seconds{cluster="cluster1"} 45.2

# Number of namespaces processed
kiali_health_cache_namespaces_processed{cluster="cluster1",status="success"} 95
kiali_health_cache_namespaces_processed{cluster="cluster1",status="failed"} 5

# Cache size (total entries)
kiali_health_cache_entries 285
```

---

### Cardinality Analysis

**Conservative Estimate** (100 namespaces, 3 clusters):

- Apps per namespace: ~15
- Services per namespace: ~15
- Workloads per namespace: ~20
- Total entities: 100 ns × (15 + 15 + 20) × 3 clusters = **15,000 time series**

**Large Deployment** (300 namespaces, 3 clusters):

- Total entities: 300 ns × 50 entities × 3 clusters = **45,000 time series**

**Operational metrics**: ~10 time series

**Total**: Under 50,000 time series even in large deployments ✅

---

### Metrics Export Implementation

Leverage existing Kiali metrics infrastructure:

**Location**: Metrics should be registered and exported via the existing metrics system.

**Integration Point**:

- Register metrics in `server/server.go` or dedicated metrics package
- Update metrics during background refresh cycle
- Prometheus scrapes standard `/metrics` endpoint

**Metric Types**:

- Use `prometheus.GaugeVec` for health status (current state)
- Use `prometheus.Gauge` for operational metrics (refresh time, cache size)
- Use `prometheus.CounterVec` for namespace processing counts

---

## API Contracts

### Existing Endpoint: GET /api/clusters/health

**Current Behavior**: Computes health on-demand  
**New Behavior**: Returns cached health data

**Request Parameters** (NO CHANGES):

```
- namespaces (optional): Comma-separated list of namespace names
- type (optional): "app", "service", or "workload" (default: "app")
- rateInterval (optional): Rate interval string (default: "10m")
  - NOTE: Cached health computed using refresh-interval-based rate interval
  - User-requested rateInterval parameter is IGNORED (returns cached data regardless)
  - Future enhancement could support on-demand computation for non-cached intervals
- queryTime (optional): Unix timestamp for historical queries
  - NOTE: Ignored in Phase 1; always returns current cached data
- cluster (optional): Cluster name
```

**Response Structure** (NO CHANGES):

```json
{
  "appHealth": {
    "bookinfo": {
      "reviews": {
        "requests": {
          "errorRatio": 0.05,
          "inboundErrorRatio": 0.02,
          "outboundErrorRatio": 0.03
        },
        "workloadStatuses": [...]
      }
    }
  },
  "serviceHealth": {...},
  "workloadHealth": {...}
}
```

**New Response Headers** (OPTIONAL - additive only):

```
X-Kiali-Health-Cache-Age: 45
X-Kiali-Health-Cached: true
```

**Error Handling**:

**Cache Miss Scenario** (should be rare):

```json
{
  "error": "Health data not yet available, background computation in progress",
  "code": 503
}
```

Return HTTP 503 (Service Unavailable) with `Retry-After` header.

**Fallback Option** (for discussion):

- Option A: Return 503 and let client retry
- Option B: Compute on-demand as fallback (defeats purpose of pre-computation)
- **Recommendation**: Option A (strict pre-computation, no cache misses)

---

## Configuration Schema

### New Configuration Section

```yaml
health:
  # Enable/disable background health computation
  cache_enabled: true

  # Background refresh interval
  cache_refresh_interval: 2m

  # Cache expiration (should be > refresh_interval)
  # Recommended: 3x refresh interval
  cache_expiration: 6m

  # Enable/disable Prometheus metrics export for health data
  metrics_export_enabled: true

  # Prometheus query rate interval calculation
  # Options: "match_refresh" (use refresh_interval), "2x_refresh", or explicit value like "5m"
  # Default: "match_refresh" means if refresh_interval=2m, query Prometheus for last 2m
  rate_interval_strategy: "match_refresh"

  # Maximum time allowed for background refresh to complete
  # If exceeded, log warning but continue
  refresh_timeout: 5m

  # Stagger cluster processing (add delay between clusters)
  # Helps avoid overwhelming Prometheus
  cluster_processing_delay: 10s
```

### Config Validation Rules

- `cache_refresh_interval` must be >= 30s (minimum)
- `cache_expiration` must be >= `cache_refresh_interval` × 1.5
- `refresh_timeout` must be >= `cache_refresh_interval`
- `rate_interval_strategy` must be "match_refresh", "2x_refresh", or valid Prometheus duration

### Environment Variable Overrides

Follow existing Kiali patterns:

```bash
HEALTH_CACHE_ENABLED=false
HEALTH_CACHE_REFRESH_INTERVAL=5m
HEALTH_METRICS_EXPORT_ENABLED=true
```

---

## Background Job Design

### Component: HealthCacheService

**Location**: `business/health_cache_service.go` (new file)

**Structure**:

```go
type HealthCacheService struct {
    businessLayer *Layer
    conf          *config.Config
    cache         cache.KialiCache
    stopCh        chan struct{}
    wg            sync.WaitGroup
}

func NewHealthCacheService(layer *Layer, conf *config.Config, cache cache.KialiCache) *HealthCacheService

func (s *HealthCacheService) Start()
func (s *HealthCacheService) Stop()
func (s *HealthCacheService) refreshHealthCache()
func (s *HealthCacheService) refreshClusterHealth(cluster string)
func (s *HealthCacheService) refreshNamespaceHealth(cluster, namespace string)
```

**Initialization**: Called from `main.go` or `server/server.go` after business layer is created

---

### Background Job Algorithm

```
Main Loop (runs every cache_refresh_interval):
  1. Get list of all clusters from cache
  2. For each cluster:
     a. Get list of all namespaces in cluster
     b. For each namespace:
        - Compute app health
        - Store in cache
        - Export metrics
        - Delay cluster_processing_delay if configured
        - Compute service health
        - Store in cache
        - Export metrics
        - Compute workload health
        - Store in cache
        - Export metrics
     c. Update operational metrics (refresh time, success/fail counts)
  3. Log completion summary
  4. Wait for next interval
```

**Error Handling**:

- Log errors for individual namespace failures
- Continue processing remaining namespaces
- Track failure count in metrics
- Don't abort entire refresh cycle

**Graceful Shutdown**:

- Listen on `stopCh` channel
- Allow current refresh to complete (up to refresh_timeout)
- Use `sync.WaitGroup` to ensure goroutine completes

---

### Concurrency Model

**Phase 1**: Sequential processing (simplest, lowest risk)

- Process clusters sequentially
- Process namespaces sequentially within each cluster
- No parallelization

**Rationale**:

- Avoids overwhelming Prometheus with parallel queries
- Simpler error handling
- Easier to debug and reason about
- Sufficient for initial implementation

**Future Enhancement**: Parallel processing with semaphore/worker pool

- Can be added later if refresh time exceeds interval
- Use semaphore to limit concurrent Prometheus queries
- Process multiple namespaces in parallel per cluster

---

## Integration Points

### 1. Business Layer Integration

**File**: `business/health.go`

**Current Methods** (reuse as-is):

- `GetNamespaceAppHealth()`
- `GetNamespaceServiceHealth()`
- `GetNamespaceWorkloadHealth()`

**New Methods** (optional helpers):

```go
// GetHealthFromCache retrieves cached health data
func (hs *HealthService) GetHealthFromCache(
    cluster, namespace, healthType string,
) (*CachedHealthData, bool)

// CalculateRateInterval computes the rate interval based on refresh interval and strategy
func (hs *HealthService) CalculateRateInterval() string
```

**No Changes Required**: Background job calls existing methods

---

### 2. Handler Integration

**File**: `handlers/health.go`

**Function**: `ClusterHealth()`

**Changes Required**:

```go
// Current flow:
// 1. Loop through namespaces
// 2. Call business layer to compute health
// 3. Return results

// New flow:
// 1. Loop through namespaces
// 2. Read health from cache
// 3. If cache miss: return 503
// 4. Return results
```

**Backward Compatibility**:

- Response structure unchanged
- Query parameters unchanged
- Only internal data source changes (compute → cache)

---

### 3. KialiCache Integration

**File**: `cache/cache.go`

**Changes**:

1. Add `healthStore` field to `kialiCacheImpl`
2. Add `GetHealth()` and `SetHealth()` methods to interface
3. Initialize store in `NewKialiCache()`
4. Add cache key helper functions

**Store Configuration**:

- Use `store.Store[string, *CachedHealthData]`
- Set expiration based on config: `health.cache_expiration`
- Thread-safe access (store already provides this)

---

### 4. Metrics Integration

**File**: `server/server.go` or new `metrics/health_metrics.go`

**Changes**:

1. Register health status metrics on startup
2. Expose metrics update function to background job
3. Ensure metrics cleared/updated on each refresh

**Prometheus Integration**:

- No changes to Prometheus scraping config needed
- Metrics automatically available at `/metrics` endpoint
- Standard Prometheus client library handles exposition

---

### 5. Configuration Integration

**File**: `config/config.go`

**Changes**:

1. Add `Health` struct with cache configuration fields
2. Add validation for configuration values
3. Add environment variable mapping

**Example**:

```go
type Health struct {
    CacheEnabled           bool          `yaml:"cache_enabled" json:"cacheEnabled"`
    CacheRefreshInterval   time.Duration `yaml:"cache_refresh_interval" json:"cacheRefreshInterval"`
    CacheExpiration        time.Duration `yaml:"cache_expiration" json:"cacheExpiration"`
    MetricsExportEnabled   bool          `yaml:"metrics_export_enabled" json:"metricsExportEnabled"`
    RateIntervalStrategy   string        `yaml:"rate_interval_strategy" json:"rateIntervalStrategy"`
    RefreshTimeout         time.Duration `yaml:"refresh_timeout" json:"refreshTimeout"`
    ClusterProcessingDelay time.Duration `yaml:"cluster_processing_delay" json:"clusterProcessingDelay"`
}
```

---

## Non-Functional Requirements

### NFR1: Performance

- **Latency**: P95 < 200ms, P99 < 500ms for ClusterHealth requests
- **Throughput**: Support 100+ concurrent health requests without degradation
- **Refresh Time**: Background refresh completes within configured interval
- **Prometheus Load**: No more than 1 query per namespace per type per refresh cycle

---

### NFR2: Reliability

- **Cache Hit Rate**: > 99% after system warm-up (first refresh cycle)
- **Error Recovery**: Individual failures don't stop overall refresh
- **Graceful Degradation**: System continues if single cluster unavailable
- **Data Consistency**: Cache always reflects latest refresh, no stale data served beyond TTL

---

### NFR3: Observability

- **Logging**:
  - INFO: Refresh cycle start/complete with summary
  - WARN: Individual namespace failures
  - ERROR: Critical failures (can't access cache, config invalid)
  - DEBUG: Detailed timing per namespace
- **Metrics**:
  - Refresh duration per cluster
  - Success/failure counts
  - Cache size
  - Last refresh timestamp
- **Health Checks**:
  - Background job running status
  - Time since last successful refresh
  - Cache availability

---

### NFR4: Scalability

- **Namespace Limit**: Support up to 500 namespaces per cluster
- **Cluster Limit**: Support up to 5 clusters
- **Memory Usage**: < 50MB for health cache data
- **Metric Cardinality**: < 50k time series
- **CPU Usage**: Background refresh spikes acceptable, < 5% average CPU

---

### NFR5: Maintainability

- **Code Clarity**: Well-documented, follows existing Kiali patterns
- **Testability**: Unit tests for all core functions, integration tests for full flow
- **Configuration**: All tunable parameters externalized to config
- **Extensibility**: Design allows future enhancements (parallel processing, smarter refresh strategies)

---

## Acceptance Criteria

### AC1: Background Job Runs Successfully

- [ ] Background job starts automatically when Kiali starts
- [ ] Job runs on configured interval (default: 2 minutes)
- [ ] Job processes all clusters and namespaces
- [ ] Job completes within refresh interval (doesn't fall behind)
- [ ] Job stops gracefully when Kiali shuts down

---

### AC2: Health Data Cached Correctly

- [ ] All namespace health data stored in cache after first refresh
- [ ] Cache keys follow defined format
- [ ] Cache entries expire after configured TTL
- [ ] Cache data matches structure of existing API responses
- [ ] Cache survives across multiple refresh cycles

---

### AC3: API Returns Cached Data

- [ ] ClusterHealth endpoint returns data from cache (not computing)
- [ ] Response structure identical to current implementation
- [ ] Response time < 200ms P95, < 500ms P99
- [ ] Cache hit rate > 99% after warm-up
- [ ] Handles multi-cluster requests correctly

---

### AC4: Metrics Exported Successfully

- [ ] Health status metrics visible at /metrics endpoint
- [ ] Metrics include all required labels (cluster, namespace, entity name)
- [ ] Metrics update on each background refresh
- [ ] Operational metrics show job health (refresh time, counts)
- [ ] Cardinality stays under 50k time series

---

### AC5: Configuration Works Correctly

- [ ] All config parameters can be set via YAML
- [ ] All config parameters can be overridden via environment variables
- [ ] Invalid configuration rejected with clear error messages
- [ ] Config changes picked up within one refresh cycle
- [ ] Feature can be disabled (falls back to on-demand computation)

---

### AC6: Error Handling Robust

- [ ] Individual namespace failures logged but don't stop refresh
- [ ] Unavailable cluster doesn't block other clusters
- [ ] Cache unavailability handled gracefully
- [ ] Invalid rate intervals handled gracefully
- [ ] System logs clear error messages for debugging

---

### AC7: Zero Breaking Changes

- [ ] All existing API clients work without modification
- [ ] Response structure byte-for-byte identical (minus optional headers)
- [ ] Query parameters work identically
- [ ] Error responses follow existing patterns
- [ ] No changes required to UI or external integrations

---

### AC8: Observability Sufficient

- [ ] Logs show refresh cycle start/complete with timing
- [ ] Logs show namespace processing failures with details
- [ ] Metrics allow monitoring job health in Prometheus/Grafana
- [ ] Metrics allow alerting on stale data or job failures
- [ ] Debug logging provides detailed troubleshooting info

---

## Test Strategy

### Unit Tests

**Target Coverage**: > 80%

**Files to Test**:

1. `business/health_cache_service.go`

   - Background job start/stop
   - Refresh cycle logic
   - Error handling
   - Graceful shutdown

2. `cache/cache.go` (health-related additions)

   - GetHealth() returns cached data correctly
   - SetHealth() stores data correctly
   - Cache key generation
   - Expiration behavior

3. `handlers/health.go` (modified)

   - Cache read logic
   - Cache miss handling
   - Response structure unchanged

4. Metrics registration and update
   - Metrics registered correctly
   - Metrics update on refresh
   - Metric values correct

**Mocking**:

- Mock Prometheus client (don't make real queries)
- Mock Kubernetes client (don't access real cluster)
- Mock cache for handler tests
- Mock time for expiration tests

---

### Integration Tests

**Scenarios**:

1. **End-to-End Happy Path**

   - Start Kiali with health cache enabled
   - Wait for first refresh cycle to complete
   - Query ClusterHealth endpoint
   - Verify data returned from cache
   - Verify metrics exported

2. **Multi-Cluster**

   - Configure 3 test clusters
   - Verify all clusters processed
   - Verify cache has data for all clusters
   - Verify metrics have cluster labels

3. **Error Handling**

   - Simulate Prometheus unavailable
   - Verify job continues after errors
   - Verify error metrics incremented
   - Verify other namespaces still processed

4. **Configuration Changes**

   - Start with cache enabled
   - Change refresh interval
   - Verify new interval takes effect
   - Disable cache
   - Verify fallback behavior

5. **Cache Expiration**

   - Set short expiration (1 minute)
   - Wait for expiration
   - Verify old data removed
   - Verify new data populated on next refresh

6. **Graceful Shutdown**
   - Start background job
   - Trigger shutdown during refresh
   - Verify job completes gracefully
   - Verify no goroutine leaks

---

### Performance Tests

**Test Environment**:

- 100 namespaces
- 3 clusters
- 50 entities per namespace

**Tests**:

1. **Refresh Duration**

   - Measure time to complete full refresh cycle
   - Target: < 2 minutes (within configured interval)
   - Run 10 cycles, verify consistent timing

2. **API Latency**

   - Query ClusterHealth for all 100 namespaces
   - Measure P50, P95, P99 latency
   - Target: P95 < 200ms, P99 < 500ms
   - Run 1000 requests, verify consistent

3. **Memory Usage**

   - Measure memory before first refresh
   - Measure memory after first refresh
   - Measure memory after 10 refresh cycles
   - Target: < 50MB increase
   - Verify no memory leaks

4. **Prometheus Load**

   - Count Prometheus queries during refresh
   - Target: Exactly 3 queries per namespace (app, service, workload)
   - Verify no redundant queries

5. **Concurrent Requests**
   - 100 concurrent ClusterHealth requests
   - Verify all return successfully
   - Verify latency doesn't degrade
   - Verify cache hit rate > 99%

---

### Manual Testing Checklist

- [ ] Verify metrics visible in Prometheus UI
- [ ] Verify health data visible in Kiali UI (no visible change to user)
- [ ] Verify logs show refresh cycles
- [ ] Verify configuration changes take effect
- [ ] Verify graceful shutdown doesn't leave orphaned goroutines
- [ ] Verify cache disabled mode works (fallback to on-demand)
- [ ] Test with single cluster and multi-cluster
- [ ] Test with many namespaces (100+)
- [ ] Test with empty cluster (no namespaces)

---

## Implementation Phases

### Phase 1: Core Infrastructure (2 days)

**Goal**: Background job and cache storage working

**Tasks**:

1. Add health store to KialiCache

   - Add `healthStore` field to `kialiCacheImpl`
   - Implement `GetHealth()` and `SetHealth()` methods
   - Add cache key helper functions
   - Write unit tests

2. Create HealthCacheService

   - Implement background job structure
   - Implement start/stop methods
   - Implement basic refresh loop
   - Add logging
   - Write unit tests

3. Add configuration schema

   - Add Health config struct
   - Add validation
   - Add environment variable mapping
   - Update config documentation

4. Wire up initialization
   - Initialize HealthCacheService in server startup
   - Start background job
   - Handle shutdown

**Deliverable**: Background job runs and stores data in cache

---

### Phase 2: Handler Integration (1 day)

**Goal**: API endpoint serves from cache

**Tasks**:

1. Modify ClusterHealth handler

   - Add cache read logic
   - Handle cache miss (return 503)
   - Add optional response headers
   - Preserve exact response structure
   - Write unit tests

2. Integration testing

   - Test cache hit path
   - Test cache miss path
   - Test response structure unchanged
   - Test multi-cluster queries

3. Performance testing
   - Measure latency improvement
   - Verify cache hit rate
   - Load test with many namespaces

**Deliverable**: API endpoint returns cached data with improved performance

---

### Phase 3: Metrics Export (1 day)

**Goal**: Health status exported as Prometheus metrics

**Tasks**:

1. Define and register metrics

   - Health status metrics (app, service, workload)
   - Operational metrics (refresh time, counts)
   - Register in metrics system
   - Write unit tests

2. Update background job

   - Export metrics during refresh cycle
   - Clear old metrics before updating
   - Handle label management
   - Add error handling

3. Verify metrics
   - Test metrics endpoint
   - Verify cardinality
   - Test with Prometheus scraping
   - Verify metrics update on refresh

**Deliverable**: Health metrics available in Prometheus

---

### Phase 4: Testing & Documentation (1 day)

**Goal**: Comprehensive testing and documentation

**Tasks**:

1. Write integration tests

   - End-to-end scenarios
   - Error handling scenarios
   - Multi-cluster scenarios
   - Configuration scenarios

2. Performance testing

   - Measure refresh duration
   - Measure API latency
   - Measure memory usage
   - Measure Prometheus load

3. Documentation

   - Update API documentation
   - Update configuration documentation
   - Add operator guide (how to monitor health cache)
   - Add troubleshooting guide

4. Code review preparation
   - Clean up code
   - Add comments
   - Run linters
   - Check test coverage

**Deliverable**: Fully tested and documented feature ready for review

---

### Phase 5: Refinement & Bug Fixes (0.5-1 day buffer)

**Goal**: Address feedback and edge cases

**Tasks**:

- Fix bugs found in testing
- Address code review feedback
- Performance tuning if needed
- Edge case handling

**Deliverable**: Production-ready implementation

---

## Open Questions & Decisions Needed

### Q1: Cache Miss Behavior

**Question**: When cache miss occurs (rare), should we:

- A) Return 503 and force client to retry
- B) Fall back to on-demand computation
- C) Return partial data (what's in cache) with indicator

**Recommendation**: Option A (strict pre-computation)

- Aligns with "no cache misses" requirement
- Simpler implementation
- Clearer semantics

**Decision**: [ ] Pending

---

### Q2: Metrics Cardinality Management

**Question**: If cardinality exceeds limits, should we:

- A) Drop metrics for least important namespaces
- B) Aggregate metrics at namespace level (lose entity granularity)
- C) Make metrics export optional per namespace (config)
- D) Do nothing (assume infrastructure can handle it)

**Recommendation**: Option D initially, add limiting later if needed

**Decision**: [ ] Pending

---

### Q3: Historical Query Support

**Question**: Should initial implementation support historical queries?

- A) Yes, support `queryTime` parameter by querying Prometheus
- B) No, always return current cached data (ignore queryTime)
- C) Return error for historical queries (not yet supported)

**Recommendation**: Option B (simplest, matches pre-computed model)

**Decision**: [ ] Pending

---

### Q4: Rate Interval Flexibility

**Question**: Should we cache health for multiple rate intervals?

- A) Yes, cache for 5m, 10m, 1h (common intervals)
- B) No, only cache for default (10m), compute others on-demand
- C) Make it configurable

**Recommendation**: Option B initially (keep it simple)

**Decision**: ✅ **DECIDED - Option B**: Only cache for default rate interval

**Rationale**:

- Simplifies cache key structure (no rateInterval in key)
- Reduces cache memory usage
- Users typically use default interval in UI
- Non-default intervals rare, acceptable to compute on-demand if requested
- Can be enhanced later if needed

**Implementation Notes**:

- If user requests health with non-default rate interval, API should:
  - Option A: Return cached data anyway (ignore requested interval)
  - Option B: Return error indicating only default interval cached
  - Option C: Fall back to on-demand computation for that request
- **Recommended**: Option A (return cached data, document behavior)

---

### Q5: Feature Flag Strategy

**Question**: How should the feature be rolled out?

- A) Enabled by default (opt-out)
- B) Disabled by default (opt-in)
- C) Enabled by default with automatic fallback on errors

**Recommendation**: Option A (enabled by default, given it solves real problem)

**Decision**: [ ] Pending

---

## Success Metrics (Post-Implementation)

### Performance Improvements

**Baseline** (current on-demand):

- ClusterHealth for 100 namespaces: ~10-15 seconds
- Prometheus queries per request: 100-300
- P95 latency: > 10 seconds
- P99 latency: > 20 seconds

**Target** (with caching):

- ClusterHealth for 100 namespaces: < 500ms
- Prometheus queries per user request: 0
- P95 latency: < 200ms
- P99 latency: < 500ms

### Operational Metrics

- Cache hit rate: > 99%
- Background refresh duration: < 2 minutes
- Memory overhead: < 50MB
- Metric cardinality: < 50k time series
- Failed namespace computations: < 1%

### User Experience

- Consistent UI response times (no "first load" penalty)
- No observable changes to UI behavior
- No breaking changes to API
- Health always available (no loading states)

---

## Risk Assessment & Mitigation

### Risk 1: Refresh Time Exceeds Interval

**Impact**: Cache becomes stale, system falls behind

**Mitigation**:

- Monitor refresh duration via metrics
- Alert if refresh time > 80% of interval
- Add parallel processing if needed (future enhancement)
- Make interval configurable per deployment size

### Risk 2: Prometheus Overload During Refresh

**Impact**: Prometheus performance degrades

**Mitigation**:

- Process clusters sequentially
- Add configurable delay between namespaces
- Monitor Prometheus query rate
- Consider query batching (future enhancement)

### Risk 3: Cache Memory Usage Too High

**Impact**: Kiali memory exhaustion

**Mitigation**:

- Monitor cache size via metrics
- Set reasonable TTL for cache expiration
- Consider namespace filtering (only cache accessed namespaces)
- Profile memory usage during testing

### Risk 4: Metric Cardinality Too High

**Impact**: Prometheus performance issues

**Mitigation**:

- Start with conservative entity count estimates
- Monitor cardinality in test environment
- Make metrics export optional (config flag)
- Consider metric aggregation if needed

### Risk 5: Breaking Changes to API

**Impact**: External integrations break

**Mitigation**:

- Extensive testing of response structure
- Byte-for-byte comparison with current responses
- Integration tests with actual UI
- Beta testing period before release

---

## Dependencies

### Internal Dependencies

- KialiCache infrastructure (exists)
- Business layer health methods (exists)
- Prometheus client (exists)
- Metrics registration system (exists)
- Configuration system (exists)

### External Dependencies

- Prometheus running and accessible
- Kubernetes clusters accessible
- Sufficient memory for cache storage
- Metrics scraping configured

---

## Future Enhancements (Out of Scope for Phase 1)

### 1. Historical Health Queries

**Description**: Support querying historical health data via `queryTime` parameter

**Approach**: Query Prometheus for historical health metrics

**Benefit**: Enable trend analysis, time-series visualization

**Effort**: 2-3 days

---

### 2. Smart Refresh Strategies

**Description**: Only refresh "hot" namespaces more frequently, others less frequently

**Approach**: Track access patterns, adjust refresh frequency

**Benefit**: Reduce resource usage while maintaining performance for active namespaces

**Effort**: 3-4 days

---

### 3. Parallel Namespace Processing

**Description**: Process multiple namespaces concurrently during refresh

**Approach**: Worker pool with semaphore limiting

**Benefit**: Reduce overall refresh time for large clusters

**Effort**: 2-3 days

---

### 4. Incremental Cache Updates

**Description**: Only refresh namespaces that have changed since last refresh

**Approach**: Watch for namespace/workload changes, trigger targeted refresh

**Benefit**: Further reduce Prometheus load and refresh time

**Effort**: 4-5 days

---

### 5. Health Trend Dashboard

**Description**: Grafana dashboard showing health trends over time

**Approach**: Use exported Prometheus metrics

**Benefit**: Better visibility into service health patterns

**Effort**: 1-2 days (mostly dashboard design)

---

## Conclusion

This requirements document defines the complete scope for implementing Approach 5 (Metrics-Based Background Pre-Computation) for health data caching in Kiali. The implementation is broken into 5 phases spanning 4-5 days of development effort.

**Key Success Factors**:

1. Zero breaking changes to existing API
2. Predictable performance (no cold starts)
3. Observable system (metrics for monitoring)
4. Configurable behavior (tunable for different deployments)
5. Robust error handling (failures don't cascade)

**Next Steps**:

1. Review this requirements document
2. Make decisions on open questions
3. Proceed to Phase 3: Detailed Design
4. Begin implementation with Phase 1 tasks

---

**Document Status**: ✅ Complete - Ready for Review
