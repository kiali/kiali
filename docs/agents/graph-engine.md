---
scribe:
  title: "Graph Engine"
  description: "Traffic graph computation, appenders, telemetry pipelines, graph caching"
  watch_paths: [graph/, prometheus/]
  scan: "HEAD"
  freshness: 60
  human_input: 0
  completeness: 83
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "data-model", heading: "Graph Data Model"}
    - {id: "metadata-keys", heading: "Metadata Keys"}
    - {id: "options", heading: "Graph Options"}
    - {id: "telemetry-pipeline", heading: "Telemetry Pipeline"}
    - {id: "prometheus-queries", heading: "Prometheus Queries"}
    - {id: "appender-pipeline", heading: "Appender Pipeline"}
    - {id: "appenders-reference", heading: "Appenders Reference"}
    - {id: "caching", heading: "Graph Caching and Background Refresh"}
    - {id: "api", heading: "Graph API Entry Point"}
    - {id: "prometheus-client", heading: "Prometheus Client"}
  stale_flags: []
---

# Graph Engine

> TL;DR: The graph engine builds a directed traffic graph by querying Prometheus for Istio telemetry (`istio_requests_total` and related metrics), constructing a `TrafficMap` of typed nodes and edges, then running a pipeline of appenders that enrich the graph with health, security policy, Istio config decorations, and Ambient/waypoint topology. Namespace graph results are cached per browser session and refreshed in the background; node-detail graphs are never cached.

## Overview

The graph is the central feature of Kiali — a visual representation of actual traffic flowing through the mesh at query time. The graph engine is responsible for:

1. Translating HTTP request parameters into a well-typed `Options` struct.
2. Querying Prometheus for raw traffic telemetry.
3. Building a `TrafficMap` (directed graph of nodes and edges) from the query results.
4. Enriching the graph via an ordered pipeline of `Appender` implementations.
5. Converting the internal `TrafficMap` into a serialisable config format (currently `graph/config/common`) for the frontend.
6. Caching the resulting graph per session and refreshing it in the background.

All graph code lives under `graph/`. The Istio-specific telemetry implementation lives under `graph/telemetry/istio/`.

## Graph Data Model

### `TrafficMap` (`graph/types.go`)

```go
type TrafficMap map[string]*Node
```

A map from node ID to `*Node`. IDs are deterministic strings derived from node identity (cluster + namespace + workload/app/version/service + graph type).

### `Node`

```go
type Node struct {
    ID        string
    NodeType  string   // "app" | "service" | "workload" | "box" | "aggregate" | "unknown"
    Cluster   string
    Namespace string
    Workload  string
    App       string
    Version   string
    Service   string
    Edges     []*Edge
    Metadata  Metadata // open-ended key-value enrichment
}
```

Node types:

| `NodeType` | Description |
|---|---|
| `app` | An app-label group; in `versionedApp` graph type this includes `Version` |
| `workload` | A concrete Kubernetes workload controller |
| `service` | A Kubernetes Service (injected when `injectServiceNodes=true`) |
| `box` | A grouping node (`isBox` metadata = "app" | "cluster" | "namespace") |
| `aggregate` | A traffic aggregation node for a Prometheus metric attribute |
| `unknown` | Traffic from sources outside the mesh |

When constructing nodes, unnecessary fields are trimmed per type: service nodes drop `App`/`Workload`/`Version`; workload nodes with `Unknown` app or version labels have those fields cleared.

### `Edge`

```go
type Edge struct {
    Source   *Node
    Dest     *Node
    Metadata Metadata
}
```

Edges carry traffic protocol, response codes, rates, and security policy metadata.

### Special node identities

- `BlackHoleCluster` / `PassthroughCluster` — Envoy internal cluster names for dropped/passthrough traffic; marked with `IsEgressCluster` metadata.
- `Unknown` — the `"unknown"` sentinel used when Istio cannot determine source/destination labels.

## Metadata Keys

`graph/meta.go` defines typed constants for all metadata keys used on nodes and edges:

**Node metadata keys** (selection):

| Key | Type | Meaning |
|---|---|---|
| `isAmbient` | bool | Node is in the Ambient mesh |
| `isDead` | bool | No backing workload found |
| `isEgressCluster` | bool | BlackHole or Passthrough cluster |
| `isEgressGateway` | bool | Istio egress gateway |
| `isGatewayAPI` | bool | Gateway API ingress gateway |
| `isIngressGateway` | bool | Istio ingress gateway |
| `isIdle` | bool | No incoming traffic (idle service) |
| `isInaccessible` | bool | Outside caller's RBAC scope |
| `isMTLS` | bool | Edge is mTLS-encrypted |
| `isOutOfMesh` | bool | Missing sidecar or not ambient |
| `isOutside` | bool | Node is outside the requested namespaces |
| `isRoot` | bool | Traffic source with no inbound edges |
| `isServiceEntry` | bool | Backed by an Istio ServiceEntry |
| `isWaypoint` | bool | Ambient waypoint proxy node |
| `hasCB` | bool | Has circuit breaker (DestinationRule) |
| `hasFaultInjection` | bool | VirtualService fault injection |
| `hasMirroring` | bool | VirtualService traffic mirroring |
| `hasTrafficShifting` | bool | VirtualService traffic shifting |
| `hasVS` | bool | Has an associated VirtualService |
| `hasWorkloadEntry` | bool | Backed by a WorkloadEntry |
| `healthData` | any | Raw health data for the node |
| `healthStatus` | string | Calculated health status |
| `labels` | map | Kubernetes labels |
| `responseTime` | float64 | p50/p95/p99/avg response time |
| `throughput` | float64 | Bytes/sec throughput |
| `destPrincipal` | string | mTLS destination principal |
| `sourcePrincipal` | string | mTLS source principal |

**Edge metadata keys** include: `protocol`, `responseTime`, `throughput`, `isMTLS`, `destServices`.

## Graph Options

`graph/options.go` defines all parameters for a single graph request.

### Top-level `Options`

```go
type Options struct {
    ConfigVendor    string  // "common" (default)
    TelemetryVendor string  // "istio" (default)
    ConfigOptions
    TelemetryOptions
}
```

### `TelemetryOptions`

Key fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `Duration` | `time.Duration` | 10m | Prometheus look-back window |
| `GraphType` | string | `"workload"` | `"workload"` \| `"app"` \| `"versionedApp"` \| `"service"` |
| `QueryTime` | int64 | now | Unix timestamp for the query |
| `Namespaces` | `NamespaceInfoMap` | — | Namespaces to graph |
| `IncludeIdleEdges` | bool | false | Include edges with 0 traffic |
| `InjectServiceNodes` | bool | false | Insert Service nodes between source and dest |
| `Rates.Http` | string | `"requests"` | `"requests"` \| `"none"` |
| `Rates.Grpc` | string | `"requests"` | `"requests"` \| `"sent"` \| `"received"` \| `"total"` |
| `Rates.Tcp` | string | `"sent"` | `"sent"` \| `"received"` \| `"total"` \| `"none"` |
| `Rates.Ambient` | string | `"total"` | `"none"` \| `"total"` \| `"waypoint"` \| `"ztunnel"` |
| `BoxBy` | string | `"none"` | `"app"` \| `"cluster"` \| `"namespace"` \| `"none"` |
| `Appenders` | `RequestedAppenders` | all | Comma-separated appender names, or all |
| `SessionID` | string | — | Browser session cookie value (for cache keying) |
| `RefreshInterval` | `time.Duration` | — | Requested background refresh interval |

### Node graph options (`NodeOptions`)

Used for single-node detail views:

```go
type NodeOptions struct {
    Aggregate      string
    AggregateValue string
    App            string
    Cluster        string
    Namespace      NamespaceInfo
    Service        string
    Version        string
    Workload       string
}
```

`NewOptions(r, businessLayer, conf)` parses all of the above from the HTTP request's path variables and query parameters.

## Telemetry Pipeline

### Entry point: `graph/api/api.go`

`GraphNamespaces(ctx, business, prom, o)` and `GraphNode(ctx, business, prom, o)` are the two public functions called by the HTTP handlers.

For the Istio telemetry vendor, both functions call into `graph/telemetry/istio/istio.go`.

### `BuildNamespacesTrafficMap` (`graph/telemetry/istio/istio.go`)

The algorithm (from the package comment):

```
Step 1) For each namespace:
  a) Query Prometheus to retrieve source-destination dependencies.
     Build a namespace-level TrafficMap.
  b) Apply namespace-scoped appenders (non-finalizers) to the namespace map.
  c) Merge the namespace map into the global TrafficMap.

Step 2) For the global TrafficMap:
  a) Apply finalizer appenders to the complete graph.
  b) Convert to the requested config format (Common) and return.
```

If `graphType == "service"`, `telemetry.ReduceToServiceGraph()` condenses the final map.

`MergeTrafficMaps` (in `graph/telemetry/common.go`) merges two maps by preferring the namespace-local copy of duplicate nodes (which has all appender info applied) and deduplicating edges.

### Ambient waypoints

Before querying namespaces, if `Rates.Ambient != "none"`, the engine calls `GetWaypointMap()` to build a lookup of ambient waypoint nodes. This is used by the `AmbientAppender` finalizer to correctly model waypoint-routed traffic.

## Prometheus Queries

`buildNamespaceTrafficMap` in `istio.go` fires multiple Prometheus instant-vector queries for each namespace:

### HTTP / gRPC (`istio_requests_total`)

The query group-by labels are:

```
source_cluster, source_workload_namespace, source_workload,
source_canonical_service, source_canonical_revision,
destination_cluster, destination_service_namespace,
destination_service, destination_service_name,
destination_workload_namespace, destination_workload,
destination_canonical_service, destination_canonical_revision,
request_protocol, response_code, grpc_response_status, response_flags
```

Up to four queries are issued per namespace:

0. **Incoming source telemetry** — captures failed requests that never reach a destination workload (unserviced namespace services).
1. **Incoming Ambient source telemetry** — for Ambient namespaces only (conditional); captures traffic from non-waypoint ingress gateways that would not appear in destination telemetry.
2. **Incoming destination telemetry** — the primary query; captures all traffic arriving at workloads in the namespace.
3. **Outgoing source telemetry** — captures traffic leaving the namespace.

The `reporter` label filter (`source` vs `destination`) is controlled by `util.GetReporter(side, rates)`.

### TCP (`istio_tcp_sent_bytes_total` / `istio_tcp_received_bytes_total`)

Similar query structure for TCP byte-rate traffic.

### gRPC messages (`istio_*_messages`)

Detected by `grpcMetric = regexp.MustCompile("istio_.*_messages")` and handled separately.

### Result population

`populateTrafficMap(ctx, trafficMap, &trafficVector, metric, o, globalInfo)` iterates the Prometheus result vector and creates or updates `Node` and `Edge` entries in the map. Nodes are created with `NewNode(cluster, serviceNS, service, workloadNS, workload, app, version, graphType)` which computes a deterministic ID.

A SHA-256 hash (`tsHash`) of each time-series label set is stored in node metadata to detect whether telemetry has changed between cache refreshes.

## Appender Pipeline

### Appender interface (`graph/appender.go`)

```go
type Appender[T any] interface {
    AppendGraph(ctx context.Context, trafficMap TrafficMap,
                globalInfo *GlobalInfo[T],
                namespaceInfo *AppenderNamespaceInfo[T])
    IsFinalizer() bool  // true = runs once on the final merged graph
    Name() string       // used to select appenders via query param
}
```

`GlobalInfo[T]` holds the business layer, Prometheus client, config, cluster list, and vendor-specific `Vendor T` (`*GlobalIstioInfo` for Istio).

`GlobalIstioInfo` caches data that multiple appenders share:

- `AmbientWaypoints` — map of waypoint node keys
- `AppsMap` — app list items keyed by `cluster:namespace`
- `ServiceEntryHosts` — service entry host sets
- `ServiceLists` — service lists per namespace
- `WorkloadLists` — workload lists per namespace
- `WorkloadMap` — workload-to-node mapping (finalizers only)

### Appender execution order

Namespace-scoped appenders run **per namespace** in this order:

1. `ServiceEntryAppender` — marks nodes backed by ServiceEntry objects; must run first so other appenders can rely on `IsServiceEntry`.
2. `DeadNodeAppender` — removes nodes with no traffic and no backing workload (reduces noise for subsequent appenders).
3. `WorkloadEntryAppender` — decorates nodes backed by WorkloadEntry objects.
4. `ResponseTimeAppender` — queries Prometheus for `istio_request_duration_milliseconds` histograms (p50/p95/p99/avg) and attaches `responseTime` metadata to edges and nodes.
5. `SecurityPolicyAppender` — queries Prometheus for mTLS `connection_security_policy` labels and attaches `isMTLS` / principal metadata.
6. `ThroughputAppender` — queries Prometheus for byte-rate metrics and attaches `throughput` metadata.
7. `AggregateNodeAppender` — injects aggregate nodes for a specified Prometheus metric attribute (default `request_operation`).
8. `IdleNodeAppender` — injects service nodes that exist but have no active traffic (only for service-type graphs with `injectServiceNodes`).
9. `MeshCheckAppender` — marks nodes that are out of mesh (`isOutOfMesh`).

Finalizer appenders run once on the **complete merged graph**:

1. `ExtensionsAppender` — adds nodes/edges from configured external extensions (always runs first).
2. `OutsiderAppender` — marks nodes outside the requested namespaces as `isOutside` / `isInaccessible` (always runs).
3. `IstioAppender` — decorates nodes and edges with Istio config presence (`hasVS`, `hasCB`, `hasFaultInjection`, etc.).
4. `AmbientAppender` — models Ambient mesh waypoint routing; re-wires edges to surface waypoint nodes.
5. `HealthAppender` — computes and attaches health status to all nodes using the traffic data collected during graph generation (runs after `OutsiderAppender` so inaccessible nodes are skipped).
6. `LabelerAppender` — attaches Kubernetes labels to nodes.
7. `TrafficGeneratorAppender` — marks root nodes that are pure traffic generators (always runs last).

Callers can request a subset of appenders via the `appenders` query parameter (comma-separated names). The `OutsiderAppender` and `TrafficGeneratorAppender` always run regardless.

## Appenders Reference

| Name constant | Type | Query param name | Purpose |
|---|---|---|---|
| `AggregateNodeAppenderName` | namespace | `aggregateNode` | Inject aggregate traffic nodes |
| `DeadNodeAppenderName` | namespace | `deadNode` | Remove stale nodes |
| `IdleNodeAppenderName` | namespace | `idleNode` | Add idle service nodes |
| `MeshCheckAppenderName` | namespace | `meshCheck` | Mark out-of-mesh nodes. Also accepts legacy alias `sidecarsCheck` (maps to the same appender for backward compatibility) |
| `ResponseTimeAppenderName` | namespace | `responseTime` | Attach p50/p95/p99/avg latency |
| `SecurityPolicyAppenderName` | namespace | `securityPolicy` | Attach mTLS metadata |
| `ServiceEntryAppenderName` | namespace | `serviceEntry` | Mark ServiceEntry-backed nodes |
| `ThroughputAppenderName` | namespace | `throughput` | Attach byte-rate throughput |
| `WorkloadEntryAppenderName` | namespace | `workloadEntry` | Mark WorkloadEntry-backed nodes |
| `AmbientAppenderName` | finalizer | `ambient` | Model waypoint routing |
| `HealthAppenderName` | finalizer | `health` | Attach health status |
| `IstioAppenderName` | finalizer | `istio` | Attach Istio config decorations |
| `LabelerAppenderName` | finalizer | `labeler` | Attach Kubernetes labels |
| `ExtensionsAppenderName` | finalizer | (always) | Add extension nodes |
| `OutsiderAppenderName` | finalizer | (always) | Mark outside/inaccessible nodes |
| `TrafficGeneratorAppenderName` | finalizer | (always) | Mark traffic generator roots |

## Graph Caching and Background Refresh

### `GraphCache` (`graph/graph_cache.go`)

```go
type GraphCache interface {
    ActiveSessions() int
    Clear()
    Config() *GraphCacheConfig
    Enabled() bool
    Evict(sessionID string)
    GetGraphGenerator() GraphGenerator
    GetSessionGraph(sessionID string) (*CachedGraph, bool)
    SetGraphGenerator(generator GraphGenerator)
    SetSessionGraph(sessionID string, cached *CachedGraph) error
    TotalMemoryMB() float64
}
```

**Only namespace graphs are cached** — node-detail graphs (`GraphNode`) are explicitly not cached and always generated fresh. Namespace graphs are cached **per browser session** (keyed by the session cookie value extracted from each request). Multiple tabs in the same browser share one session and one cached graph. Different browsers or incognito windows have separate sessions.

### `CachedGraph`

```go
type CachedGraph struct {
    LastAccessed    time.Time
    Options         Options
    RefreshInterval time.Duration  // user's requested refresh interval
    Timestamp       time.Time      // when the graph was generated
    TrafficMap      TrafficMap
    estimatedMB     float64        // estimated memory in MB
}
```

### `GraphCacheConfig`

| Field | Purpose |
|---|---|
| `Enabled` | Whether graph caching is active |
| `InactivityTimeout` | How long to keep a cached graph for an inactive session |
| `MaxCacheMemoryMB` | Memory cap across all cached sessions |
| `RefreshInterval` | Default refresh interval |

### Background refresh via `RefreshJob` (`graph/refresh_job.go`)

When a session's graph is first cached (or its refresh interval changes), a `RefreshJob` goroutine is started. The job:

1. Waits for the requested `RefreshInterval` using a `time.Ticker`.
2. Calls the injected `GraphGenerator` function to regenerate the graph with a moving query time window.
3. Updates `SetSessionGraph` with the new `CachedGraph`.

The `GraphGenerator` type is `func(ctx context.Context, options Options) (TrafficMap, error)` — injected via `SetGraphGenerator` so the cache has no direct dependency on the API layer.

Cache options comparison (`GraphOptionsMatch`) is used to determine whether a new request's options fundamentally differ from the cached graph (e.g. different namespaces, graph type, or rate settings), in which case the cache is invalidated and a fresh graph is generated.

If `queryTime` is explicitly provided in the request (historical query), the cache is bypassed (`QueryTimeProvided` flag).

## Graph API Entry Point

`graph/api/api.go` exposes:

```go
func GraphNamespaces(ctx, business, prom, o) (code int, graphConfig interface{}, trafficMap TrafficMap)
func GraphNode(ctx, business, prom, o) (code int, graphConfig interface{})
```

`graphNamespacesIstio`:

1. Gets cluster list from `business.Mesh.Clusters()`.
2. Creates `GlobalInfo` (business layer, Prometheus client, config, clusters, `NewGlobalIstioInfo()`).
3. Calls `istio.BuildNamespacesTrafficMap(ctx, o.TelemetryOptions, globalInfo)`.
4. Calls `generateGraph(ctx, trafficMap, o)` which invokes the config vendor's `NewConfig()` to produce the serialisable graph config.

The HTTP handlers in `handlers/` extract `Options` from the request, check the session graph cache, and call these functions only on a cache miss or invalidation.

Internal Prometheus metrics track graph generation time (`GetGraphGenerationTimePrometheusTimer`), per-appender time (`GetGraphAppenderTimePrometheusTimer`), and total node count (`SetGraphNodes`).

## Prometheus Client

`prometheus/client.go` provides:

- **`Client`** struct wrapping `prom_v1.API` with helper methods for instant and range queries.
- **`QueryRecorder`** — a `prom_v1.API` wrapper that logs all queries and their results to a file (used for test recording).

The `ClientInterface` is the abstraction used throughout the business layer and graph engine. A no-op implementation (`noop_client.go`) is available for testing.

`prometheus/metrics.go` defines helper types for building Prometheus label matchers, and `prometheus/types.go` defines response data structures used by the business layer's metrics/dashboards feature.

The graph engine calls Prometheus via `graph.PromQuery(ctx, query, ts, promApi, conf)` (defined in `graph/util.go`), which wraps `promApi.Query()` with error handling that panics with a structured `graph.Error` — these panics are caught at the handler level and converted to HTTP 500 responses.
