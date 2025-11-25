# Constraints: Health Data Pre-Computing and Caching

## Technical Constraints

### 1. API Compatibility

**Constraint**: Zero breaking changes to existing API contracts

**Details**:

- ClusterHealth endpoint (`/api/clusters/health`) must maintain exact same request/response format
- Response types (`ClustersNamespaceHealth`, `NamespaceAppHealth`, etc.) must remain unchanged
- Query parameters must work identically (namespaces, type, rateInterval, queryTime, clusterName)
- Existing clients (UI, CLI, integrations) must work without modification

**Impact**:

- Health caching must be transparent to API consumers
- Cache logic must live in handler/business layer, not in models
- Any staleness must be acceptable for the API contract

**Validation**:

- Run existing integration tests without modification
- Verify API response schema matches exactly
- Test with actual Kiali UI

---

### 2. Multi-Cluster Support

**Constraint**: Solution must work across multiple Kubernetes clusters

**Details**:

- Kiali can monitor 1-N clusters simultaneously
- Each cluster may have different namespaces and workloads
- Cache keys must include cluster identifier
- Background refresh (if used) must handle all clusters
- Cluster disconnection/reconnection must not break caching

**Impact**:

- Cache key structure: `cluster:namespace:type:rateInterval`
- Background workers must iterate over all discovered clusters
- Memory usage scales with number of clusters
- Error handling per cluster (one cluster failure shouldn't affect others)

**Validation**:

- Test with 3+ cluster setup
- Verify cache isolation between clusters
- Test cluster removal and addition scenarios

---

### 3. Kubernetes Watch Limitations

**Constraint**: Cannot rely on K8s watches for cache invalidation

**Details**:

- Kiali uses controller-runtime cache with watches
- Watches are for K8s resources (Pods, Services, etc.), not computed health
- Health depends on Prometheus metrics, which don't have K8s-style watches
- Watch events don't directly map to "health changed"

**Impact**:

- Cache invalidation must be time-based (TTL), not event-based
- Cannot achieve immediate cache invalidation on resource changes
- Some staleness is unavoidable
- TTL must be tuned to balance freshness vs. performance

**Alternative**:

- Could invalidate cache on K8s resource updates, but would be overly aggressive
- Would defeat caching benefits (every pod change = cache miss)

---

### 4. Prometheus Query Performance

**Constraint**: Prometheus has query rate limits and performance characteristics

**Details**:

- Prometheus queries have cost (CPU, memory on Prometheus server)
- Too many concurrent queries can overwhelm Prometheus
- Large time ranges or high cardinality queries are expensive
- Query timeout typically 30-60 seconds

**Impact**:

- Cannot refresh all namespace health simultaneously (would spike Prometheus load)
- Background refresh must stagger queries (e.g., 10 concurrent max)
- Cache duration must be long enough to prevent query storms
- Need query batching for ClusterHealth with many namespaces

**Mitigation**:

- Rate limit background refresh queries
- Use connection pooling for Prometheus client
- Batch queries where possible (namespace selector in PromQL)
- Monitor Prometheus query duration and errors

---

### 5. Memory Constraints

**Constraint**: Kiali server has finite memory, must not cause OOM

**Details**:

- Typical Kiali deployment: 512MB-2GB memory limit
- Health data per namespace: ~50-200KB (varies by number of services/workloads)
- 100 namespaces × 3 clusters × 200KB = ~60MB
- Must leave room for other caches and operations

**Impact**:

- Cache size must be bounded (by number of entries or total memory)
- Consider cache eviction policy (LRU) for very large clusters
- Monitor memory usage and add alerts
- May need configuration for maximum cache entries

**Calculation**:

```
Per namespace health entry:
- NamespaceAppHealth: ~50KB (varies with # of apps)
- NamespaceServiceHealth: ~30KB (varies with # of services)
- NamespaceWorkloadHealth: ~70KB (varies with # of workloads)

Worst case (all 3 types cached):
- 150KB × 100 namespaces × 3 clusters = 45MB
- Acceptable for typical deployments
```

**Safety Margin**: Aim for < 100MB total health cache size

---

### 6. Time Synchronization

**Constraint**: Distributed systems have clock skew

**Details**:

- Prometheus queries use timestamps
- Cache keys include query time
- Different clients may use slightly different timestamps
- Clock skew between nodes can cause cache misses

**Impact**:

- Cannot use exact timestamp matching for cache lookups
- Must use time windows (e.g., ±5 seconds)
- Or normalize timestamps to intervals (e.g., round to nearest 30s)
- QueryTime parameter in API may cause cache fragmentation

**Mitigation**:

- Don't include queryTime in cache key (use "now" at query execution)
- Or round queryTime to nearest cache interval (e.g., 30s buckets)
- Document that queryTime parameter affects cache effectiveness

---

### 7. Configuration Backward Compatibility

**Constraint**: Config changes must not break existing deployments

**Details**:

- Kiali configuration is deployed via ConfigMap or CR
- Users have existing configs with no health cache settings
- New configuration must have sensible defaults
- Must work with Kiali Operator and Helm charts

**Impact**:

- All health cache config must be optional with defaults
- Default to enabled with safe TTL (e.g., 30s)
- Must not require users to update their configs
- Operator templates must include new fields

**Default Configuration**:

```yaml
kiali_internal:
  cache_expiration:
    health: 30s # Short TTL by default (safe, but some benefit)

# Optional advanced config (not in kiali_internal)
health_cache:
  enabled: true # Enabled by default
  background_warmup: false # Disabled by default (opt-in feature)
```

---

## Performance Requirements

### 1. Latency

**Target**: ClusterHealth response time < 500ms for 100 namespaces (with cache hit)

**Current Baseline**:

- Without cache: 5-10 seconds for 100 namespaces
- With Prometheus cache: 3-7 seconds (helps, but not enough)

**Success Criteria**:

- P50 latency: < 200ms (cache hit)
- P95 latency: < 500ms (cache hit)
- P99 latency: < 2s (cache miss, compute fresh)

**Measurement**:

- Add Prometheus metrics for health request duration
- Histogram with buckets: 50ms, 100ms, 200ms, 500ms, 1s, 2s, 5s
- Label by cache_hit (true/false)

---

### 2. Throughput

**Target**: Support 100+ concurrent ClusterHealth requests

**Current Limitation**:

- Each request triggers Prometheus queries
- Prometheus has query concurrency limits
- Too many concurrent requests cause queuing

**With Caching**:

- Cached responses don't hit Prometheus
- Can serve many concurrent requests from cache
- Only cache misses cause Prometheus load

**Success Criteria**:

- Handle 100 concurrent requests without errors
- No Prometheus query rate limit errors
- Response time degradation < 2x under load

---

### 3. Resource Usage

**Targets**:

- Memory: < 100MB for health cache
- CPU: < 5% additional CPU for background refresh (if used)
- Prometheus queries: 90% reduction in query volume

**Measurement**:

- Go runtime metrics for heap usage
- Prometheus query rate (queries/sec)
- CPU usage delta (before/after caching)

**Alerting Thresholds**:

- Memory > 150MB for health cache: Warning
- Memory > 250MB for health cache: Critical
- Prometheus query errors > 1%: Critical

---

## Business Rules and Constraints

### 1. Data Freshness Requirements

**Rule**: Health data must be "fresh enough" for operational decision making

**Context**:

- Health is used for troubleshooting and monitoring
- Stale health data could mislead operators
- But real-time health is not required for most use cases

**Acceptable Staleness**:

- **Default TTL**: 30 seconds (balance freshness and performance)
- **Minimum TTL**: 10 seconds (more frequent might not help due to metric collection intervals)
- **Maximum TTL**: 5 minutes (beyond this, data becomes too stale)

**Configurable**: Yes, users should be able to tune TTL based on their needs

**User Education**:

- Document that cached health has TTL
- Show cache age in UI (optional enhancement)
- Provide "refresh" button to force cache invalidation

---

### 2. Multi-Tenancy

**Rule**: Health cache must respect RBAC and user permissions

**Context**:

- Different users may have access to different namespaces
- Cache must not leak health data across tenants
- Current namespace cache is per-token

**Impact**:

- **Option 1**: Cache per user token (like namespace cache)

  - Pros: Perfect isolation
  - Cons: Memory usage × number of users
  - Not recommended for health cache

- **Option 2**: Cache globally, filter on retrieval
  - Pros: Efficient memory usage
  - Cons: Must verify user has access before returning cached data
  - **Recommended approach**

**Implementation**:

- Cache health globally (no token in key)
- Before returning cached health, verify user has namespace access
- Use existing RBAC checks in business layer

**Security Consideration**:

- Cached health must not bypass authorization
- Handler must check permissions even for cache hits

---

### 3. Graceful Degradation

**Rule**: Caching failures must not break health functionality

**Scenarios**:

- Cache unavailable (memory pressure, errors)
- Background refresh fails
- Cache corruption or inconsistency

**Behavior**:

- **Cache miss or error**: Fall back to computing health normally
- **Background refresh error**: Log error, continue serving from cache
- **Memory pressure**: Evict oldest entries, continue operation

**Implementation**:

```go
func GetHealthWithCache(key HealthKey) (*Health, error) {
    // Try cache
    if cached, found := cache.Get(key); found {
        return cached, nil
    }

    // Cache miss or error - compute normally
    health, err := computeHealth(key)
    if err != nil {
        return nil, err  // Propagate compute errors
    }

    // Best effort cache store (don't fail if cache write fails)
    _ = cache.Set(key, health)  // Ignore cache errors

    return health, nil
}
```

---

### 4. Monitoring and Observability

**Rule**: Cache behavior must be observable for troubleshooting

**Required Metrics**:

- `kiali_health_cache_hits_total` (counter)
- `kiali_health_cache_misses_total` (counter)
- `kiali_health_cache_size` (gauge) - number of entries
- `kiali_health_cache_memory_bytes` (gauge) - approximate memory usage
- `kiali_health_compute_duration_seconds` (histogram) - health computation time
- `kiali_health_background_refresh_duration_seconds` (histogram) - background refresh time (if used)
- `kiali_health_background_refresh_errors_total` (counter) - background refresh errors (if used)

**Required Logs**:

- Cache hits/misses at TRACE level
- Cache size at DEBUG level (periodically)
- Background refresh start/end at DEBUG level
- Errors at ERROR level

**Health Checks**:

- Add cache stats to /healthz endpoint
- Include cache hit rate in Kiali metrics

---

## Security Constraints

### 1. Authorization

**Constraint**: Cached health must respect user permissions

**Details**:

- Users should only see health for namespaces they have access to
- Cache must not bypass RBAC checks
- Token-based access control must still work

**Implementation**:

- Cache is global (not per-user)
- Handler checks user permissions before returning cached data
- Business layer RBAC logic remains unchanged

---

### 2. Sensitive Data

**Constraint**: Health data may contain sensitive information

**Details**:

- Service names, workload names are visible in health data
- Request rates could reveal traffic patterns
- In multi-tenant environments, this is sensitive

**Mitigation**:

- Cache is in-memory only (not persisted to disk)
- No external cache systems (Redis, Memcached) by default
- Standard Kiali RBAC applies

---

## Operational Constraints

### 1. Deployment Models

**Constraint**: Must work in all Kiali deployment scenarios

**Scenarios**:

- Single cluster with Kiali in-cluster
- Multi-cluster with Kiali in home cluster
- Multi-cluster with Kiali outside cluster
- OpenShift deployments
- Helm deployments
- Operator-based deployments

**Impact**:

- Configuration must work in all deployment models
- No assumptions about cluster topology
- Must handle cluster discovery dynamically

---

### 2. Upgrade Path

**Constraint**: Upgrades must not break existing installations

**Details**:

- Users upgrade Kiali versions
- Config may not be updated immediately
- Cache is in-memory (no migration needed)

**Requirements**:

- New config fields have defaults
- Feature flags for opt-in capabilities
- No schema changes to cached data types

**Testing**:

- Test upgrade from current stable version
- Verify default config works
- Test with old config (no new fields)

---

### 3. Rollback Support

**Constraint**: Users must be able to rollback if issues arise

**Details**:

- If health caching causes issues, users need quick mitigation
- Should not require code changes or redeployment

**Solution**:

- Configuration flag to disable health caching
- Runtime toggle via ConfigMap update
- Falls back to non-cached behavior when disabled

**Config**:

```yaml
health_cache:
  enabled: false # Set to false to disable caching
```

---

## Testing Constraints

### 1. Test Environment Limitations

**Constraint**: CI/CD environments have resource limits

**Details**:

- GitHub Actions runners: 7GB RAM, 2 CPU cores
- Integration tests must complete in < 10 minutes
- Cannot test with 100+ real namespaces

**Impact**:

- Use small test datasets (5-10 namespaces)
- Mock Prometheus responses
- Test cache behavior, not performance at scale

**Performance Testing**:

- Requires separate load testing environment
- Document expected performance characteristics
- Provide load testing scripts for users

---

### 2. Mock Complexity

**Constraint**: Mocking cached vs. non-cached behavior is complex

**Details**:

- Existing tests use mock Prometheus client
- Cache adds state that must be controlled in tests
- Need to test both cache hit and miss paths

**Solution**:

- Add cache control to test utilities
- Clear cache between test cases
- Add explicit cache state setup in tests

**Example**:

```go
func TestHealthCacheHit(t *testing.T) {
    cache := setupTestCache()

    // Pre-populate cache
    cache.SetHealth(testKey, testHealth)

    // Verify cache hit
    result := getHealth(testKey)
    assert.Equal(t, testHealth, result)
    assert.Equal(t, 0, promClient.QueryCount) // No Prometheus query
}
```

---

## Documentation Constraints

### 1. User Documentation

**Required**:

- How health caching works
- Configuration options and defaults
- Performance implications
- Troubleshooting guide

**Audience**:

- Kiali operators (configure and monitor)
- End users (understand cache behavior)

---

### 2. Developer Documentation

**Required**:

- Cache architecture and design
- Integration points
- How to extend or modify caching
- Testing approach

---

## Timeline and Resource Constraints

### 1. Development Time

**Available**: Subject to user approval

**Phases**:

- Phase 1 (Approach 2 - On-demand caching): 2-3 days implementation + 1-2 days testing
- Phase 2 (Optimization): 2-3 days
- Phase 3 (Background warmup): 3-4 days

**Dependencies**:

- No external team dependencies
- No new infrastructure required
- Can be developed incrementally

---

### 2. Maintenance Burden

**Constraint**: Solution must be maintainable long-term

**Considerations**:

- Code complexity should be minimal
- Leverage existing patterns (don't invent new ones)
- Comprehensive tests for future changes
- Clear documentation for future developers

**Recommendation**: Start with Approach 2 (simplest) and evolve as needed

---

## Risk Mitigation Summary

| Risk                    | Severity | Mitigation                                            |
| ----------------------- | -------- | ----------------------------------------------------- |
| Stale health data       | Medium   | Short default TTL (30s), configurable                 |
| Memory exhaustion       | Medium   | Monitor memory, bounded cache size                    |
| API compatibility break | High     | Extensive testing, no model changes                   |
| RBAC bypass             | High     | Always check permissions before returning cached data |
| Prometheus overload     | Medium   | Rate limit background refresh, stagger queries        |
| Cache complexity        | Low      | Start with simple approach (Approach 2)               |
| Difficult rollback      | Low      | Configuration flag to disable                         |
| Performance regression  | Low      | Extensive benchmarking, metrics                       |

---

## Success Metrics

### Required for Phase 1 Completion

- ✅ Zero API breaking changes
- ✅ All existing tests pass
- ✅ Cache hit rate > 70% in typical usage
- ✅ P95 latency < 500ms for cache hits
- ✅ Memory usage < 100MB for health cache

### Optional Enhancements (Future Phases)

- P95 latency < 2s for 100 namespace ClusterHealth (cache miss)
- Prometheus query reduction > 90%
- Background warmup working for hot namespaces
- User-facing cache age indicators in UI
