# Problem Analysis: Health Data Pre-Computing and Caching

## Current State Assessment

### How Health is Currently Calculated

Health information in Kiali is currently calculated **on-demand at request time** with no pre-computation or caching. When a user requests cluster health via the `/api/clusters/health` endpoint (line 1137 in `routing/routes.go`), the following occurs:

1. **Handler Layer** (`handlers/health.go:ClusterHealth`)

   - Receives request with optional namespace filter
   - Loops through all requested namespaces
   - Calls business layer for each namespace/type combination

2. **Business Layer** (`business/health.go`)

   - `GetNamespaceAppHealth()` - Fetches app entities from K8s
   - `GetNamespaceServiceHealth()` - Fetches services from K8s
   - `GetNamespaceWorkloadHealth()` - Fetches workloads from K8s
   - **Makes fresh Prometheus queries** for request rates (`GetAllRequestRates`, `GetNamespaceServicesRequestRates`)
   - Aggregates metrics with workload status data

3. **Prometheus Layer** (`prometheus/cache.go`)
   - Currently has **query-level caching** for Prometheus request rates
   - Cache duration: configurable via `CacheDuration` (default: depends on config)
   - Cache expiration: configurable via `CacheExpiration` (global periodic flush)
   - Caches are keyed by: namespace, cluster, resource name, rate interval, and query time

### Existing Caching Infrastructure

Kiali already has several caching mechanisms:

1. **KialiCache** (`cache/cache.go`)

   - Caches: mesh config, clusters, namespaces, proxy status, registry status, validations
   - Uses expiration-based store (`store.Store` with TTL support)
   - Example expirations: IstioStatus (30s), Mesh (20s), Gateway (4m)

2. **Kubernetes Cache** (controller-runtime cache)

   - Caches K8s resources: Pods, Services, Deployments, Istio resources
   - Uses watchers for real-time sync
   - Duration: 5 minutes (configurable via `KubernetesConfig.CacheDuration`)

3. **Prometheus Cache** (`prometheus/cache.go`)

   - Caches individual Prometheus query results
   - **Only caches query results, not computed health**
   - Background goroutine periodically flushes all caches
   - Keys include queryTime, making it time-sensitive

4. **Background Refresh Pattern** (`business/controlplane_monitor.go`)
   - Example: `PollIstiodForProxyStatus()` polls every N seconds
   - Updates proxy status and registry status in cache
   - Pattern we can leverage for health data

## Problem Statement

### Core Issue

**Health calculation is expensive and synchronous**, causing:

- High latency when querying many namespaces
- Repeated Prometheus queries for the same data
- Poor user experience in large clusters (100+ namespaces)
- Unnecessary load on Prometheus

### Performance Characteristics

- Each namespace health query triggers:
  - 1-3 Prometheus queries (depending on type: app/service/workload)
  - K8s queries for workloads/services (partially cached)
  - Metric aggregation and health computation
- With 100 namespaces: 100-300 Prometheus queries per ClusterHealth request
- Current Prometheus cache helps with **repeated identical queries** but not **pre-computed health**

### Success Criteria

1. **Reduced latency**: ClusterHealth response time < 500ms for 100 namespaces
2. **Reduced Prometheus load**: 90%+ reduction in query volume for typical UI usage patterns
3. **Freshness**: Health data should be "fresh enough" (configurable staleness tolerance)
4. **Zero breaking changes**: Existing API contracts must remain intact
5. **Configurable**: Cache behavior should be tunable via configuration
6. **Observability**: Cache hit rates and staleness metrics should be exposed

## Solution Approaches

### Approach 1: Background Job with Full Pre-Computation

**Overview**: Introduce a background worker that periodically computes and caches health for all namespaces in all clusters.

**Architecture**:

- New `HealthCacheService` component
- Background goroutine polls every N seconds (configurable, e.g., 30s)
- Computes health for all namespaces and stores in `KialiCache`
- Handler serves directly from cache

**Pros**:

- ✅ Predictable performance - consistent response times
- ✅ Maximum Prometheus query reduction
- ✅ Simple handler logic - just read from cache
- ✅ Can leverage existing background job pattern (like `PollIstiodForProxyStatus`)
- ✅ Easy to add metrics for staleness and refresh duration

**Cons**:

- ❌ Wastes resources computing health for namespaces users don't view
- ❌ Potential stale data for up to refresh interval
- ❌ Higher baseline resource usage in large clusters
- ❌ May overwhelm Prometheus during refresh cycle
- ❌ Complex handling of multi-cluster scenarios

**Complexity**: Medium
**Development Effort**: 3-5 days

---

### Approach 2: On-Demand Caching with Lazy Population

**Overview**: Cache health data on first request, serve from cache on subsequent requests until TTL expires.

**Architecture**:

- Add health data to `KialiCache` using existing `store.Store` with expiration
- Handler checks cache first, computes and caches on miss
- Each health entry has independent TTL (e.g., 30s)
- No background workers needed

**Pros**:

- ✅ Only computes health for namespaces actually requested
- ✅ Simpler implementation - leverage existing store infrastructure
- ✅ Lower baseline resource usage
- ✅ Natural fit with existing cache patterns
- ✅ Easy to configure TTL per health type

**Cons**:

- ❌ First request per namespace still has latency (cache miss)
- ❌ Thundering herd problem if many namespaces requested simultaneously after TTL expires
- ❌ Inconsistent response times (fast on hit, slow on miss)
- ❌ Doesn't fully solve "cluster health" query with many namespaces

**Complexity**: Low
**Development Effort**: 2-3 days

---

### Approach 3: Hybrid - On-Demand with Background Warming

**Overview**: Combine on-demand caching with intelligent background warming for frequently accessed namespaces.

**Architecture**:

- Primary: On-demand lazy caching (Approach 2)
- Secondary: Background worker tracks "hot" namespaces (access frequency)
- Worker pre-warms cache only for frequently accessed namespaces
- Configurable threshold for "hot" (e.g., accessed 3+ times in last 5 minutes)

**Pros**:

- ✅ Best of both worlds - efficient resource usage + predictable performance for common cases
- ✅ Adapts to actual usage patterns
- ✅ Lower Prometheus load than full pre-computation
- ✅ Better user experience for frequently viewed namespaces
- ✅ Graceful degradation - works even if background worker fails

**Cons**:

- ❌ Most complex implementation
- ❌ Requires tracking access patterns (additional state)
- ❌ Tuning thresholds may be challenging
- ❌ Still has cold start problem for infrequently accessed namespaces

**Complexity**: High
**Development Effort**: 5-7 days

---

### Approach 4: Smart Aggregation with Namespace Batching

**Overview**: Optimize the ClusterHealth query itself by batching Prometheus queries and parallelizing computation.

**Architecture**:

- Keep current on-demand model
- Add batched Prometheus query support
- Parallelize health computation across namespaces using goroutines
- Cache individual namespace results with TTL
- Query-level optimizations (e.g., single Prometheus query for all namespaces)

**Pros**:

- ✅ Directly addresses the "100 namespace" problem
- ✅ Can combine with on-demand caching for incremental improvement
- ✅ Doesn't change the fundamental model
- ✅ Prometheus already supports multi-namespace queries
- ✅ Lower risk - iterative improvements possible

**Cons**:

- ❌ Doesn't eliminate the synchronous computation issue
- ❌ Still makes Prometheus queries on every cluster health request (unless cached)
- ❌ Complex Prometheus query construction
- ❌ Parallelization adds concurrency complexity

**Complexity**: Medium
**Development Effort**: 3-4 days

---

### Approach 5: Metrics-Based Background Pre-Computation

**Overview**: Background job pre-computes health at regular intervals, stores in cache, and exports health status as Prometheus metrics for observability.

**Architecture**:

- Background worker runs every N minutes (default: 2 minutes, configurable)
- Computes full health for all namespaces across all clusters
- Stores complete health data in KialiCache (same as Approach 1)
- Exports simplified health **status/grade** as Prometheus metrics
- Handler serves health from cache (fast lookup)
- Leverages existing Kiali metrics infrastructure

**Data Flow**:

```
Background Job (every 2min)
    ↓
Compute Health → Store in Cache → Export Metrics
                      ↓               ↓
                  API Handler    Prometheus
                 (return cached)  (for observability)
```

**Metrics Structure** (health grade only, not raw error rates):

```promql
kiali_namespace_app_health_status{cluster="c1",namespace="ns",app="reviews"} 0
kiali_namespace_service_health_status{cluster="c1",namespace="ns",service="reviews"} 1
kiali_namespace_workload_health_status{cluster="c1",namespace="ns",workload="reviews-v1"} 0

# Where: 0=healthy, 1=degraded, 2=failure, 3=unknown
```

**Pros**:

- ✅ Predictable performance - consistent fast response times
- ✅ Maximum Prometheus query reduction (queries only during background refresh)
- ✅ Bounded staleness - configurable (default 2 minutes)
- ✅ Observability - health metrics available in Prometheus for dashboards/alerts
- ✅ Enables future health trend visualization without code changes
- ✅ Manageable cardinality - only stores health grade, not raw error rates
- ✅ Leverages existing Kiali metrics infrastructure (no new infrastructure needed)
- ✅ Simple handler logic - just read from cache
- ✅ Can leverage existing background job pattern (like `PollIstiodForProxyStatus`)

**Cons**:

- ❌ Potential stale data (up to refresh interval, default 2 minutes)
- ❌ Higher baseline resource usage - computes health for all namespaces
- ❌ Cardinality consideration - ~45k time series in large deployments (100 namespaces × 50 entities × 3 types × 3 clusters)
- ❌ May overwhelm Prometheus during refresh cycle if not staggered
- ❌ Complex handling of multi-cluster scenarios
- ❌ More moving parts than Approach 2 (background job + cache + metrics)

**Compared to Approach 1**:

- Similar background pre-computation model
- **Additional benefit**: Metrics export for observability
- **Same drawback**: Computes health for all namespaces (not just accessed ones)

**Compared to Approach 2**:

- More complex (background job vs on-demand)
- **Benefit**: More predictable performance (no cold starts)
- **Benefit**: Enables health monitoring/alerting via Prometheus
- **Drawback**: Higher baseline resource usage

**Complexity**: Medium
**Development Effort**: 4-5 days

- Background job implementation: 2 days
- Cache integration: 1 day
- Metrics export: 1 day
- Testing and configuration: 1 day

---

## Technology Considerations

### Prometheus Query Optimization

- Current: One query per namespace per type
- Potential: Single query with namespace selector: `{namespace=~"ns1|ns2|ns3"}`
- Prometheus can handle multi-namespace queries efficiently
- Would dramatically reduce query count

### Cache Storage

- **Recommended**: Use existing `KialiCache` and `store.Store` infrastructure
- Already supports:
  - Expiration-based eviction
  - Thread-safe access
  - Configuration-driven TTLs
- Proven pattern with IstioStatus, Mesh, etc.

### Cache Keys

```
Health Cache Key Structure:
  - Namespace Health: cluster:namespace:type:rateInterval
  - Example: "cluster1:bookinfo:app:10m"
```

### Configuration

```yaml
kiali_internal:
  cache_expiration:
    health: 30s # New setting for health cache TTL

health:
  cache_enabled: true # Enable/disable health caching
  cache_warmup_enabled: false # Enable background warming (Approach 3)
  cache_warmup_interval: 60s # How often to warm cache
  cache_access_threshold: 3 # Accesses to qualify as "hot"
```

## Implementation Complexity Comparison

| Aspect              | Approach 1 | Approach 2 | Approach 3 | Approach 4 | Approach 5 |
| ------------------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| Code Changes        | Medium     | Low        | High       | Medium     | Medium     |
| Risk                | Medium     | Low        | High       | Medium     | Medium     |
| Testing Complexity  | Medium     | Low        | High       | High       | Medium     |
| Performance Gain    | High       | Medium     | High       | Medium     | High       |
| Resource Efficiency | Low        | High       | High       | Medium     | Low        |
| Maintenance Burden  | Medium     | Low        | High       | Medium     | Medium     |
| Observability       | Low        | Low        | Medium     | Low        | **High**   |
| Future Flexibility  | Medium     | Medium     | High       | Medium     | **High**   |

## Resource Implications

### Memory Impact

- **Approach 1**: ~100KB per namespace × number of namespaces × number of clusters
  - Example: 100 namespaces × 3 clusters × 100KB = ~30MB
- **Approach 2**: Only accessed namespaces, same per-namespace cost
- **Approach 3**: Hot namespaces only, typically 10-20% of total
- **Approach 4**: Minimal additional memory (query result caching only)
- **Approach 5**: Same as Approach 1 (~30MB) + Prometheus metric overhead
  - Metric cardinality: ~45k time series (100 ns × 50 entities × 3 types × 3 clusters)
  - Prometheus memory: ~1-2MB for metric storage
  - Total: ~31-32MB

### CPU Impact

- **Approach 1**: Periodic spikes during refresh cycles
- **Approach 2**: Distributed load based on actual access patterns
- **Approach 3**: Moderate baseline + spikes for hot namespace refresh
- **Approach 4**: Same as current, but parallelized
- **Approach 5**: Periodic spikes during refresh cycles (same as Approach 1) + metric export overhead (minimal)

### Prometheus Load

- **Current**: N queries per ClusterHealth request (N = number of namespaces)
- **Approach 1**: N queries every refresh interval, zero on user requests
- **Approach 2**: N queries on first access, zero until TTL
- **Approach 3**: Fewer than N queries (only hot namespaces), plus on-demand
- **Approach 4**: 1 batched query per ClusterHealth request (with optimization)
- **Approach 5**: N queries every refresh interval (same as Approach 1), zero on user requests
  - Additional: Prometheus scrapes Kiali metrics endpoint (minimal load)

## Recommendation

### Two Viable Options

After adding **Approach 5** (user-proposed metrics-based approach), we now have two strong candidates with different tradeoffs:

---

#### Option A: Approach 5 (Metrics-Based Background Pre-Computation) ⭐ **Recommended for Observability**

**Best for**: Teams wanting predictable performance, health monitoring/alerting, and future trend analysis.

**Rationale**:

1. **Predictable performance**: No cold starts, consistent response times
2. **Observability**: Health metrics enable Prometheus dashboards and alerts
3. **Future flexibility**: Foundation for health trends and historical analysis
4. **Maximum query reduction**: 100% reduction on user requests
5. **Proven pattern**: Similar to existing `PollIstiodForProxyStatus`

**Tradeoffs**:

- More complex than Approach 2 (~100 additional lines vs ~50)
- Higher baseline resource usage (computes all namespaces)
- Up to 2 minutes staleness (configurable)
- Development time: 4-5 days vs 2-3 days

---

#### Option B: Approach 2 (On-Demand Caching) ⭐ **Recommended for Simplicity**

**Best for**: Teams wanting simplest implementation with immediate value and lowest risk.

**Rationale**:

1. **Lowest risk**: Builds on existing patterns, minimal code changes
2. **Immediate value**: Provides caching benefit without complex infrastructure
3. **Resource efficient**: Only caches what's actually accessed
4. **Evolutionary path**: Can add background warming or metrics later
5. **Good fit**: Users typically focus on specific namespaces

**Tradeoffs**:

- First request per namespace has latency (cache miss)
- No built-in observability (would need separate work)
- Inconsistent response times (fast on hit, slow on miss)

### Implementation Strategies

#### Strategy A: Implement Approach 5 (Metrics-Based)

1. **Phase 1**: Background health computation

   - Add `HealthRefreshService` in business layer
   - Background goroutine (like `PollIstiodForProxyStatus`)
   - Configurable refresh interval (default 2min)
   - Store in `KialiCache`

2. **Phase 2**: Metrics export

   - Add health status metrics to existing metrics endpoint
   - Export: `kiali_namespace_{app|service|workload}_health_status`
   - Configure Prometheus scraping

3. **Phase 3**: Handler integration

   - Modify handlers to read from cache
   - Add cache age metadata to responses (optional)
   - Add configuration options

4. **Future**: Historical health queries (not in initial scope)
   - Add endpoint for time-range health queries
   - Query Prometheus for historical metrics
   - Build trend visualization in UI

#### Strategy B: Implement Approach 2 (On-Demand)

1. **Phase 1**: Add health caching to `KialiCache` with TTL

   - Add `HealthCache` store to `kialiCacheImpl`
   - Modify handlers to check cache first
   - Add configuration for health cache TTL
   - Add metrics for cache hits/misses

2. **Phase 2** (Optional): Optimize Prometheus queries

   - Add batched query support for ClusterHealth
   - Parallelize computation
   - Combine with caching from Phase 1

3. **Phase 3** (Optional): Evolve to Approach 3 or 5
   - Add background warming for hot namespaces
   - Or add metrics export for observability

### Success Metrics

#### For Approach 5 (Metrics-Based):

- P95 latency < 200ms for all health requests (always cached)
- P99 latency < 500ms for all health requests
- Prometheus query rate reduction > 95% on user requests
- Health metrics exported successfully (0 export errors)
- Background refresh completes within interval (< 2 minutes for all clusters)
- Metric cardinality < 50k time series

#### For Approach 2 (On-Demand):

- Cache hit rate > 80% for typical user sessions
- P95 latency < 200ms for cached responses
- P95 latency < 2s for cache misses (100 namespaces)
- Prometheus query rate reduction > 70%

## Next Steps (Phase 2 - Requirements Definition)

1. Define detailed functional requirements for Approach 2
2. Specify API contracts (no breaking changes)
3. Define configuration schema
4. Identify integration points with existing code
5. Define test strategy and acceptance criteria
