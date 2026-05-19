---
scribe:
  title: "Graph Engine"
  description: "Traffic graph computation, appenders, telemetry pipelines, graph caching"
  watch_paths: [graph/, prometheus/]
  scan: "5b5a2d914858e50b0072a7b3fbf6c92e564908c1"
  freshness: 100
  human_input: 9
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

**Only namespace graphs are cached.** Node-detail graphs (`GraphNode`) are always generated fresh. Namespace graphs are cached **per browser session** — keyed by the session cookie value (`SessionID`) extracted from each request. The per-session (not per-options) key is a deliberate security choice: different users have different RBAC scopes, so cross-user cache sharing would risk leaking data from one user's namespace view into another's. Multiple tabs in the same browser share one session and one cached graph. Different browsers or incognito windows have separate sessions.

Graph caching is enabled by default (`kiali_internal.graph_cache.enabled: true`) and configured under the `kiali_internal.graph_cache` section (a deliberately obscure path — this is an internal tuning knob, not a user-facing setting). Defaults: `refresh_interval: "60s"`, `inactivity_timeout: "10m"`, `max_cache_memory_mb: 1000`.

### `GraphCacheConfig`

| Field | Type | Default | Purpose |
|---|---|---|---|
| `Enabled` | bool | true | Enable/disable graph caching globally |
| `RefreshInterval` | string (duration) | `"60s"` | Background refresh period |
| `InactivityTimeout` | string (duration) | `"10m"` | Evict session graphs idle longer than this |
| `MaxCacheMemoryMB` | int | 1000 | Memory cap across all cached sessions |

### `GraphCache` interface (`graph/graph_cache.go`)

`GraphCacheImpl` is the concrete type created by `NewGraphCache(ctx, config)` in `router.go`. Its `sessionGraphs map[string]*CachedGraph` is the in-memory store, protected by a `sync.RWMutex`.

`GetSessionGraph` updates `LastAccessed` on every read. The internal method `getSessionGraphInternal` reads without updating `LastAccessed` — used by the `RefreshJob` so that background checks don't artificially extend session lifetimes.

Memory estimation: `EstimateGraphMemory(trafficMap)` computes `(nodes × 3 KB) + (edges × 1 KB) × 1.1` overhead. The estimate is calculated once on first `SetSessionGraph` and reused on subsequent updates — on the assumption that graph size is stable between refreshes.

Memory enforcement: before storing a new graph, `checkMemoryLimits` evicts the least-recently-used sessions (`evictLRU`) until the projected total falls below `MaxCacheMemoryMB`. Evictions are tracked by the `kiali_graph_cache_evictions_total` Prometheus counter (cache hits and misses are tracked by `kiali_graph_cache_hits_total` and `kiali_graph_cache_misses_total`).

### Request flow (`handlers/graph.go:graphNamespacesWithCache`)

Every `GraphNamespaces` request passes through `graphNamespacesWithCache`:

1. **Cache disabled or no SessionID** → call `api.GraphNamespaces` directly (no caching).
2. **Historical query** (`QueryTimeProvided = true`, explicit `queryTime` param) → bypass cache, generate fresh graph, leave any existing cache/job intact. This allows graph replay without disrupting the live background refresh.
3. **Client bypass** (`RefreshInterval <= 0`) → stop the session's refresh job, evict the cached graph, generate fresh graph. Used when the user turns off auto-refresh in the UI.
4. **Cache hit + options match** → return the cached `TrafficMap` converted to config format immediately. If the requested `RefreshInterval` has changed, call `job.UpdateInterval(newInterval)` to adjust the background ticker without interrupting the running job.
5. **Cache miss or options mismatch** → generate graph via `api.GraphNamespaces`, store in cache, start a new `RefreshJob` for the session.

`graphOptionsMatch` compares namespaces, duration, graph type, inject-service-nodes, idle-edges, boxBy, appenders, and rate settings. It deliberately **ignores `QueryTime`** — the background refresh handles time progression automatically.

### `RefreshJob` (`graph/refresh_job.go`)

Each session gets one `RefreshJob` goroutine, managed by a `RefreshJobManager` (one per server, created in `routing/router.go`). The job lifecycle:

**Start pattern (interval/2 offset):**
```
NewRefreshJob → go job.Start()
  |-- wait interval/2 --> fire first refresh
  |-- create time.NewTicker(interval) --> fire subsequent refreshes
```

The first refresh fires at `interval/2` rather than `interval`. This reduces worst-case staleness when a user first loads the graph: on average the cached data will be at most `interval/2` old rather than `interval` old. This is a heuristic approximation, not a hard guarantee.

**Refresh cycle (`refresh` method):**
1. `getSessionGraphInternal` — checks the session's graph exists without touching `LastAccessed`.
2. Inactivity check — if `time.Since(LastAccessed) > InactivityTimeout`, evict and stop.
3. Update `Options.QueryTime` to `time.Now()` in a copy — this is the **moving time window** that keeps the cached graph current.
4. Call `graphGenerator(ctx, refreshedOptions)` — the `GraphGenerator` function (type `func(ctx, Options) (TrafficMap, error)`) injected at cache-miss time.
5. On success: call `SetSessionGraph` with the fresh `TrafficMap`, preserving the original `LastAccessed` timestamp.
6. On error: log and return — the stale graph remains in cache. The job will retry on the next tick.

**Panic recovery:** If `graphGenerator` panics, the deferred recovery logs the stack trace, evicts the session graph, and calls `Stop()`. A panic means the refresh cycle is broken, and serving a stale graph would be misleading — the next user request becomes a cache miss and regenerates from scratch.

**Interval changes:** `UpdateInterval(newInterval)` cancels any pending ticker, starts a goroutine that waits `newInterval/2` then fires a refresh, then sends a new `time.Ticker` to the `Start` loop via `resetChan`. A context (`updateIntervalCancel`) guards against concurrent `UpdateInterval` calls racing each other.

**Stopping:** `Stop()` closes `stopChan` and cancels the job's context, which unblocks the `select` in `Start`. The `RefreshJobManager.StopAll()` is called on server shutdown.

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
