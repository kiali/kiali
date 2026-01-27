# Phase 3: Detailed Design - Health Pre-Computation

**Date**: 2026-01-19 (Updated: 2026-01-26)  
**Status**: Implementation Complete - Ready for Integration Testing

> **Session Update (2026-01-26)**: Added Traffic Graph Health section documenting the migration of graph node and edge health calculation to the backend.

---

## Table of Contents

1. [Overview](#overview)
2. [File-by-File Implementation Plan](#file-by-file-implementation-plan)
3. [Data Structures](#data-structures)
4. [Interface Definitions](#interface-definitions)
5. [Implementation Steps](#implementation-steps)
6. [Data Flow](#data-flow)
7. [Error Handling](#error-handling)
8. [Prometheus Metrics](#prometheus-metrics)
9. [Backend Health Status Calculation Design](#backend-health-status-calculation-design)
10. [Testing Strategy](#testing-strategy)
11. [Frontend Changes (Completed)](#frontend-changes-completed)
12. [Traffic Graph Health (Completed)](#traffic-graph-health-completed)

---

## Overview

This document provides the detailed design for implementing health pre-computation in Kiali. The design follows existing patterns in the codebase, particularly the `controlPlaneMonitor` pattern for background polling.

### Key Design Decisions (from Phase 2)

- **Refresh interval**: 2 minutes (configurable)
- **Rate interval**: Default 0 (auto from elapsed time since last run)
- **Cache expiration**: None (continuous overwrites)
- **Cache miss behavior**: Return "Unknown" health status
- **Feature flag**: Always enabled (no disable option)
- **Individual updates**: Cache entries updatable independently

### Architectural Decision: Monitor Pattern vs Controller Pattern

We chose the **monitor pattern** (background goroutine with periodic polling) over a Kubernetes controller pattern for the following reasons:

1. **Time-driven vs Event-driven**: Health computation is inherently time-driven (run every N minutes), not event-driven. Kubernetes controllers are designed to reconcile resources in response to events (create, update, delete). There is no natural Kubernetes resource that triggers health computation.

2. **No resource to reconcile**: Controllers watch resources and reconcile them to a desired state. Health computation doesn't reconcile any Kubernetes resource - it queries Prometheus and caches results. There is no "desired state" to achieve.

3. **Consistency with existing patterns**: The `controlPlaneMonitor` in Kiali uses the same pattern for periodically polling istiod for proxy status and registry data. Using the same pattern keeps the codebase consistent and easier to understand.

4. **Simplicity**: A goroutine with `time.After` loop is simpler than setting up controller-runtime infrastructure for a non-reconciliation use case. Less code means fewer bugs and easier maintenance.

5. **Controller benefits are achievable separately**: Benefits like leader election (for HA) and graceful shutdown can be added independently if needed. The current implementation already handles graceful shutdown via context cancellation.

**When controllers ARE appropriate in Kiali:**

- The validation controller watches Istio configuration changes and triggers re-validation - this is event-driven and fits the controller pattern.

---

## File-by-File Implementation Plan

### New Files

| File                       | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `business/health_cache.go` | HealthMonitor - background job for pre-computing health |
| `models/health_cache.go`   | CachedHealthData struct and related types               |

### Modified Files

| File                 | Changes                                          |
| -------------------- | ------------------------------------------------ |
| `config/config.go`   | Add Health config struct                         |
| `cache/cache.go`     | Add health store and GetHealth/SetHealth methods |
| `cmd/server.go`      | Initialize and start HealthMonitor               |
| `handlers/health.go` | Read from cache (ClusterHealth endpoint)         |

---

## Data Structures

### File: `models/health_cache.go`

```go
package models

import (
    "time"
)

// CachedHealthData stores pre-computed health data with metadata
type CachedHealthData struct {
    // AppHealth stores health for all apps in a namespace
    // Key is app name
    AppHealth NamespaceAppHealth `json:"appHealth,omitempty"`

    // ServiceHealth stores health for all services in a namespace
    // Key is service name
    ServiceHealth NamespaceServiceHealth `json:"serviceHealth,omitempty"`

    // WorkloadHealth stores health for all workloads in a namespace
    // Key is workload name
    WorkloadHealth NamespaceWorkloadHealth `json:"workloadHealth,omitempty"`

    // ComputedAt is when this health data was computed
    ComputedAt time.Time `json:"computedAt"`

    // RateInterval is the rate interval used for this computation
    RateInterval string `json:"rateInterval"`

    // Cluster is the cluster this health data is for
    Cluster string `json:"cluster"`

    // Namespace is the namespace this health data is for
    Namespace string `json:"namespace"`
}

// HealthCacheKey generates the cache key for health data
func HealthCacheKey(cluster, namespace string) string {
    return "health:" + cluster + ":" + namespace
}
```

### File: `config/config.go` (additions)

```go
// Health provides configuration for health pre-computation
type Health struct {
    // CacheRefreshInterval is the interval between health cache refreshes
    // Default: 2m
    CacheRefreshInterval time.Duration `yaml:"cache_refresh_interval,omitempty"`

    // RateInterval is the rate interval for Prometheus health queries
    // 0 means auto-calculate from elapsed time since last run
    // Default: 0
    RateInterval time.Duration `yaml:"rate_interval,omitempty"`

    // MetricsExportEnabled enables exporting health metrics to Prometheus
    // Only applies when Server.Observability.Metrics.Enabled is also true
    // Default: true
    MetricsExportEnabled bool `yaml:"metrics_export_enabled,omitempty"`

    // RefreshTimeout is the maximum time allowed for a refresh cycle
    // Default: 5m
    RefreshTimeout time.Duration `yaml:"refresh_timeout,omitempty"`

    // ClusterProcessingDelay is the delay between processing clusters
    // Helps avoid overwhelming Prometheus
    // Default: 10s
    ClusterProcessingDelay time.Duration `yaml:"cluster_processing_delay,omitempty"`
}
```

**Default values** (add to `NewConfig()`):

```go
Health: Health{
    CacheRefreshInterval:   2 * time.Minute,
    RateInterval:           0, // 0 means auto from elapsed time
    MetricsExportEnabled:   true,
    RefreshTimeout:         5 * time.Minute,
    ClusterProcessingDelay: 10 * time.Second,
},
```

---

## Interface Definitions

### File: `cache/cache.go` (additions to KialiCache interface)

```go
type KialiCache interface {
    // ... existing methods ...

    // GetHealth returns cached health data for a namespace
    // Returns nil and false if not found
    GetHealth(cluster, namespace string) (*models.CachedHealthData, bool)

    // SetHealth stores health data in cache
    // Can be called by background job OR by individual handlers
    // to update specific entries independently
    SetHealth(cluster, namespace string, data *models.CachedHealthData)

    // GetAllHealthKeys returns all health cache keys
    // Useful for iteration and cleanup
    GetAllHealthKeys() []string
}
```

### File: `business/health_cache.go`

```go
package business

import (
    "context"
    "time"

    "github.com/rs/zerolog"

    "github.com/kiali/kiali/cache"
    "github.com/kiali/kiali/config"
    "github.com/kiali/kiali/kubernetes"
    "github.com/kiali/kiali/log"
    "github.com/kiali/kiali/models"
    "github.com/kiali/kiali/prometheus"
)

// HealthCacheMonitor is an interface for the health cache monitor.
// This is an interface for testing purposes.
type HealthCacheMonitor interface {
    // Start begins the background health computation loop
    Start(ctx context.Context)
}

// NewHealthCacheMonitor creates a new health cache monitor
func NewHealthCacheMonitor(
    cache cache.KialiCache,
    clientFactory kubernetes.ClientFactory,
    conf *config.Config,
    prom prometheus.ClientInterface,
) *healthCacheMonitor {
    return &healthCacheMonitor{
        cache:         cache,
        clientFactory: clientFactory,
        conf:          conf,
        prom:          prom,
        logger:        log.Logger().With().Str("component", "health-cache-monitor").Logger(),
        lastRunTime:   time.Time{}, // Zero value indicates first run
    }
}

type healthCacheMonitor struct {
    cache         cache.KialiCache
    clientFactory kubernetes.ClientFactory
    conf          *config.Config
    prom          prometheus.ClientInterface
    logger        zerolog.Logger
    lastRunTime   time.Time
}

// Start begins the background health computation loop
func (h *healthCacheMonitor) Start(ctx context.Context) {
    interval := h.conf.Health.CacheRefreshInterval
    h.logger.Info().Msgf("Starting health cache monitor with refresh interval: %s", interval)

    // Prime the cache immediately on startup
    if err := h.refreshHealthCache(ctx); err != nil {
        h.logger.Error().Err(err).Msg("Initial health cache refresh failed")
    }

    go func() {
        for {
            select {
            case <-ctx.Done():
                h.logger.Info().Msg("Stopping health cache monitor")
                return
            case <-time.After(interval):
                if err := h.refreshHealthCache(ctx); err != nil {
                    h.logger.Error().Err(err).Msg("Health cache refresh failed")
                }
            }
        }
    }()
}

// refreshHealthCache refreshes health data for all namespaces in all clusters
func (h *healthCacheMonitor) refreshHealthCache(ctx context.Context) error {
    startTime := time.Now()
    h.logger.Debug().Msg("Starting health cache refresh")

    // Calculate rate interval
    rateInterval := h.calculateRateInterval()

    // Get all clusters
    clusters := h.cache.GetClusters()
    if len(clusters) == 0 {
        h.logger.Warn().Msg("No clusters available for health cache refresh")
        return nil
    }

    var totalNamespaces, successCount, failCount int

    for _, cluster := range clusters {
        if err := h.refreshClusterHealth(ctx, cluster.Name, rateInterval); err != nil {
            h.logger.Error().Err(err).Str("cluster", cluster.Name).Msg("Failed to refresh cluster health")
            failCount++
        } else {
            successCount++
        }

        // Delay between clusters to avoid overwhelming Prometheus
        if h.conf.Health.ClusterProcessingDelay > 0 {
            select {
            case <-ctx.Done():
                return ctx.Err()
            case <-time.After(h.conf.Health.ClusterProcessingDelay):
            }
        }
    }

    h.lastRunTime = startTime
    duration := time.Since(startTime)
    h.logger.Info().
        Int("clusters", len(clusters)).
        Int("namespaces", totalNamespaces).
        Int("success", successCount).
        Int("failed", failCount).
        Dur("duration", duration).
        Msg("Health cache refresh complete")

    return nil
}

// calculateRateInterval returns the rate interval to use for Prometheus queries
func (h *healthCacheMonitor) calculateRateInterval() string {
    configured := h.conf.Health.RateInterval

    // If configured value is non-zero, use it
    if configured > 0 {
        return configured.String()
    }

    // Auto-calculate from elapsed time since last run
    if h.lastRunTime.IsZero() {
        // First run - use refresh interval
        return h.conf.Health.CacheRefreshInterval.String()
    }

    elapsed := time.Since(h.lastRunTime)
    // Add small buffer to ensure we capture all data
    return elapsed.String()
}

// refreshClusterHealth refreshes health for all namespaces in a cluster
func (h *healthCacheMonitor) refreshClusterHealth(ctx context.Context, cluster, rateInterval string) error {
    // Get SA clients for this cluster
    saClients := h.clientFactory.GetSAClients()
    client, ok := saClients[cluster]
    if !ok {
        return fmt.Errorf("no client available for cluster: %s", cluster)
    }

    // Get all namespaces accessible to Kiali
    namespaces, err := h.getAccessibleNamespaces(ctx, cluster)
    if err != nil {
        return fmt.Errorf("failed to get namespaces for cluster %s: %w", cluster, err)
    }

    queryTime := time.Now()

    for _, ns := range namespaces {
        if err := h.refreshNamespaceHealth(ctx, cluster, ns, rateInterval, queryTime); err != nil {
            h.logger.Warn().Err(err).
                Str("cluster", cluster).
                Str("namespace", ns).
                Msg("Failed to refresh namespace health, continuing with others")
            // Continue processing other namespaces
        }
    }

    return nil
}

// refreshNamespaceHealth computes and caches health for a single namespace
func (h *healthCacheMonitor) refreshNamespaceHealth(
    ctx context.Context,
    cluster, namespace, rateInterval string,
    queryTime time.Time,
) error {
    // Create a temporary business layer with SA clients for health computation
    // This uses Kiali's service account, not user tokens
    layer, err := h.createSABusinessLayer(cluster)
    if err != nil {
        return fmt.Errorf("failed to create business layer: %w", err)
    }

    criteria := NamespaceHealthCriteria{
        IncludeMetrics: true,
        Namespace:      namespace,
        Cluster:        cluster,
        QueryTime:      queryTime,
        RateInterval:   rateInterval,
    }

    // Compute health for apps, services, and workloads
    appHealth, err := layer.Health.GetNamespaceAppHealth(ctx, criteria)
    if err != nil {
        return fmt.Errorf("failed to get app health: %w", err)
    }

    serviceHealth, err := layer.Health.GetNamespaceServiceHealth(ctx, criteria)
    if err != nil {
        return fmt.Errorf("failed to get service health: %w", err)
    }

    workloadHealth, err := layer.Health.GetNamespaceWorkloadHealth(ctx, criteria)
    if err != nil {
        return fmt.Errorf("failed to get workload health: %w", err)
    }

    // Store in cache
    cachedData := &models.CachedHealthData{
        AppHealth:      appHealth,
        ServiceHealth:  serviceHealth,
        WorkloadHealth: workloadHealth,
        ComputedAt:     queryTime,
        RateInterval:   rateInterval,
        Cluster:        cluster,
        Namespace:      namespace,
    }

    h.cache.SetHealth(cluster, namespace, cachedData)

    h.logger.Debug().
        Str("cluster", cluster).
        Str("namespace", namespace).
        Int("apps", len(appHealth)).
        Int("services", len(serviceHealth)).
        Int("workloads", len(workloadHealth)).
        Msg("Cached namespace health")

    return nil
}

// getAccessibleNamespaces returns namespaces accessible to Kiali's service account
func (h *healthCacheMonitor) getAccessibleNamespaces(ctx context.Context, cluster string) ([]string, error) {
    // Use cached namespaces from KialiCache
    // This respects Kiali's service account permissions
    namespaces, found := h.cache.GetNamespaces(cluster, "") // Empty token = SA token
    if !found {
        return nil, fmt.Errorf("namespaces not found in cache for cluster: %s", cluster)
    }

    result := make([]string, 0, len(namespaces))
    for _, ns := range namespaces {
        result = append(result, ns.Name)
    }
    return result, nil
}

// createSABusinessLayer creates a business layer using Kiali's service account
func (h *healthCacheMonitor) createSABusinessLayer(cluster string) (*Layer, error) {
    // Implementation will use clientFactory.GetSAClientsAsUserClientInterfaces()
    // Similar to how it's done in cmd/server.go for the validations layer
    // This is a simplified version - actual implementation may need more parameters
    return nil, nil // TODO: Implement
}
```

---

## Implementation Steps

### Step 1: Add Configuration (config/config.go)

1. Add `Health` struct definition
2. Add `Health` field to `Config` struct
3. Add default values in `NewConfig()`
4. Add environment variable mappings

**Location in Config struct** (alphabetical order):

```go
type Config struct {
    // ... existing fields ...
    Health                  Health                  `yaml:"health,omitempty"`
    // ... existing fields ...
}
```

### Step 2: Add Cache Storage (cache/cache.go)

1. Add `healthStore` field to `kialiCacheImpl`:

```go
type kialiCacheImpl struct {
    // ... existing fields ...
    healthStore store.Store[string, *models.CachedHealthData]
}
```

2. Initialize in `NewKialiCache()`:

```go
healthStore: store.New[string, *models.CachedHealthData](),
```

3. Implement interface methods:

```go
func (c *kialiCacheImpl) GetHealth(cluster, namespace string) (*models.CachedHealthData, bool) {
    key := models.HealthCacheKey(cluster, namespace)
    return c.healthStore.Get(key)
}

func (c *kialiCacheImpl) SetHealth(cluster, namespace string, data *models.CachedHealthData) {
    key := models.HealthCacheKey(cluster, namespace)
    c.healthStore.Set(key, data)
}

func (c *kialiCacheImpl) GetAllHealthKeys() []string {
    return c.healthStore.Keys()
}
```

### Step 3: Add Data Structures (models/health_cache.go)

1. Create new file with `CachedHealthData` struct
2. Add `HealthCacheKey` helper function

### Step 4: Create HealthCacheMonitor (business/health_cache.go)

1. Create the interface and implementation
2. Follow the `controlPlaneMonitor` pattern
3. Implement the refresh logic

### Step 5: Wire Up in Server Startup (cmd/server.go)

Add after the business layer is created (around line 124):

```go
// Start health cache monitor
healthCacheMonitor := business.NewHealthCacheMonitor(cache, clientFactory, conf, prom)
healthCacheMonitor.Start(ctx)
```

### Step 6: Update ClusterHealth Handler (handlers/health.go)

Modify to read from cache:

```go
func ClusterHealth(w http.ResponseWriter, r *http.Request) {
    // ... existing parameter parsing ...

    // Read from cache
    cachedData, found := cache.GetHealth(cluster, namespace)
    if !found {
        // Return "Unknown" health status
        // Build response with Unknown status for all entities
    }

    // Return cached data
    // ... build response from cachedData ...
}
```

---

## Data Flow

### Background Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HealthCacheMonitor.Start()                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Every 2 minutes (configurable):                                 │
│  1. Calculate rate interval (elapsed time or configured)         │
│  2. Get list of clusters from cache                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each cluster:                                               │
│  1. Get accessible namespaces (from cache, SA permissions)       │
│  2. Process each namespace                                       │
│  3. Delay between clusters (configurable)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each namespace:                                             │
│  1. Compute app health (via HealthService)                       │
│  2. Compute service health                                       │
│  3. Compute workload health                                      │
│  4. Store in cache: SetHealth(cluster, namespace, data)         │
└─────────────────────────────────────────────────────────────────┘
```

### API Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  GET /api/clusters/health?namespaces=...                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ClusterHealth handler:                                          │
│  1. Parse namespaces from request                                │
│  2. For each namespace: cache.GetHealth(cluster, namespace)     │
│  3. If cache miss: return "Unknown" health status               │
│  4. Build response from cached data                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response:                                                       │
│  - Same structure as current API                                 │
│  - Optional header: X-Kiali-Health-Cache-Age                    │
└─────────────────────────────────────────────────────────────────┘
```

### Individual Update Flow (Detail Pages)

```
┌─────────────────────────────────────────────────────────────────┐
│  Detail page requests fresh health with custom rateInterval      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Existing health handlers compute on-demand:                     │
│  1. Call HealthService.GetAppHealth/GetServiceHealth/etc.       │
│  2. After computation, update cache:                             │
│     cache.SetHealth(cluster, namespace, newData)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next ClusterHealth request returns updated cached value         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Background Job Errors

| Error Type                   | Handling                                    |
| ---------------------------- | ------------------------------------------- |
| Cluster unavailable          | Log error, continue with other clusters     |
| Namespace computation failed | Log warning, continue with other namespaces |
| Prometheus unavailable       | Log error, retry on next cycle              |
| Context cancelled            | Stop gracefully                             |

### API Request Errors

| Error Type         | Handling                                      |
| ------------------ | --------------------------------------------- |
| Cache miss         | Return "Unknown" health status (not an error) |
| Invalid parameters | Return 400 Bad Request (existing behavior)    |

---

## Prometheus Metrics

Health data is exported as Prometheus metrics for monitoring, alerting, and tracking health trends over time.

### Metrics Configuration

Health metrics are exported when `Server.Observability.Metrics.Enabled` is true (the global metrics setting). There is no separate toggle for health metrics.

### Metrics Overview

| Metric Name                             | Type      | Description                                               |
| --------------------------------------- | --------- | --------------------------------------------------------- |
| `kiali_health_status`                   | Gauge     | Health status of individual apps, services, and workloads |
| `kiali_health_refresh_duration_seconds` | Histogram | Time required to refresh health data per cluster          |
| `kiali_health_cache_hits_total`         | Counter   | Number of health cache hits by type                       |
| `kiali_health_cache_misses_total`       | Counter   | Number of health cache misses by type                     |

### Health Status Metric: State Cardinality Pattern

The `kiali_health_status` metric uses the **state cardinality pattern** (also known as "enum metric" pattern). For each individual app, service, or workload:

- **5 time series** are created (one per health status)
- **Exactly one** is set to `1` (the current status)
- **The others** are set to `0`

This pattern enables:

- Tracking state transitions over time
- Alerting on specific items entering failure/degraded states
- Aggregation via PromQL for counts and summaries

#### Labels

| Label         | Description    | Example Values                                      |
| ------------- | -------------- | --------------------------------------------------- |
| `cluster`     | Cluster name   | `cluster1`, `primary`                               |
| `namespace`   | Namespace name | `bookinfo`, `istio-system`                          |
| `health_type` | Type of entity | `app`, `service`, `workload`                        |
| `name`        | Entity name    | `productpage`, `reviews-v1`                         |
| `status`      | Health status  | `Healthy`, `Degraded`, `Failure`, `Not Ready`, `NA` |

#### Example Output

```prometheus
# Workload productpage in bookinfo namespace - currently Healthy
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="productpage", status="Healthy"} 1
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="productpage", status="Degraded"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="productpage", status="Failure"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="productpage", status="Not Ready"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="productpage", status="NA"} 0

# Workload reviews-v1 - currently Degraded
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="reviews-v1", status="Healthy"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="reviews-v1", status="Degraded"} 1
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="reviews-v1", status="Failure"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="reviews-v1", status="Not Ready"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="workload", name="reviews-v1", status="NA"} 0

# App details - currently Healthy
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="app", name="details", status="Healthy"} 1
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="app", name="details", status="Degraded"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="app", name="details", status="Failure"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="app", name="details", status="Not Ready"} 0
kiali_health_status{cluster="cluster1", namespace="bookinfo", health_type="app", name="details", status="NA"} 0
```

### Health Status Calculation

Health status is calculated on the backend using the same logic as the frontend. The status is determined by combining:

1. **Workload Status** (for apps and workloads):

   - `Healthy`: All replicas match (desired = current = available)
   - `Degraded`: Some replicas unavailable, or proxies not synced
   - `Failure`: No available replicas when desired > 0
   - `Not Ready`: Workload scaled to 0 (desired = 0)

2. **Request Health** (based on error rates):
   - `Healthy`: Error rate below degraded threshold
   - `Degraded`: Error rate >= 0.1% (degraded threshold)
   - `Failure`: Error rate >= 20% (failure threshold)
   - `NA`: No request data available

The overall status is the **worst** of workload status and request health.

#### Implementation

Health status calculation is implemented in `models/health_status.go`:

```go
// Key functions:
- WorkloadStatusHealth(ws *WorkloadStatus) HealthStatus
- RequestHealthStatus(requests RequestHealth, degradedThreshold, failureThreshold float64) HealthStatus
- AppHealthStatus(health *AppHealth, ...) HealthStatus
- ServiceHealthStatus(health *ServiceHealth, ...) HealthStatus
- WorkloadHealthStatus(health *WorkloadHealth, ...) HealthStatus
```

### PromQL Examples

```promql
# Count all items in Failure state
sum(kiali_health_status{status="Failure"})

# Count failures by namespace
sum by (namespace) (kiali_health_status{status="Failure"})

# List all degraded workloads
kiali_health_status{health_type="workload", status="Degraded"} == 1

# Alert: Any workload in Failure state
kiali_health_status{health_type="workload", status="Failure"} == 1

# Track state transitions for a specific workload over time
kiali_health_status{name="productpage"}

# Percentage of healthy apps in a namespace
sum(kiali_health_status{namespace="bookinfo", health_type="app", status="Healthy"})
/
count(kiali_health_status{namespace="bookinfo", health_type="app", status="Healthy"}) * 100
```

### Cardinality Considerations

The health status metric creates time series based on:

- Number of clusters × namespaces × (apps + services + workloads) × 5 statuses

For example, with:

- 2 clusters
- 50 namespaces per cluster
- Average 10 apps + 10 services + 15 workloads per namespace

Cardinality: 2 × 50 × 35 × 5 = **17,500 time series**

This is within acceptable limits for most Prometheus deployments. For very large environments, consider:

- Reducing the number of monitored namespaces
- Filtering to specific namespaces of interest
- Using Prometheus recording rules to pre-aggregate

### Metrics Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  HealthMonitor.refreshNamespaceHealth()                         │
│  1. Compute health for apps, services, workloads                │
│  2. Store in cache                                              │
│  3. If metrics enabled:                                         │
│     - Calculate health status for each item                     │
│     - Call internalmetrics.SetHealthStatusForItem()            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Prometheus scrapes /metrics endpoint                           │
│  - kiali_health_status{...} gauges exported                     │
│  - kiali_health_refresh_duration_seconds histogram              │
│  - kiali_health_cache_hits/misses counters                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

1. **health_cache_test.go**:

   - Test `calculateRateInterval()` - first run, subsequent runs, configured value
   - Test refresh logic with mocked dependencies
   - Test error handling for individual namespace failures

2. **cache_test.go** (additions):

   - Test `GetHealth()` / `SetHealth()` / `GetAllHealthKeys()`
   - Test concurrent access

3. **models/health_cache_test.go**:
   - Test `HealthCacheKey()` generation

### Integration Tests

1. End-to-end flow: Start monitor → wait for refresh → query API → verify cached data
2. Multi-cluster: Verify all clusters are processed
3. Cache miss: Verify "Unknown" status returned before first refresh

---

## Configuration Summary

```yaml
health:
  # Background refresh interval (health pre-computation is always active)
  cache_refresh_interval: 2m

  # Rate interval for Prometheus health queries
  # 0 (default): automatically calculated as elapsed time since previous run
  # Non-zero value (e.g., "10m"): uses fixed interval
  rate_interval: 0

  # Enable/disable Prometheus metrics export for health data
  # Only applies when Server.Observability.Metrics.Enabled is also true
  metrics_export_enabled: true

  # Maximum time allowed for background refresh to complete
  refresh_timeout: 5m

  # Delay between processing clusters
  cluster_processing_delay: 10s
```

---

## Backend Health Status Calculation Design

### Overview

Currently, health status (Healthy/Degraded/Failure) is calculated in the frontend from raw health data returned by the API. This design proposes moving to **backend-only calculation**, where:

1. Backend calculates health status using the same logic and configuration as frontend
2. API responses include the calculated status alongside raw data
3. Frontend displays the status without recalculating
4. Prometheus metrics use the same calculated status

### Current Frontend Logic Analysis

#### Configuration Structure

The health rate configuration (`HealthConfig.Rate`) supports sophisticated matching:

```yaml
health_config:
  rate:
    - namespace: "production" # Regex pattern
      kind: "workload" # Regex: app|service|workload
      name: "critical-.*" # Regex pattern
      tolerance:
        - code: "5XX" # Response code pattern
          protocol: "http" # http|grpc
          direction: "inbound" # inbound|outbound|.*
          degraded: 1 # % threshold
          failure: 5 # % threshold
        - code: "4XX"
          protocol: "http"
          direction: ".*"
          degraded: 10
          failure: 20
    - # Default (last entry, matches all)
      tolerance:
        - code: "5XX"
          protocol: "http"
          direction: ".*"
          failure: 10
        - code: "4XX"
          protocol: "http"
          direction: ".*"
          degraded: 10
          failure: 20
        - code: "^[1-9]$|^1[0-6]$" # gRPC error codes
          protocol: "grpc"
          direction: ".*"
          failure: 10
```

#### Frontend Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Match Rate Config                                            │
│     getRateHealthConfig(namespace, name, kind)                   │
│     - Iterate through config.rate entries                        │
│     - Match namespace/name/kind with regex                       │
│     - Return first match, or last entry (defaults)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Filter Tolerances by Direction                               │
│     tolerances.filter(tol => tol.direction.test(direction))     │
│     - For workloads: consider both inbound and outbound          │
│     - For services: typically inbound only                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Aggregate Errors by Tolerance                                │
│     For each tolerance:                                          │
│     - Filter requests by protocol (http/grpc)                    │
│     - Match response codes against tolerance.code regex          │
│     - Sum matching request counts                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Calculate Error Ratio                                        │
│     errorRatio = matchingErrors / totalRequests * 100           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Apply Thresholds                                             │
│     if (errorRatio >= failure) → FAILURE                        │
│     else if (errorRatio >= degraded) → DEGRADED                 │
│     else → HEALTHY                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Merge with Workload Status                                   │
│     For apps/workloads: merge request status with replica status │
│     Final status = worst of (request status, replica status)     │
└─────────────────────────────────────────────────────────────────┘
```

#### Health Annotations

Resources can override default tolerances via annotations:

```yaml
metadata:
  annotations:
    kiali.io/health-rate: "5XX,5,10,http,inbound;4XX,20,50,http,.*"
```

Format: `code,degraded,failure,protocol,direction` (semicolon-separated for multiple)

### Proposed Backend Implementation

#### New Types

```go
// models/health_status.go

// HealthStatus represents the calculated health status
type HealthStatus string

const (
    HealthStatusHealthy  HealthStatus = "Healthy"
    HealthStatusDegraded HealthStatus = "Degraded"
    HealthStatusFailure  HealthStatus = "Failure"
    HealthStatusNotReady HealthStatus = "Not Ready"
    HealthStatusNA       HealthStatus = "NA"
)

// CalculatedHealth contains the calculated status and metadata
type CalculatedHealth struct {
    Status           HealthStatus `json:"status"`
    StatusCode       int          `json:"statusCode"`       // Numeric for sorting: 0=NA, 1=Healthy, 2=NotReady, 3=Degraded, 4=Failure
    AppliedTolerance *Tolerance   `json:"appliedTolerance,omitempty"` // Which tolerance was applied
    ErrorRatio       float64      `json:"errorRatio,omitempty"`       // Actual error ratio (%)
}
```

#### Configuration Matching

```go
// business/health_config.go

// HealthRateMatcher provides methods to match health rate configuration
type HealthRateMatcher struct {
    conf *config.Config
    // Compiled regex cache for performance
    cache map[string]*compiledRate
}

type compiledRate struct {
    namespace *regexp.Regexp
    kind      *regexp.Regexp
    name      *regexp.Regexp
    tolerance []compiledTolerance
}

type compiledTolerance struct {
    code      *regexp.Regexp
    protocol  *regexp.Regexp
    direction *regexp.Regexp
    degraded  float32
    failure   float32
}

// GetMatchingRate returns the Rate config that matches the given entity
func (m *HealthRateMatcher) GetMatchingRate(namespace, name, kind string) *config.Rate

// GetMatchingTolerances returns tolerances that match the given protocol and direction
func (m *HealthRateMatcher) GetMatchingTolerances(rate *config.Rate, protocol, direction string) []config.Tolerance
```

#### Health Calculation Service

```go
// business/health_calculator.go

// HealthCalculator calculates health status from raw health data
type HealthCalculator struct {
    conf    *config.Config
    matcher *HealthRateMatcher
}

// CalculateAppHealth calculates status for an app
func (c *HealthCalculator) CalculateAppHealth(
    namespace, name string,
    health *models.AppHealth,
    annotations map[string]string,
) models.CalculatedHealth

// CalculateServiceHealth calculates status for a service
func (c *HealthCalculator) CalculateServiceHealth(
    namespace, name string,
    health *models.ServiceHealth,
    annotations map[string]string,
) models.CalculatedHealth

// CalculateWorkloadHealth calculates status for a workload
func (c *HealthCalculator) CalculateWorkloadHealth(
    namespace, name string,
    health *models.WorkloadHealth,
    annotations map[string]string,
) models.CalculatedHealth
```

#### Request Health Calculation Detail

```go
// CalculateRequestStatus calculates health status from request data
func (c *HealthCalculator) CalculateRequestStatus(
    requests models.RequestHealth,
    tolerances []config.Tolerance,
) (status models.HealthStatus, errorRatio float64, appliedTolerance *config.Tolerance) {

    // For each tolerance, calculate error ratio
    worstStatus := models.HealthStatusNA

    for _, tol := range tolerances {
        // Aggregate requests matching this tolerance's protocol and code pattern
        errors, total := c.aggregateMatchingRequests(requests, tol)

        if total == 0 {
            continue
        }

        ratio := (errors / total) * 100
        status := c.applyThresholds(ratio, tol.Degraded, tol.Failure)

        if models.HealthStatusPriority(status) > models.HealthStatusPriority(worstStatus) {
            worstStatus = status
            errorRatio = ratio
            appliedTolerance = &tol
        }
    }

    // If we have traffic but no errors matched any tolerance, we're healthy
    if worstStatus == models.HealthStatusNA && hasTraffic(requests) {
        worstStatus = models.HealthStatusHealthy
    }

    return worstStatus, errorRatio, appliedTolerance
}
```

### API Changes

#### Option 1: Add Status to Existing Health Types

```go
// models/health.go - Enhanced types

type AppHealth struct {
    WorkloadStatuses []*WorkloadStatus `json:"workloadStatuses"`
    Requests         RequestHealth     `json:"requests"`
    // NEW: Calculated status
    Status           *CalculatedHealth `json:"status,omitempty"`
}

type ServiceHealth struct {
    Requests RequestHealth     `json:"requests"`
    // NEW: Calculated status
    Status   *CalculatedHealth `json:"status,omitempty"`
}

type WorkloadHealth struct {
    WorkloadStatus *WorkloadStatus   `json:"workloadStatus"`
    Requests       RequestHealth     `json:"requests"`
    // NEW: Calculated status
    Status         *CalculatedHealth `json:"status,omitempty"`
}
```

#### Option 2: Separate Endpoint (Query Parameter)

Keep existing types unchanged, add `?includeStatus=true` query parameter:

```
GET /api/namespaces/{namespace}/apps/{app}/health?includeStatus=true
```

Response includes additional `status` field when requested.

**Recommendation**: Option 1 (always include status) is simpler and avoids the "two sources of truth" problem.

### Migration Path

#### Phase 1: Backend Calculation (Current Work)

- Implement `HealthCalculator` with full configuration support
- Update Prometheus metrics to use calculated status
- Backend calculates status but API doesn't return it yet

#### Phase 2: API Enhancement

- Add `Status` field to health response types
- Backend populates status in all health responses
- Frontend can optionally use backend status

#### Phase 3: Frontend Simplification

- Frontend reads status from API instead of calculating
- Remove duplicate calculation logic from frontend
- Keep frontend health types for display (colors, icons)

### Edge Cases and Considerations

#### 1. Health Annotations

- Backend must parse `kiali.io/health-rate` annotations
- Same format as frontend: `code,degraded,failure,protocol,direction`
- Annotations override config-based tolerances

#### 2. Mixed Protocol Traffic

- Entity may have both HTTP and gRPC traffic
- Each protocol matched against its tolerances
- Worst status across all protocols is used

#### 3. No Traffic

- If no requests in the rate interval → `NA` status
- Different from `Healthy` (which requires traffic with low errors)

#### 4. Workload Replica Status

- For apps/workloads, replica status is merged with request status
- Replica status: Healthy/Degraded/Failure based on available/desired replicas
- Final status = worst of (replica status, request status)

#### 5. Regex Compilation

- Compile regex patterns once and cache
- Avoid recompiling on every health calculation
- Use `HealthRateMatcher` with compiled cache

#### 6. Backward Compatibility

- Adding `Status` field to responses is additive (non-breaking)
- Frontend continues to work with or without backend status
- Gradual migration possible

### Files to Create/Modify

| File                            | Changes                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `models/health_status.go`       | Enhance with `CalculatedHealth`, update status calculation to use config |
| `business/health_config.go`     | NEW: `HealthRateMatcher` for config matching                             |
| `business/health_calculator.go` | NEW: Main calculation logic                                              |
| `business/health.go`            | Use `HealthCalculator` in health service methods                         |
| `business/health_cache.go`      | Use `HealthCalculator` for metrics export                                |
| `models/health.go`              | Add `Status` field to health types                                       |

### Decisions

1. **Should we include the applied tolerance in API responses?**

   - **Decision: No**
   - Rationale: Users can inspect the health configuration via the UI's "View Debug Info" option in the masthead dropdown. Including tolerance details in every API response would increase response size without significant benefit.

2. **Should status calculation be optional via query parameter?**

   - **Decision: No, always calculate status**
   - Rationale: In most cases the status will already be cached (computed during background refresh). For on-demand health inquiries (e.g., detail pages), the status is desired. Having a single code path simplifies the implementation.

3. **How to handle health annotation parsing errors?**

   - **Decision: Fall back to defaults with warning**
   - Rationale: Fall back to config defaults to ensure health calculation continues to work, but generate a warning in the server logs indicating there may be a problem with the annotation definitions. This allows the system to remain functional while alerting operators to potential configuration issues.

4. **Performance: Calculate on-demand vs pre-compute?**
   - **Decision: Pre-compute, or calculate when caching**
   - Rationale: Calculate the health status value during background pre-compute, or anytime health data is being cached (e.g., on-demand requests that update the cache). This ensures status is always available without additional computation at API response time.

---

## Frontend Changes (Completed)

This section documents the frontend changes implemented to support backend-calculated health status.

### Overview

List pages (Apps, Workloads, Services) now use backend-calculated health status instead of computing health client-side. This simplifies the frontend, ensures consistency with Prometheus metrics, and removes the need for users to select a duration on list pages.

### Files Modified

| File | Changes |
| ---- | ------- |
| `frontend/src/types/Health.ts` | Added `CalculatedHealthStatus` interface, `statusFromString()` helper, `getBackendStatus()` method, and `fromBackendStatus()` factory methods |
| `frontend/src/pages/AppList/AppListPage.tsx` | Removed `TimeDurationComponent`, replaced with `Refresh` only; removed `duration` from props |
| `frontend/src/pages/AppList/AppListClass.tsx` | Use `AppHealth.fromBackendStatus()` instead of `fromJson()` |
| `frontend/src/pages/WorkloadList/WorkloadListPage.tsx` | Removed `TimeDurationComponent`; use `WorkloadHealth.fromBackendStatus()` |
| `frontend/src/pages/ServiceList/ServiceListPage.tsx` | Removed `TimeDurationComponent`; use `ServiceHealth.fromBackendStatus()` |
| `frontend/src/pages/AppList/FiltersAndSorts.ts` | Health sorting uses `getBackendStatus()` and `backendStatus.errorRatio` |
| `frontend/src/pages/WorkloadList/FiltersAndSorts.ts` | Health sorting uses `getBackendStatus()` and `backendStatus.errorRatio` |
| `frontend/src/pages/ServiceList/FiltersAndSorts.ts` | Health sorting uses `getBackendStatus()` and `backendStatus.errorRatio` |
| `frontend/src/components/Filters/CommonFilters.ts` | Health filtering uses `getBackendStatus()` |
| `frontend/src/types/AppList.ts` | Removed `rateInterval` from `AppListQuery` |
| `frontend/src/types/Workload.ts` | Removed `rateInterval` from `WorkloadListQuery` |
| `frontend/src/types/ServiceList.ts` | Removed `rateInterval` from `ServiceListQuery` |

### New Types and Methods

#### `CalculatedHealthStatus` Interface

```typescript
export interface CalculatedHealthStatus {
  status: string;      // "Healthy", "Degraded", "Failure", "Not Ready", "NA", "Unknown"
  errorRatio?: number; // 0.0 to 1.0, used for sorting
}
```

#### `statusFromString()` Helper

Converts backend status string to frontend `Status` object:

```typescript
export const statusFromString = (status: string): Status => {
  switch (status) {
    case 'Healthy': return HEALTHY;
    case 'Degraded': return DEGRADED;
    case 'Failure': return FAILURE;
    case 'Not Ready': return NOT_READY;
    default: return NA;
  }
};
```

#### `getStatus()` Method

Returns backend-provided status (consolidated from former `getGlobalStatus()` and `getBackendStatus()`):

```typescript
getStatus(): Status {
  if (this.backendStatus?.status) {
    return statusFromString(this.backendStatus.status);
  }
  return NA;
}
```

> **Note**: Previously there were two methods: `getGlobalStatus()` which had a client-side fallback calculation, and `getBackendStatus()` which only returned backend status. These have been consolidated into a single `getStatus()` method that returns the backend-provided status or `NA` if not available.

#### `fromBackendStatus()` Factory Methods

Simplified factory methods for list pages that only need backend status:

```typescript
// AppHealth
public static fromBackendStatus = (json: any): AppHealth => {
  const health = new AppHealth('', '', [], { inbound: {}, outbound: {}, healthAnnotations: {} }, { rateInterval: 0 });
  health.backendStatus = json.status;
  return health;
};

// ServiceHealth and WorkloadHealth have similar implementations
```

### UI Changes

1. **Duration Dropdown Removed**: List pages no longer show a duration dropdown since health is pre-computed with a configured duration on the backend.

2. **Refresh Button Retained**: The refresh button and refresh interval dropdown remain, allowing users to control how often the page fetches data.

3. **Sorting and Filtering**: Health-based sorting and filtering now use `getBackendStatus()` which returns the backend-calculated status directly.

### API Changes

1. **`rateInterval` Parameter Removed**: List page API calls no longer include `rateInterval` query parameter since the backend uses a fixed, configured duration for cached health.

2. **Health Response Structure**: The backend now includes a `status` field in health responses:
   ```json
   {
     "workloadStatuses": [...],
     "requests": {...},
     "status": {
       "status": "Healthy",
       "errorRatio": 0.0
     }
   }
   ```

### Backward Compatibility

- Detail pages continue to use `fromJson()` with full `HealthContext` for parsing raw health data
- The `getStatus()` method returns `NA` if `backendStatus` is not present (no client-side fallback)
- All pages have been updated to use `getStatus()` which returns the backend-calculated status

---

## Next Steps

1. ~~Review this design document~~ ✓
2. ~~Clarify any questions or concerns~~ ✓ (All decisions made)
3. ~~Implement backend health calculation~~ ✓
4. ~~Implement frontend simplification~~ ✓
5. ~~Migrate traffic graph health to backend~~ ✓
6. ~~Consolidate frontend health API (`getStatus()`)~~ ✓
7. Integration testing with full backend/frontend stack

---

---

## Traffic Graph Health (Completed)

This section documents the migration of traffic graph health calculation from the frontend to the backend.

### Overview

The traffic graph previously calculated health status for nodes and edges on the frontend. This has been moved entirely to the backend's `HealthAppender`, which now:

1. **Always runs** - The health appender is no longer conditional; it's included in every graph request
2. **Calculates node health status** - Based on workload replica status and request health metrics
3. **Calculates edge health status** - Based on traffic error rates and health tolerances

This consolidates all health status logic in the backend, reduces frontend complexity, and optimizes the graph payload.

### Backend Changes

#### Modified Files

| File | Changes |
| ---- | ------- |
| `graph/meta.go` | Added `EdgeHealthStatus` as a new `MetadataKey` |
| `graph/telemetry/istio/appender/health.go` | Added edge health calculation logic |
| `graph/config/common/common.go` | Added `HealthStatus` field to `EdgeData`, removed `HasHealthConfig` from `NodeData` |
| `business/health_calculator.go` | Added `GetTolerancesForDirection()` method for edge health calculation |

#### Edge Health Calculation

The `HealthAppender` now calculates edge health using the following approach:

```go
func (a *HealthAppender) calculateEdgeHealthStatus(trafficMap graph.TrafficMap, calculator *business.HealthCalculator) {
    for _, n := range trafficMap {
        for _, e := range n.Edges {
            status := a.calculateSingleEdgeHealth(e, calculator)
            if status != models.HealthStatusNA {
                e.Metadata[graph.EdgeHealthStatus] = string(status)
            }
        }
    }
}
```

Edge health is determined by:
1. Getting the protocol and response data from edge metadata
2. Retrieving health annotations from source and destination nodes
3. Calculating tolerances for outbound (source) and inbound (destination) directions
4. Applying tolerances to calculate error-based health status
5. Returning the worst status between outbound and inbound perspectives

#### New EdgeData Field

```go
type EdgeData struct {
    // ... existing fields ...
    HealthStatus string `json:"healthStatus,omitempty"` // the health status of the edge
}
```

#### Removed NodeData Field

The `HasHealthConfig` field was removed from `NodeData` as it's no longer needed by the frontend.

### Frontend Changes

#### Removed Files

| File | Reason |
| ---- | ------ |
| `frontend/src/types/ErrorRate/GraphEdgeStatus.ts` | Edge health now calculated on backend |
| `frontend/src/types/ErrorRate/TrafficHealth.ts` | Traffic health now calculated on backend |
| `frontend/src/types/ErrorRate/__tests__/GraphEdgeStatus.test.ts` | Tests for removed file |
| `frontend/src/types/ErrorRate/__tests__/TrafficHealth.test.ts` | Tests for removed file |

#### Modified Files

| File | Changes |
| ---- | ------- |
| `frontend/src/services/GraphDataSource.ts` | Health appender now always included (unconditional) |
| `frontend/src/pages/Graph/GraphElems.tsx` | `assignEdgeHealth()` simplified to no-op (status comes from backend) |
| `frontend/src/components/TrafficList/TrafficDetails.tsx` | Added `healthStatus` to `TrafficItem`, removed `healthAnnotation` from node interfaces |
| `frontend/src/components/TrafficList/TrafficListComponent.tsx` | `getHealthStatus()` now uses backend-provided `item.healthStatus` |
| `frontend/src/types/Graph.ts` | Added `healthStatus` to `GraphEdgeData`, removed `hasHealthConfig` from `GraphNodeData` |
| `frontend/src/types/ErrorRate/index.ts` | Removed `getTrafficHealth` export |
| `frontend/src/types/ErrorRate/utils.ts` | Simplified `aggregate()` function |

### API Changes

#### Health Appender Always Active

Previously, the frontend conditionally included the `health` appender in graph requests based on whether health display was needed. Now, the health appender is always included:

```typescript
// Before (conditional)
if (fetchParams.includeHealth) {
  appenders += ',health';
}

// After (always included)
let appenders: AppenderString = 'deadNode,serviceEntry,meshCheck,workloadEntry,health';
```

#### Edge Health in Graph Response

Edges now include `healthStatus` in the response:

```json
{
  "id": "e0",
  "source": "n1",
  "target": "n2",
  "traffic": { ... },
  "healthStatus": "Healthy"  // or "Degraded", "Failure", "NA"
}
```

### Health API Consolidation

The frontend health types were simplified:

| Before | After | Notes |
| ------ | ----- | ----- |
| `getGlobalStatus()` | `getStatus()` | Renamed; always returns backend status |
| `getBackendStatus()` | (removed) | Consolidated into `getStatus()` |
| Client-side fallback | (removed) | No longer needed since backend always provides status |

The `getStatus()` method now directly returns the backend-provided status:

```typescript
getStatus(): Status {
  if (this.backendStatus?.status) {
    return statusFromString(this.backendStatus.status);
  }
  return NA;
}
```

### Benefits

1. **Consolidated Logic**: All health calculation is now in the backend
2. **Reduced Frontend Complexity**: Removed ~500 lines of frontend health calculation code
3. **Smaller Payload**: Removed `hasHealthConfig` from graph response
4. **Consistency**: Graph health uses the same calculation logic as list pages and Prometheus metrics
5. **Performance**: Health is calculated once on the backend rather than on every frontend render

### Graph Hide Consideration

The frontend "graph hide" feature visually filters elements but does not affect the underlying data. Health is calculated on the full graph on the backend, which is the correct behavior - hidden elements should still contribute to the overall health picture.

---

**Document Status**: Implementation Complete - Ready for Integration Testing
