# Health Pre-computation KEP

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#non-goals)
3. [Background](#background)
   1. [Health Status Types](#health-status-types)
   2. [Health Calculation Components](#health-calculation-components)
   3. [Where Health Is Displayed](#where-health-is-displayed)
4. [Architecture Overview](#architecture-overview)
   1. [Health Cache (List Pages, Overview, Detail Pages)](#health-cache-list-pages-overview-detail-pages)
   2. [Graph Health (Traffic Graph)](#graph-health-traffic-graph)
   3. [Why Two Separate Mechanisms](#why-two-separate-mechanisms)
5. [Health Cache Implementation](#health-cache-implementation)
   1. [Background Refresh Job](#background-refresh-job)
   2. [Cache Structure](#cache-structure)
   3. [Cache Consumers](#cache-consumers)
   4. [On-Demand Fallback](#on-demand-fallback)
   5. [Prometheus Health Metrics](#prometheus-health-metrics)
6. [Graph Health Implementation](#graph-health-implementation)
   1. [Node Health Calculation](#node-health-calculation)
   2. [Edge Health Calculation](#edge-health-calculation)
   3. [Graph Cache Integration](#graph-cache-integration)
7. [Frontend Simplification](#frontend-simplification)
   1. [Removing Client-Side Health Calculation](#removing-client-side-health-calculation)
   2. [Simplified Health API](#simplified-health-api)
   3. [Payload Optimization](#payload-optimization)
8. [Design Decisions](#design-decisions)
   1. [Backend-First Health Calculation](#backend-first-health-calculation)
   2. [Separate Health Cache and Graph Health](#separate-health-cache-and-graph-health)
   3. [Always Include Health Appender](#always-include-health-appender)
   4. [Edge Health on Backend](#edge-health-on-backend)
   5. [Removing hasHealthConfig from Payload](#removing-hashealthconfig-from-payload)

# Summary

This KEP describes Kiali's approach to health status pre-computation, consolidating all health calculation on the backend and simplifying the frontend. The work encompasses two complementary mechanisms:

1. **Health Cache**: A background refresh job that pre-computes health for all apps, services, and workloads across all namespaces. This serves the List pages, Overview page, and Detail pages.

2. **Graph Health**: Health calculation within the Traffic Graph's HealthAppender that computes node and edge health status using the graph's specific time window and traffic data.

The frontend no longer performs health status calculations; it simply displays the backend-provided status. The backend-provided status would also be available to any other clients, such as and AI.

# Motivation

Prior to this work, health calculation was fragmented across the codebase:

1. **List pages** (Apps, Services, Workloads) computed health on-demand during each API request, causing slow page loads at scale (30+ seconds for large namespaces).

2. **Traffic Graph** had a mix of backend and frontend health calculation:

   - Node health was partially calculated on the backend
   - Edge health was calculated entirely on the frontend
   - Health configuration was sent to the frontend to enable client-side calculation

3. **Overview page** required expensive per-namespace health aggregation on each refresh.

This fragmentation caused:

- **Performance issues**: Health calculation during request lifecycle caused slow API responses
- **Maintenance burden**: Health logic existed in both Go and TypeScript, requiring synchronized updates
- **Increased payload size**: Sending health configuration to the frontend added to response size
- **Frontend complexity**: Complex health calculation code in the browser

## Goals

- Pre-compute health data outside the request lifecycle to improve response times
- Consolidate all health calculation on the backend
- Simplify the frontend by removing client-side health calculation
- Reduce API payload sizes by not sending health configuration
- Ensure consistent health status across all Kiali features
- Maintain backward compatibility with existing health tolerance configurations

## Non-Goals

- Changing the fundamental health calculation algorithms or thresholds
- Adding new health status types or categories
- Requiring external storage (database) for health data
- Implementing real-time health updates (health is inherently time-windowed)

# Background

## Health Status Types

Kiali uses the following health status levels (in order of priority):

| Status    | Priority | Description                                    |
| --------- | -------- | ---------------------------------------------- |
| NA        | 0        | No health information available                |
| Healthy   | 1        | All metrics within acceptable thresholds       |
| Degraded  | 2        | Error rates exceed degraded threshold          |
| Failure   | 3        | Error rates exceed failure threshold           |
| Not Ready | 4        | Workload pods not ready (replicas unavailable) |

## Health Calculation Components

Health calculation involves several components:

1. **Health Tolerances**: Configuration that defines thresholds for degraded and failure states, specified per protocol (HTTP, gRPC), direction (inbound, outbound), and response code pattern.

2. **Health Annotations**: Per-resource annotations that can override default tolerances.

3. **Traffic Metrics**: Request rates and error rates collected from Prometheus.

4. **Workload Status**: Pod availability and proxy sync status.

## Where Health Is Displayed

Health status appears throughout Kiali:

| Location             | Data Source      | Entities Shown                    |
| -------------------- | ---------------- | --------------------------------- |
| Overview page        | Health Cache     | Namespace-level aggregated health |
| Apps List            | Health Cache     | All apps in namespace             |
| Services List        | Health Cache     | All services in namespace         |
| Workloads List       | Health Cache     | All workloads in namespace        |
| App Detail           | Health Cache/API | Single app health                 |
| Service Detail       | Health Cache/API | Single service health             |
| Workload Detail      | Health Cache/API | Single workload health            |
| Traffic Graph Nodes  | Graph Health     | App/Service/Workload nodes        |
| Traffic Graph Edges  | Graph Health     | Traffic flow health               |
| Traffic List (panel) | Graph Health     | Edge traffic in side panel        |

# Architecture Overview

## Health Cache (List Pages, Overview, Detail Pages)

The Health Cache uses a background refresh job that continuously pre-computes health for all namespaces:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Health Monitor (Background Job)                 │
│                                                                      │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────────────────────┐ │
│  │ Ticker  │───▶│ For each     │───▶│ Compute App/Svc/Wkl Health  │ │
│  │(interval)│    │ cluster/ns   │    │ via HealthCalculator        │ │
│  └─────────┘    └──────────────┘    └──────────────┬──────────────┘ │
│                                                     │                │
│                                                     ▼                │
│                                          ┌──────────────────┐       │
│                                          │   Kiali Cache    │       │
│                                          │ (Health entries) │       │
│                                          └────────┬─────────┘       │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────┐
                    │                               │               │
                    ▼                               ▼               ▼
            ┌───────────────┐             ┌──────────────┐  ┌────────────┐
            │  List Pages   │             │   Overview   │  │   Detail   │
            │ (Apps/Svc/Wkl)│             │     Page     │  │   Pages    │
            └───────────────┘             └──────────────┘  └────────────┘
```

## Graph Health (Traffic Graph)

Graph health is calculated within the graph generation pipeline, using the user's specific time window:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Graph Generation Pipeline                       │
│                                                                      │
│  ┌────────────┐    ┌────────────┐    ┌─────────────────────────────┐│
│  │ Prometheus │───▶│ Traffic    │───▶│ Appenders (Dead Node,       ││
│  │  Queries   │    │   Map      │    │ Service Entry, Health, etc) ││
│  └────────────┘    └────────────┘    └──────────────┬──────────────┘│
│                                                      │               │
│                                       ┌──────────────┴──────────────┐│
│                                       │      Health Appender        ││
│                                       │  ┌─────────────────────┐    ││
│                                       │  │ Calculate Node      │    ││
│                                       │  │ Health Status       │    ││
│                                       │  └──────────┬──────────┘    ││
│                                       │             │               ││
│                                       │  ┌──────────▼──────────┐    ││
│                                       │  │ Calculate Edge      │    ││
│                                       │  │ Health Status       │    ││
│                                       │  └─────────────────────┘    ││
│                                       └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │  Traffic Graph  │
                               │   (Frontend)    │
                               └─────────────────┘
```

## Why Two Separate Mechanisms

The Health Cache and Graph Health serve different purposes and cannot be unified:

| Aspect              | Health Cache                             | Graph Health                           |
| ------------------- | ---------------------------------------- | -------------------------------------- |
| **Time Window**     | Fixed duration (configurable, e.g., 10m) | User-specified (e.g., "last 5 min")    |
| **Scope**           | All namespaces, all entities             | User-selected namespaces/graph type    |
| **Refresh Trigger** | Background timer (interval-based)        | Graph request or cache refresh         |
| **Data Source**     | Direct Prometheus queries                | Graph traffic map (aggregated metrics) |
| **Includes Edges**  | No                                       | Yes                                    |
| **User Context**    | Service account permissions              | User's RBAC permissions                |

Attempting to use Health Cache data for the graph would result in:

- Time window mismatches (cached health for "last 10 minutes" vs graph for "last 30 minutes")
- Scope mismatches (cached health for all namespaces vs graph for selected namespaces)
- Missing edge health (Health Cache only computes entity health, not traffic flow health)

# Health Cache Implementation

## Background Refresh Job

The `HealthMonitor` runs as a background goroutine, started when Kiali initializes:

```go
type healthMonitor struct {
    cache         cache.KialiCache
    clientFactory kubernetes.ClientFactory
    conf          *config.Config
    discovery     istio.MeshDiscovery
    prom          prometheus.ClientInterface
}

func (m *healthMonitor) Start(ctx context.Context) {
    interval := m.conf.HealthConfig.Compute.RefreshInterval

    // Prime the cache with an initial refresh
    m.RefreshHealth(ctx)

    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case <-time.After(interval):
                m.RefreshHealth(ctx)
            }
        }
    }()
}
```

Each refresh cycle:

1. Iterates through all clusters
2. For each cluster, iterates through all accessible namespaces
3. Computes health for all apps, services, and workloads in each namespace
4. Stores the results in the Kiali Cache

## Cache Structure

Health data is cached per cluster/namespace with metadata:

```go
type CachedHealthData struct {
    AppHealth      NamespaceAppHealth      // map[appName]*AppHealth
    Cluster        string
    ComputedAt     time.Time
    Duration       string
    Namespace      string
    ServiceHealth  NamespaceServiceHealth  // map[svcName]*ServiceHealth
    WorkloadHealth NamespaceWorkloadHealth // map[wklName]*WorkloadHealth
}
```

Each health object includes a pre-computed `Status` field containing the final health status string.

## Cache Consumers

List pages and other consumers check the cache first:

```go
// In apps.go, services.go, workloads.go
if criteria.IncludeHealth {
    cachedHealth, _ := in.cache.GetHealth(cluster, namespace)
    if cachedHealth != nil {
        if health, found := cachedHealth.AppHealth[appItem.Name]; found {
            appItem.Health = *health  // Cache hit
        } else {
            appItem.Health = in.computeHealthOnDemand(...)  // Cache miss
        }
    }
}
```

## On-Demand Fallback

If cache is missing (cold start, new entity, cache expiry), health is computed on-demand:

- The computed health is returned to the caller
- Optionally, the cache can be updated with the computed value

## Prometheus Health Metrics

A key benefit of pre-computing health on the backend is the ability to export health status as Prometheus metrics. This enables external monitoring, alerting, and integration with existing observability infrastructure.

### Exported Metrics

The following metrics are exported when health pre-computation is enabled:

| Metric                                  | Type      | Description                                                |
| --------------------------------------- | --------- | ---------------------------------------------------------- |
| `kiali_health_status`                   | Gauge     | Health status per entity using state cardinality pattern   |
| `kiali_health_cache_hits_total`         | Counter   | Number of health cache hits by type (app/service/workload) |
| `kiali_health_cache_misses_total`       | Counter   | Number of health cache misses by type                      |
| `kiali_health_refresh_duration_seconds` | Histogram | Time required to refresh health data per cluster           |

### Health Status Metric

The `kiali_health_status` metric uses the **state cardinality pattern** for efficient alerting. For each entity, exactly one status is set to 1 while all others are 0:

```promql
kiali_health_status{
  cluster="cluster1",
  namespace="bookinfo",
  health_type="app",      # app, service, or workload
  name="reviews",
  status="Degraded"       # Healthy, Degraded, Failure, Not Ready, or NA
} 1
```

This pattern enables simple alerting rules:

```yaml
# Alert on any entity in Failure status
- alert: KialiHealthFailure
  expr: kiali_health_status{status="Failure"} == 1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "{{ $labels.health_type }} {{ $labels.name }} in {{ $labels.namespace }} is in Failure state"

# Alert on degraded entities
- alert: KialiHealthDegraded
  expr: kiali_health_status{status="Degraded"} == 1
  for: 10m
  labels:
    severity: warning
```

### Cache Performance Metrics

Cache hit/miss metrics help operators understand health cache effectiveness:

```promql
# Cache hit rate by type
sum(rate(kiali_health_cache_hits_total[5m])) by (health_type) /
(sum(rate(kiali_health_cache_hits_total[5m])) by (health_type) +
 sum(rate(kiali_health_cache_misses_total[5m])) by (health_type))
```

### Refresh Duration Metrics

The refresh duration histogram tracks health computation performance per cluster:

```promql
# 95th percentile refresh duration
histogram_quantile(0.95, rate(kiali_health_refresh_duration_seconds_bucket[5m]))
```

# Graph Health Implementation

## Node Health Calculation

The `HealthAppender` calculates node health using the `HealthCalculator`:

1. Attach health data (workload status, request rates) to each node
2. Use `HealthCalculator` to determine the final status
3. Store status in node metadata as `healthStatus`

```go
func (a HealthAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, ...) {
    a.attachHealthConfig(trafficMap, globalInfo)
    a.attachHealth(ctx, trafficMap, globalInfo)

    calculator := business.NewHealthCalculator(globalInfo.Conf)
    a.calculateHealthStatus(trafficMap, calculator)
    a.calculateEdgeHealthStatus(trafficMap, calculator)
}
```

## Edge Health Calculation

Edge health is calculated after node health, using the traffic flow data:

1. For each edge in the graph:
   - Get tolerances from source node (outbound) and destination node (inbound)
   - Merge with default tolerances
   - Match edge traffic responses against tolerance patterns
   - Calculate error ratio for matching codes
   - Apply degraded/failure thresholds
   - Store worst status in edge metadata

```go
func (a *HealthAppender) calculateSingleEdgeHealth(edge *graph.Edge, calc *HealthCalculator) HealthStatus {
    // Get tolerances from source (outbound) and destination (inbound)
    sourceTols := getNodeHealthAnnotations(edge.Source, "outbound")
    destTols := getNodeHealthAnnotations(edge.Dest, "inbound")

    // Calculate status for each direction, return worst
    outboundStatus := a.calculateEdgeStatusWithTolerances(edge.Responses, protocol, total, sourceTols)
    inboundStatus := a.calculateEdgeStatusWithTolerances(edge.Responses, protocol, total, destTols)

    return mergeStatus(outboundStatus, inboundStatus)
}
```

## Graph Cache Integration

When graph caching is enabled (see [Graph Cache KEP](../graph-cache/proposal.md)):

1. The initial graph request triggers full graph generation including health calculation
2. The graph (with health status) is cached
3. Background refresh jobs regenerate the graph with moving time windows
4. Cached graphs include pre-computed health status for both nodes and edges

# Frontend Simplification

## Removing Client-Side Health Calculation

Prior to this work, the frontend contained:

- `GraphEdgeStatus.ts` - Edge health calculation
- `TrafficHealth.ts` - Traffic health utilities
- Complex tolerance matching logic
- Fallback health calculation if backend status was missing

All of this has been removed. The frontend now:

- Receives health status as simple strings ("Healthy", "Degraded", "Failure", etc.)
- Maps status strings to display properties (icon, color, priority)
- No longer needs health tolerance configuration

## Simplified Health API

The frontend `Health` class was simplified:

```typescript
// Before: Multiple methods with fallback logic
getGlobalStatus(): Status { ... }
getBackendStatus(): Status { ... }

// After: Single method that trusts the backend
getStatus(): Status {
    if (this.backendStatus?.status) {
        return statusFromString(this.backendStatus.status);
    }
    return NA;
}
```

## Payload Optimization

The graph API response is now smaller:

**Removed from node data:**

- `hasHealthConfig` boolean field
- Health configuration objects

**Added to edge data:**

- `healthStatus` string field (small, simple)

Net result: Reduced payload size and bandwidth usage.

# Design Decisions

## Backend-First Health Calculation

**Decision**: All health status calculation happens on the backend.

**Rationale**:

- Single source of truth for health logic
- Easier to maintain and update tolerance matching
- Better performance (computed once, served many times)
- Frontend becomes a pure display layer

**Trade-offs**:

- Backend compute resources increase slightly
- Health data may be slightly stale (acceptable for Kiali's use cases)

## Separate Health Cache and Graph Health

**Decision**: Keep Health Cache and Graph Health as separate mechanisms.

**Rationale**:

- Different time windows and scopes make unification impractical
- Graph needs user-specific RBAC context
- Graph needs edge health; Health Cache doesn't
- Simpler to reason about and maintain separately

**Alternatives Rejected**:

- **Update Health Cache from Graph**: Rejected due to time window mismatches and concurrency concerns
- **Use Health Cache for Graph Nodes**: Rejected because graph uses different time windows

## Always Include Health Appender

**Decision**: The Health Appender always runs during graph generation.

**Rationale**:

- Health status is fundamental to graph visualization
- Overhead is minimal compared to overall graph generation
- Simplifies frontend by always having health data available
- Removes conditional logic based on UI toggle state

## Edge Health on Backend

**Decision**: Move edge health calculation from frontend to backend.

**Rationale**:

- Eliminates code duplication (Go and TypeScript implementations)
- Ensures consistent tolerance matching
- Reduces frontend bundle size and complexity
- Backend has direct access to configuration without payload overhead

## Removing hasHealthConfig from Payload

**Decision**: Remove `hasHealthConfig` field from graph node data.

**Rationale**:

- Only needed for frontend health calculation (now removed)
- Reduces payload size
- Simplifies data model
