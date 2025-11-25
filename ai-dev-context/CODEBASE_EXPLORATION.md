# Codebase Exploration: Health Calculation Architecture

## Overview

This document details the existing Kiali architecture relevant to health calculation, caching patterns, and potential integration points for health data pre-computing and caching.

## Key Files and Their Purposes

### Health Calculation (`business/health.go`)

**Location**: `/business/health.go` (442 lines)

**Purpose**: Business logic for calculating health metrics from K8s and Prometheus data

**Key Components**:

```go
type HealthService struct {
    businessLayer *Layer
    conf          *config.Config
    prom          prometheus.ClientInterface
    userClients   map[string]kubernetes.UserClientInterface
}

type NamespaceHealthCriteria struct {
    IncludeMetrics bool
    Namespace      string
    Cluster        string
    QueryTime      time.Time
    RateInterval   string
}
```

**Critical Functions**:

- `GetNamespaceAppHealth()` - Lines 133-156
  - Fetches app entities from K8s
  - Calls `in.prom.GetAllRequestRates()` for metrics
  - Aggregates into `models.NamespaceAppHealth`
- `GetNamespaceServiceHealth()` - Lines 201-238
  - Fetches service list via `businessLayer.Svc.GetServiceList()`
  - Calls `in.prom.GetNamespaceServicesRequestRates()`
  - Returns `models.NamespaceServiceHealth`
- `GetNamespaceWorkloadHealth()` - Lines 276-305
  - Fetches workloads via `businessLayer.Workload.GetNamespaceWorkloads()`
  - Calls `in.prom.GetAllRequestRates()` for metrics
  - Returns `models.NamespaceWorkloadHealth`

**Aggregation Functions**:

- `fillAppRequestRates()` - Lines 341-361
- `fillWorkloadRequestRates()` - Lines 364-383

**Pattern**: All methods follow:

1. Validate cluster/namespace
2. Fetch K8s resources (workloads/services/apps)
3. Query Prometheus for request rates (if sidecars present)
4. Aggregate metrics into health model
5. Return computed health

---

### Handler Layer (`handlers/health.go`)

**Location**: `/handlers/health.go` (168 lines)

**Purpose**: HTTP handler for health endpoints

**Key Function**: `ClusterHealth()` - Lines 28-106

**Flow**:

```go
func ClusterHealth(...) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // 1. Parse query params (namespaces, cluster)
        // 2. Get business layer instance
        // 3. Loop through namespaces
        for _, ns := range nss {
            // 4. Extract health params (rateInterval, queryTime, type)
            // 5. Call business layer based on type
            switch p.Type {
            case "app":
                health = businessLayer.Health.GetNamespaceAppHealth(...)
            case "service":
                health = businessLayer.Health.GetNamespaceServiceHealth(...)
            case "workload":
                health = businessLayer.Health.GetNamespaceWorkloadHealth(...)
            }
            // 6. Accumulate results
            result.AppHealth[ns] = &health
        }
        // 7. Return aggregated results
        RespondWithJSON(w, http.StatusOK, result)
    }
}
```

**Response Model**:

```go
type ClustersNamespaceHealth struct {
    AppHealth      map[string]*NamespaceAppHealth
    WorkloadHealth map[string]*NamespaceWorkloadHealth
    ServiceHealth  map[string]*NamespaceServiceHealth
}
```

**Integration Point**: This is where cache lookup would be most effective

- Check cache before calling business layer
- Cache entire namespace health result
- Return cached data if fresh enough

---

### Caching Infrastructure

#### 1. KialiCache (`cache/cache.go`)

**Location**: `/cache/cache.go` (591 lines)

**Purpose**: Main cache for Kiali business layer data

**Interface**:

```go
type KialiCache interface {
    GetMesh() (*models.Mesh, bool)
    SetMesh(*models.Mesh)
    GetIstioStatus() (kubernetes.IstioComponentStatus, bool)
    SetIstioStatus(kubernetes.IstioComponentStatus)
    GetNamespace(cluster, token, name string) (models.Namespace, bool)
    SetNamespaces(token string, namespaces []models.Namespace)
    // ... many more
}
```

**Implementation** (`kialiCacheImpl` struct):

```go
type kialiCacheImpl struct {
    clients                 map[string]kubernetes.ClientInterface
    conf                    config.Config
    clusters                []models.KubeCluster

    // Stores with expiration
    gatewayStore            store.Store[string, models.Workloads]
    istioStatusStore        store.Store[string, kubernetes.IstioComponentStatus]
    meshStore               store.Store[string, *models.Mesh]
    namespaceStore          store.Store[namespacesKey, map[string]models.Namespace]
    waypointStore           store.Store[string, models.Workloads]

    // Validation caches
    validations             store.Store[models.IstioValidationKey, *models.IstioValidation]
    validationConfig        store.Store[string, string]

    // Status caches
    proxyStatusStore        store.Store[string, *kubernetes.ProxyStatus]
    registryStatusStore     store.Store[string, *kubernetes.RegistryStatus]
    ztunnelConfigStore      store.Store[string, *kubernetes.ZtunnelConfigDump]
}
```

**Cache Creation** (Lines 168-190):

```go
kialiCacheImpl := kialiCacheImpl{
    gatewayStore:     store.NewExpirationStore(ctx, store.New[...](),
                        util.AsPtr(conf.KialiInternal.CacheExpiration.Gateway), nil),
    istioStatusStore: store.NewExpirationStore(ctx, store.New[...](),
                        util.AsPtr(conf.KialiInternal.CacheExpiration.IstioStatus), nil),
    meshStore:        store.NewExpirationStore(ctx, store.New[...](),
                        util.AsPtr(conf.KialiInternal.CacheExpiration.Mesh), nil),
    // ...
}
```

**Pattern to Follow**:

- Use `store.NewExpirationStore()` for TTL-based caching
- Key by cluster + namespace + health type
- Configure expiration via `config.CacheExpirationConfig`

---

#### 2. Store Package (`store/store.go`)

**Location**: `/store/store.go` (34 lines)

**Purpose**: Generic key-value store with thread-safety

**Interface**:

```go
type Store[K comparable, V any] interface {
    Get(key K) (V, bool)
    Set(key K, value V)
    Remove(key K)
    Replace(map[K]V)
    Keys() []K
    Items() map[K]V
    Version() uint  // Track modifications
}
```

**Implementation**: `threadSafeStore[K, V]` with `sync.RWMutex`

**Expiration Support**:

- `NewExpirationStore()` wraps a Store with TTL behavior
- Background goroutine cleans expired entries
- Configured with `time.Duration` pointer

**Usage Pattern**:

```go
healthStore := store.NewExpirationStore(
    ctx,
    store.New[HealthKey, *NamespaceHealth](),
    util.AsPtr(30 * time.Second),  // TTL
    nil,  // onEvict callback (optional)
)
```

---

#### 3. Prometheus Cache (`prometheus/cache.go`)

**Location**: `/prometheus/cache.go` (315+ lines)

**Purpose**: Cache Prometheus query results

**Current Caching** (Lines 40-58):

```go
type promCacheImpl struct {
    cacheDuration   time.Duration  // How long results are valid
    cacheExpiration time.Duration  // Global periodic flush

    // Cached by namespace, cluster, app, ratesInterval
    cacheSvcRequestRates map[string]map[string]map[string]map[string]timeInResult
    cacheWkRequestRates  map[string]map[string]map[string]map[string]timeInOutResult
    cacheAppRequestRates map[string]map[string]map[string]map[string]timeInOutResult

    // Cached by namespace, cluster, ratesInterval
    cacheAllRequestRates   map[string]map[string]map[string]timeInResult
    cacheNsSvcRequestRates map[string]map[string]map[string]timeInResult

    // Separate locks per cache type
    allRequestRatesLock    sync.RWMutex
    appRequestRatesLock    sync.RWMutex
    // ...
}
```

**Cache Lookup Pattern** (Lines 82-98):

```go
func (c *promCacheImpl) GetAllRequestRates(namespace, cluster, ratesInterval, queryTime) (bool, model.Vector) {
    defer c.allRequestRatesLock.RUnlock()
    c.allRequestRatesLock.RLock()

    if nsRates, ok := c.cacheAllRequestRates[namespace][cluster]; ok {
        if rtInterval, ok := nsRates[ratesInterval]; ok {
            // Check if cached result is fresh enough
            if !queryTime.Before(rtInterval.queryTime) &&
               queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
                return true, rtInterval.inResult
            }
        }
    }
    return false, nil
}
```

**Expiration Strategy** (Lines 289-315):

- Background goroutine `watchExpiration()`
- Periodically flushes ALL caches (nuclear option)
- Runs every `cacheExpiration` duration
- Simple but crude - could be improved

**Key Insight**: Prometheus cache caches query results, not computed health. Health caching would be at a higher level.

---

### Background Job Pattern (`business/controlplane_monitor.go`)

**Location**: `/business/controlplane_monitor.go`

**Purpose**: Periodically refresh control plane status

**Example Pattern** (Lines 149-172):

```go
func (p *controlPlaneMonitor) PollIstiodForProxyStatus(ctx context.Context) {
    log.Debug("Starting polling istiod(s) every %d seconds", interval)

    // Prime the pump - initial refresh
    if err := p.RefreshIstioCache(ctx); err != nil {
        log.Error("Unable to refresh istio cache: %s", err)
    }

    // Background goroutine
    go func() {
        for {
            select {
            case <-ctx.Done():
                log.Debug("Stopping polling")
                return
            case <-time.After(p.pollingInterval):
                if err := p.RefreshIstioCache(ctx); err != nil {
                    log.Error("Unable to refresh cache: %s", err)
                }
            }
        }
    }()
}
```

**Refresh Logic** (Lines 80-147):

```go
func (p *controlPlaneMonitor) RefreshIstioCache(ctx context.Context) error {
    // 1. Discover control planes
    controlPlanes := p.discoverControlPlanes()

    // 2. Query each control plane
    for cluster, controlPlane := range controlPlanes {
        // 3. Fetch data with retry
        status, err := p.getProxyStatusWithRetry(...)
        // 4. Store in cache
        p.cache.SetProxyStatus(status)
    }
    return nil
}
```

**Pattern to Replicate**: Health cache background refresh would follow this pattern

- Start background goroutine at server startup
- Configurable refresh interval
- Context-aware shutdown
- Error logging without crashing
- Store results in cache

---

### Configuration (`config/config.go`)

**Location**: `/config/config.go` (1754 lines)

**Cache Configuration** (Lines 446-454):

```go
type CacheExpirationConfig struct {
    AmbientCheck  time.Duration `yaml:"ambient_check,omitempty"`
    IstioStatus   time.Duration `yaml:"istio_status,omitempty"`
    Gateway       time.Duration `yaml:"gateway,omitempty"`
    Mesh          time.Duration `yaml:"mesh,omitempty"`
    Waypoint      time.Duration `yaml:"waypoint,omitempty"`
    ZtunnelConfig time.Duration `yaml:"ztunnel_config,omitempty"`
    // Health would be added here
}

type KialiInternalConfig struct {
    CacheExpiration        CacheExpirationConfig
    MetricLogDurationLimit time.Duration
    UrlServiceVersion      string
}
```

**Prometheus Cache Config** (Lines 238-249):

```go
type PrometheusConfig struct {
    CacheDuration   int  `yaml:"cache_duration"`     // Per-query cache duration (seconds)
    CacheEnabled    bool `yaml:"cache_enabled"`      // Enable/disable caching
    CacheExpiration int  `yaml:"cache_expiration"`   // Global flush interval (seconds)
    // ...
}
```

**Defaults** (Lines 973-980):

```go
KialiInternal: KialiInternalConfig{
    CacheExpiration: CacheExpirationConfig{
        AmbientCheck:  10 * time.Minute,
        Gateway:       4 * time.Minute,
        IstioStatus:   30 * time.Second,
        Mesh:          20 * time.Second,
        Waypoint:      4 * time.Minute,
        ZtunnelConfig: 2 * time.Minute,
    },
}
```

**Integration Point**:

```go
// Add to CacheExpirationConfig:
Health time.Duration `yaml:"health,omitempty"`

// Add to defaults:
Health: 30 * time.Second,  // Default health cache TTL
```

---

## Existing Patterns and Architectures

### Pattern 1: Expiration Store

**Used By**: Gateway, IstioStatus, Mesh, Waypoint, ZtunnelConfig caches

**Components**:

1. `store.Store[K, V]` - Thread-safe key-value store
2. `store.NewExpirationStore()` - Wraps store with TTL
3. Background goroutine for expiration

**Application to Health**:

```go
// In kialiCacheImpl
healthStore store.Store[HealthCacheKey, *models.NamespaceHealth]

// In NewKialiCache()
healthStore: store.NewExpirationStore(
    ctx,
    store.New[HealthCacheKey, *models.NamespaceHealth](),
    util.AsPtr(conf.KialiInternal.CacheExpiration.Health),
    nil,
),
```

**Key Type**:

```go
type HealthCacheKey struct {
    Cluster      string
    Namespace    string
    HealthType   string  // "app", "service", "workload"
    RateInterval string  // "10m", "30m", etc.
}

func (k HealthCacheKey) String() string {
    return fmt.Sprintf("%s:%s:%s:%s", k.Cluster, k.Namespace, k.HealthType, k.RateInterval)
}
```

### Pattern 2: Background Refresh

**Used By**: ControlPlaneMonitor (proxy status, registry status)

**Components**:

1. Refresh method that fetches and caches data
2. Background goroutine with configurable interval
3. Context-aware shutdown
4. Error handling without crash

**Application to Health**:

```go
type HealthCacheMonitor struct {
    cache             KialiCache
    businessLayer     *business.Layer
    refreshInterval   time.Duration
    conf              *config.Config
}

func (h *HealthCacheMonitor) StartHealthCacheRefresh(ctx context.Context) {
    // Similar to PollIstiodForProxyStatus
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case <-time.After(h.refreshInterval):
                h.refreshHealthCache(ctx)
            }
        }
    }()
}

func (h *HealthCacheMonitor) refreshHealthCache(ctx context.Context) error {
    // For each cluster, for each namespace:
    //   1. Compute health
    //   2. Store in cache
}
```

### Pattern 3: Cache-Check-Compute

**Used By**: Namespace cache, Prometheus cache

**Flow**:

```go
func GetHealth(namespace, cluster string) (*Health, error) {
    // 1. Check cache
    key := HealthCacheKey{Cluster: cluster, Namespace: namespace, ...}
    if cached, found := cache.GetHealth(key); found {
        return cached, nil
    }

    // 2. Cache miss - compute
    health, err := computeHealth(namespace, cluster)
    if err != nil {
        return nil, err
    }

    // 3. Store in cache
    cache.SetHealth(key, health)

    return health, nil
}
```

---

## Integration Points and Extension Opportunities

### 1. KialiCache Interface Extension

**File**: `cache/cache.go`
**Lines**: 41-108 (interface definition)

**Add**:

```go
type KialiCache interface {
    // Existing methods...

    // Health cache methods
    GetNamespaceHealth(key HealthCacheKey) (*models.NamespaceHealth, bool)
    SetNamespaceHealth(key HealthCacheKey, health *models.NamespaceHealth)
    InvalidateNamespaceHealth(cluster, namespace string)  // Invalidate all health for namespace
}
```

### 2. Handler Layer Integration

**File**: `handlers/health.go`
**Function**: `ClusterHealth()` - Lines 28-106

**Modification Points**:

```go
// In the namespace loop (around line 64)
for _, ns := range nss {
    // EXISTING: Extract params
    p := namespaceHealthParams{}
    p.extract(conf, r, ns)

    // NEW: Check cache first
    cacheKey := buildHealthCacheKey(p.ClusterName, ns, p.Type, p.RateInterval)
    if cachedHealth, found := kialiCache.GetNamespaceHealth(cacheKey); found {
        // Use cached health
        result.AppHealth[ns] = cachedHealth.AppHealth
        continue
    }

    // EXISTING: Cache miss - compute as before
    switch p.Type {
    case "app":
        health, err := businessLayer.Health.GetNamespaceAppHealth(...)
        // NEW: Store in cache
        kialiCache.SetNamespaceHealth(cacheKey, health)
        result.AppHealth[ns] = &health
    // ...
    }
}
```

### 3. Business Layer Extension

**File**: `business/health.go`

**Considerations**:

- Business layer should remain pure (no cache logic)
- Handler layer manages cache
- Business layer computes health on-demand

**No changes needed** for Approach 2 (on-demand caching)

**For Approach 1/3** (background refresh):

- Create new `HealthCacheService` in business layer
- Implement `RefreshNamespaceHealth(cluster, namespace string) error`
- Called by background monitor

### 4. Configuration Extension

**File**: `config/config.go`
**Lines**: 446-464 (CacheExpirationConfig)

**Add**:

```go
type CacheExpirationConfig struct {
    // ...existing...
    Health        time.Duration `yaml:"health,omitempty"`
}

// In defaults (line 973)
Health: 30 * time.Second,
```

**Optional** (for advanced features):

```go
type HealthCacheConfig struct {
    Enabled              bool          `yaml:"enabled"`
    TTL                  time.Duration `yaml:"ttl"`
    BackgroundWarmup     bool          `yaml:"background_warmup"`
    WarmupInterval       time.Duration `yaml:"warmup_interval"`
    HotNamespaceAccesses int           `yaml:"hot_namespace_accesses"`
}
```

### 5. Server Initialization

**File**: `cmd/server.go`
**Function**: `run()` - Lines 52-150

**Integration Point** (around line 145):

```go
// After: cpm.PollIstiodForProxyStatus(ctx)
if conf.ExternalServices.Istio.IstioAPIEnabled {
    cpm.PollIstiodForProxyStatus(ctx)
}

// NEW: Start health cache monitor (if background warmup enabled)
if conf.HealthCache.BackgroundWarmup {
    healthMonitor := NewHealthCacheMonitor(cache, &layer, conf)
    healthMonitor.StartHealthCacheRefresh(ctx)
}
```

---

## Code Quality Assessment

### Strengths

- ✅ **Well-structured layers**: Clear separation between handlers, business, and data layers
- ✅ **Existing cache infrastructure**: Mature store implementation with expiration support
- ✅ **Consistent patterns**: Background jobs, cache lookups follow established patterns
- ✅ **Thread-safe**: Proper use of mutexes and thread-safe stores
- ✅ **Configurable**: Comprehensive configuration system
- ✅ **Observable**: Logging and tracing infrastructure in place

### Areas for Improvement

- ⚠️ **Prometheus cache**: Global periodic flush is crude; per-entry TTL would be better
- ⚠️ **Handler complexity**: `ClusterHealth` loops could be parallelized
- ⚠️ **Error handling**: Some errors are logged but not propagated
- ⚠️ **Cache invalidation**: No event-driven invalidation (e.g., on K8s resource changes)

### Testing Infrastructure

- Unit tests exist for handlers (`handlers/health_test.go`)
- Mock Prometheus client available (`prometheustest.PromClientMock`)
- Fake K8s client available (`kubetest.FakeK8sClient`)
- **Gap**: No cache-specific tests for health

---

## Recommendations for Implementation

### Minimal Viable Change (Approach 2)

1. **Add health store** to `kialiCacheImpl` (5 lines)
2. **Add interface methods** to `KialiCache` (3 methods)
3. **Modify handler** to check cache before computing (20 lines)
4. **Add configuration** for health TTL (3 lines)
5. **Add metrics** for cache hit/miss (10 lines)

**Total**: ~50-70 lines of code changes

### Medium Complexity (Approach 2 + Optimizations)

- Above + parallelized namespace computation
- Above + batched Prometheus queries
- Above + cache invalidation on K8s events

**Total**: ~150-200 lines of code changes

### Full Solution (Approach 3)

- Above + background health monitor
- Above + access tracking for hot namespaces
- Above + advanced configuration options
- Above + comprehensive metrics

**Total**: ~300-400 lines of code changes

---

## Dependencies and Risks

### Dependencies

- ✅ **store package**: Stable, well-tested
- ✅ **config package**: Stable, extensible
- ✅ **business layer**: May need minor refactoring for testability
- ⚠️ **Prometheus**: Query patterns may need optimization

### Risks

- **Stale data**: Users may see outdated health information
  - _Mitigation_: Configurable TTL, default to short duration (30s)
- **Memory usage**: Caching many namespaces could increase memory
  - _Mitigation_: Monitor memory, add cache size limits if needed
- **Cache invalidation**: K8s changes won't immediately invalidate cache
  - _Mitigation_: Acceptable for health data (eventual consistency)
- **Multi-cluster complexity**: Cache keys must include cluster
  - _Mitigation_: Already handled in existing cache patterns

---

## Next Steps

For Phase 2 (Requirements Definition):

1. Define exact cache key structure
2. Specify API contracts (ensure no breaking changes)
3. Define configuration schema in detail
4. Identify all test scenarios
5. Define metrics to expose
6. Create sequence diagrams for cache flows
