---
scribe:
  title: "Business Logic Layer"
  description: "Core service-mesh domain logic — apps, workloads, health, Istio config, mesh topology"
  watch_paths: [business/, models/, cache/]
  scan: "5b5a2d914858e50b0072a7b3fbf6c92e564908c1"
  freshness: 100
  human_input: 25
  completeness: 80
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "layer-pattern", heading: "The Layer Pattern"}
    - {id: "domain-concepts", heading: "Key Domain Concepts"}
    - {id: "models", heading: "Models Package"}
    - {id: "checkers-validators", heading: "Checkers and Validators"}
    - {id: "kubernetes-client", heading: "Kubernetes Client Interface"}
  stale_flags: []
---

# Business Logic Layer

> TL;DR: The `business/` package provides per-request service objects (organised into a `Layer` struct) that implement all domain logic for Kiali's REST API — fetching and aggregating apps, workloads, services, health, Istio config, mesh topology, and validations. It talks to Kubernetes via `kubernetes.UserClientInterface` (user-scoped) and to a singleton `KialiCache` backed by Kubernetes informers.

## Overview

The business layer sits between HTTP handlers (`handlers/`) and the Kubernetes / Prometheus client packages. Its responsibilities are:

- Fetching and combining raw Kubernetes + Istio objects into Kiali domain models.
- Computing derived information: health status, mTLS status, Istio config validations, proxy status.
- Serving as the coordination point between data from multiple clusters.
- Writing to Kubernetes/Istio when wizards or editors create/update/delete config.

The package is intentionally stateless with respect to the caller — a new `Layer` is constructed for every authenticated request using the caller's token.

## The Layer Pattern

**`business/layer.go`** defines the central `Layer` struct:

```go
type Layer struct {
    App          AppService
    Health       HealthService
    IstioConfig  IstioConfigService
    IstioStatus  IstioStatusService
    Tracing      TracingService
    Mesh         MeshService
    Namespace    NamespaceService
    ProxyLogging ProxyLoggingService
    ProxyStatus  ProxyStatusService
    Svc          SvcService
    TLS          TLSService
    Validations  IstioValidationsService
    Workload     WorkloadService
}
```

`Layer` is instantiated by `NewLayer()` (the public API) which accepts:

| Parameter | Purpose |
|---|---|
| `conf *config.Config` | Global Kiali configuration |
| `cache cache.KialiCache` | Shared in-memory cache |
| `cf kubernetes.ClientFactory` | Client factory; `NewLayer` calls `cf.GetClients(authInfos)` internally to derive per-user clients |
| `prom prometheus.ClientInterface` | Prometheus client for metrics / health |
| `traceClient tracing.ClientInterface` | Jaeger/Tempo client |
| `cpm ControlPlaneMonitor` | Control-plane component monitoring |
| `grafana *grafana.Service` | Grafana link builder |
| `discovery istio.MeshDiscovery` | Mesh topology discovery |
| `authInfos map[string]*api.AuthInfo` | Per-cluster auth credentials from the request context; used to create RBAC-scoped user clients |

`NewLayer` derives both per-user clients and SA clients from the factory, then delegates to the private `newLayer(userClients, kialiSAClients, ...)`. Callers never pass raw client maps directly.

Each service struct holds a pointer back to the `Layer` so it can invoke sibling services (e.g. `AppService` calls `Workload` and `Health` services).

`NewLayerWithSAClients` is a convenience variant that uses the Kiali SA clients as user clients — used in test helpers and background jobs where user tokens are irrelevant.

## Service Structs

### `AppService` (`business/apps.go`)

Groups Kubernetes `Deployment`/`ReplicaSet`/`StatefulSet`/`DaemonSet` workloads by the `app` label into the Kiali "Application" concept. Key methods:

- `GetAppList(ctx, criteria AppCriteria)` — returns `models.AppList`, optionally including health and Istio resources.
- `GetApp(ctx, criteria AppCriteria)` — returns a single `models.App` with its constituent workloads, services, and optional health.

`AppCriteria` carries: `AppName`, `Cluster`, `IncludeHealth`, `IncludeIstioResources`, `Namespace`, `QueryTime`, `RateInterval`.

### `SvcService` (`business/services.go`)

Aggregates Kubernetes `Service` objects with related Istio config and health. `ServiceCriteria` controls what is included (`IncludeHealth`, `IncludeIstioResources`, `IncludeOnlyDefinitions`, `ServiceSelector`).

### `WorkloadService` (`business/workloads.go`)

Fetches individual workloads (Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, OpenShift DeploymentConfigs). Supports log streaming via `StreamPodLogs`, proxy configuration, and workload-level health.

### `HealthService` (`business/health.go`)

Computes health from two sources:

1. **Prometheus** — request error rates from `istio_requests_total` (and equivalent TCP/gRPC metrics).
2. **Kubernetes pod statuses** — `WorkloadStatus` (desired vs ready replicas).

The `HealthCalculator` (constructed internally by `NewHealthService` via `NewHealthCalculator(conf)`) applies configurable thresholds from `health_config.go` and honours custom health annotations on workloads. Results are written back to the cache after computation (`kialiCache.UpdateServiceHealth` / `UpdateAppHealth` / `UpdateWorkloadHealth`).

`NamespaceHealthCriteria` drives bulk namespace-level health requests:

```go
type NamespaceHealthCriteria struct {
    IncludeMetrics bool
    Namespace      string
    Cluster        string
    QueryTime      time.Time
    RateInterval   string
}
```

### `IstioConfigService` (`business/istio_config.go`)

CRUD operations for all Istio and Gateway API resources. `IstioConfigCriteria` has a boolean flag for every supported resource type, allowing callers to request only what they need:

Istio networking: `IncludeGateways`, `IncludeVirtualServices`, `IncludeDestinationRules`, `IncludeServiceEntries`, `IncludeSidecars`, `IncludeWorkloadEntries`, `IncludeWorkloadGroups`, `IncludeEnvoyFilters`, `IncludeWasmPlugins`, `IncludeTelemetry`.

Istio security: `IncludeAuthorizationPolicies`, `IncludePeerAuthentications`, `IncludeRequestAuthentications`.

Gateway API: `IncludeK8sGateways`, `IncludeK8sGRPCRoutes`, `IncludeK8sHTTPRoutes`, `IncludeK8sInferencePools`, `IncludeK8sReferenceGrants`, `IncludeK8sTCPRoutes`, `IncludeK8sTLSRoutes`.

Two string filter fields narrow results further: `LabelSelector` (a raw label selector string applied to all fetched resources) and `WorkloadSelector` (when non-empty, suppresses `VirtualServices`, `DestinationRules`, `ServiceEntries`, and `WorkloadEntries` — resource types not applicable to workload-selector-scoped config. Istio `Gateways` and Gateway API resources are not suppressed by this field).

### `IstioValidationsService` (`business/istio_validations.go`)

Orchestrates Istio configuration validation by:

1. Collecting the full Istio config for the requested namespaces (via `IstioConfigService`).
2. Running all applicable checker implementations (from `business/checkers/`) in parallel.
3. Merging results into `models.IstioValidations` and caching them.

### `IstioStatusService` (`business/istio_status.go`)

Checks that Istio control-plane components (istiod, ingress gateways, etc.) are healthy by inspecting their Deployment ready/desired replica counts. Results are stored in `KialiCache`.

When mapping workloads to Istio app components, `getStatusOf()` resolves the app label name dynamically via `conf.GetAppLabelName(workload.Labels)` rather than using the static `config.IstioAppLabel` constant. This means custom app label configurations (e.g. `app.kubernetes.io/name`) are honoured when correlating workloads with Istio status components.

### `MeshService` (`business/mesh.go`)

Uses `istio.MeshDiscovery` to build a `models.Mesh` — the topology of clusters, control planes, and their interconnections.

### `TLSService` (`business/tls.go`)

Computes the mesh-wide and per-namespace mTLS status by inspecting PeerAuthentication and DestinationRule resources.

### `NamespaceService` (`business/namespaces.go`)

Lists namespaces accessible to the caller's token across all clusters, applies label filters from Kiali config, and caches results per token.

### `ProxyStatusService` (`business/proxy_status.go`) and `ProxyLoggingService` (`business/proxy_logging.go`)

Interface with istiod's debug endpoints to retrieve Envoy proxy sync status and adjust per-pod proxy logging levels.

### `TracingService` (`business/tracing.go`)

Queries Jaeger/Tempo for distributed traces and correlates them with apps/services/workloads.

## Key Domain Concepts

### Application vs Workload vs Service

| Concept | Definition |
|---|---|
| **Application** | A logical grouping of workloads sharing the same `app` label value |
| **Workload** | A concrete Kubernetes controller (Deployment, StatefulSet, DaemonSet, Job, CronJob, OpenShift DeploymentConfig) |
| **Service** | A Kubernetes `Service` object |

A single Application can have multiple Workloads (e.g. `reviews-v1` and `reviews-v2` are both part of the `reviews` app), and a Workload can back multiple Services.

### Health Status

Health is represented as a three-tier structure:

```
AppHealth / ServiceHealth / WorkloadHealth
  └── Requests: RequestHealth
        ├── Inbound: map[protocol]map[responseCode]float64
        ├── Outbound: map[protocol]map[responseCode]float64
        └── HealthAnnotations: map[string]string
  └── WorkloadStatuses: []*WorkloadStatus   (app and workload health only)
  └── Status: *CalculatedHealthStatus
        ├── ErrorRatio: float64   (0-100)
        ├── Status: HealthStatus  (Healthy | Degraded | Failure | NotReady | NA)
        └── TotalRequestRate: float64
```

Namespace-level health (`models.ClustersNamespaceHealth`) pre-aggregates all entities into `NamespaceHealthBucket` (listing names in each status bucket) so the Overview page can display counts without fetching individual health.

### Istio Config Model (`models/istio_config.go`)

`IstioConfigList` holds typed slices for every Istio and Gateway API resource kind. The struct uses `json:"-"` on all fields and implements a custom `MarshalJSON` that produces a two-key JSON object: `resources` (a map keyed by GVK string, e.g. `networking.istio.io/v1, Kind=VirtualService`) and `validations` (the `IstioValidations` map). This allows the frontend to receive a uniform resource map alongside inline validations regardless of which resource types were requested.

### Validations (`models/istio_validation.go`)

```go
type IstioValidations map[IstioValidationKey]*IstioValidation

type IstioValidationKey struct {
    Name      string
    Namespace string
    ObjectGVK schema.GroupVersionKind
    Cluster   string
}

type IstioValidation struct {
    Name      string
    Namespace string
    ObjectGVK schema.GroupVersionKind
    Cluster   string
    Valid      bool
    Checks    []*IstioCheck   // list of warning/error findings
    References []IstioValidationKey
}
```

## Models Package

`models/` contains data-transfer objects (DTOs) returned by the REST API. Key files:

| File | Purpose |
|---|---|
| `app.go` | `AppList`, `AppListItem`, `ClusterApps` |
| `workload.go` | `WorkloadList`, `WorkloadListItem`, `ClusterWorkloads` — supports Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, DeploymentConfigs |
| `health.go` | `AppHealth`, `ServiceHealth`, `WorkloadHealth`, `RequestHealth`, `NamespaceAppHealth`, `NamespaceServiceHealth`, `NamespaceWorkloadHealth`, `CalculatedHealthStatus` |
| `istio_config.go` | `IstioConfigList`, `IstioConfigDetails` — all Istio + Gateway API resource types |
| `istio_validation.go` | `IstioValidations`, `IstioValidationKey`, `IstioValidation`, `IstioCheck` |
| `mesh.go` | `Mesh`, `ControlPlane`, `KubeCluster`, `KialiInstance`, `ExternalKialiInstance` |
| `destination_rule.go` | Wrappers around the Istio CR with computed fields |
| `dashboards.go` | Grafana/Prometheus dashboard metadata |
| `metrics.go` | `MetricsQuery` and time-series metric types |
| `mtls_status.go` | `MTLSStatus` |
| `health_config.go` | Health threshold configuration structures |
| `health_cache.go` | `CachedHealthData` used by the cache layer |

`WorkloadListItem` carries the `WorkloadGVK` field (a `schema.GroupVersionKind`) so the frontend can distinguish between different workload controller types. The `LogType` enum (`app`, `proxy`, `waypoint`, `ztunnel`) controls which container's logs are streamed.

## Cache Architecture

**`cache/cache.go`** defines `KialiCache` — a singleton used across all requests. It is backed by the Kiali service-account token so it has access to all namespaces regardless of the caller's RBAC. Callers are responsible for filtering returned objects to what the user's token can access.

### What is cached

| Data | Cache key | Notes |
|---|---|---|
| Kubernetes objects (pods, deployments, etc.) | per cluster | Via controller-runtime `client.Reader` (informer cache). Pods and Services are trimmed by `cache/transform.go` — only `Name`, `Namespace`, `Labels`, `Annotations`, `OwnerReferences`, `CreationTimestamp`, and relevant Spec fields are kept in memory. |
| Namespaces | `token + cluster` | TTL controlled by `CacheTokenNamespaceDuration` config |
| Health data | `cluster:namespace` | Written by background health jobs and individual handlers |
| Gateways (Istio) | singleton `"gateways"` | Refreshed by background job |
| Waypoints (Istio ambient) | singleton `"waypoints"` | Refreshed by background job |
| Istio component status | singleton `"istioStatus"` | Refreshed by background job |
| Mesh topology | singleton `"mesh"` | Refreshed by background job |
| Istio config validations | `IstioValidationKey` | Written after validation runs |
| Proxy status | `cluster:namespace:pod` | Written by proxy-status background job |
| Ztunnel config dumps | `cluster:namespace:pod` | Written by ztunnel dump background job |

### Health Pre-Compute (`business/health_cache.go`, `business/health_status_exporter.go`)

`HealthMonitor` is a background goroutine that pre-computes health for every namespace in every cluster and stores the results in `KialiCache`. It is created by `NewHealthMonitor` in `cmd/server.go` and started via `hcm.Start(ctx)` after the cache is initialized. Enabled/disabled via `kiali_internal.health_cache.enabled` (default: true). The compute schedule is controlled by `health_config.compute` (not `kiali_internal`):

| Config field | Default | Purpose |
|---|---|---|
| `health_config.compute.duration` | `"5m"` | Prometheus rate window for each health query |
| `health_config.compute.refresh_interval` | `"3m"` | How often the full refresh cycle runs |
| `health_config.compute.timeout` | `"10m"` | Max wall-clock time for a single full refresh cycle |

**Start behavior**: `Start` returns immediately; the initial refresh and all subsequent refreshes run in a background goroutine. Panics in either the initial or periodic refresh are recovered — a failed cycle logs the error but does not crash the server.

**Refresh cycle** (`RefreshHealth`):
1. Reads current cluster list from `cache.GetClusters()`.
2. Creates a single `Layer` using SA clients (shared across all namespaces in the cycle).
3. For each cluster, calls `refreshClusterHealth`:
   a. Calls `layer.Namespace.GetClusterNamespaces` to get the Kiali-visible namespace list (respects namespace filtering config).
   b. Pre-fetches **all workloads for the cluster** in one `GetAllWorkloads` call and partitions them by namespace. This avoids N per-namespace cluster-wide workload fetches that the per-namespace health APIs would trigger independently.
   c. For each namespace: computes app, service, and workload health. App and workload health use the pre-fetched workload slice; service health calls `GetNamespaceServiceHealth` per-namespace (services are natively namespace-scoped and don't require the cluster-wide pre-fetch optimization).
4. Writes a `models.CachedHealthData` struct to the cache via `cache.SetHealth(cluster, namespace, data)`.

**RBAC note**: health is computed with the Kiali SA token, not per-user tokens. All users see the same pre-computed health data. Namespace-level RBAC filtering (which namespaces a user can see) is enforced upstream — within visible namespaces, health data is shared.

**Duration catch-up**: `calculateDuration()` normally uses `health_config.compute.duration`. If a refresh cycle was delayed (elapsed time since last run exceeds the configured duration), the Prometheus query window is extended to `elapsed × 1.1` to cover the gap.

**Health status metrics** (`business/health_status_exporter.go`): optionally exports per-entity health severity as Prometheus gauge `kiali_health_status` (enabled by `server.observability.metrics.health_status.enabled`, disabled by default). The `HealthStatusExporter` tracks a per-entity `naStreak` counter to avoid deleting metric series on transient NA status — series are deleted only after `server.observability.metrics.health_status.max_consecutive_na` (default: 3) consecutive NA or missing refresh cycles.

**Reconciliation**: after each namespace refresh, `ReconcileNamespace` advances the NA streak for entities that disappeared from the namespace (services/apps/workloads that were deleted). `ReconcileDroppedNamespacesForCluster` and `ReconcileDroppedClusters` handle namespace and cluster removal respectively.

### Cache invalidation

- **Namespace cache**: cleared per-cluster via `RefreshTokenNamespaces(cluster)`.
- **Health cache**: individual entries can be updated in-place (`UpdateAppHealth`, `UpdateServiceHealth`, `UpdateWorkloadHealth`) using copy-on-write semantics protected by `healthUpdateMutex`. The background `HealthMonitor` overwrites entire namespace entries via `SetHealth`.
- **Kube cache**: backed by controller-runtime informers; invalidation is handled by the informer framework (watch events).
- **Validation cache**: the `ValidationWatcher` `store.Store` holds config hashes to detect when a re-validation run is needed.

### `KubeCache` access

`GetKubeCache(cluster string)` returns a `client.Reader` (the controller-runtime informer cache for that cluster). Most Kubernetes object reads in the business layer go through this interface. However, some operations bypass the informer cache and call the Kubernetes API directly — notably namespace listing (`GetNamespaces` uses `k8s.CoreV1().Namespaces().List()`), pod log streaming, and certain workload list operations that use client-go directly.

## Checkers and Validators

`business/checkers/` implements a two-level interface hierarchy:

```go
// Checker validates a single field within an object
type Checker interface {
    Check() ([]*models.IstioCheck, bool)
}

// ObjectChecker validates one or more objects of the same kind
type ObjectChecker interface {
    Check() models.IstioValidations
}

// GroupChecker validates a group of related objects
type GroupChecker interface {
    Check() models.IstioValidations
}
```

Top-level checker files dispatch to per-resource checker packages:

| Checker file | Resource(s) validated |
|---|---|
| `destination_rules_checker.go` | DestinationRule |
| `gateway_checker.go` | Istio Gateway |
| `k8sgateway_checker.go` | Gateway API Gateway |
| `k8shttproute_checker.go` | HTTPRoute |
| `k8sgrpcroute_checker.go` | GRPCRoute |
| `k8sreferencegrants_checker.go` | ReferenceGrant |
| `virtual_service_checker.go` | VirtualService |
| `authorization_policies_checker.go` | AuthorizationPolicy |
| `peer_authentication_checker.go` | PeerAuthentication |
| `request_authentication_checker.go` | RequestAuthentication |
| `service_entry_checker.go` | ServiceEntry |
| `sidecars_checker.go` | Sidecar |
| `no_service_checker.go` | cross-references (orphaned config) |
| `service_checker.go` | Service |
| `workloads_checker.go` | Workload-level cross-checks |
| `workload_groups_checker.go` | WorkloadGroup |
| `wasm_plugin_checker.go` | WasmPlugin |
| `telemetries_checker.go` | Telemetry |

Within each resource's package (`gateways/`, `virtualservices/`, `destinationrules/`, etc.) individual `Checker` implementations each validate a single concern (e.g. a gateway selector match, a virtual service route weight sum, a destination rule subset existence).

`EmptyValidValidations` / `EmptyValidValidation` in `checker.go` provide zero-value valid validation objects that individual checkers start from and append findings to.

## Kubernetes Client Interface

Each service struct receives `userClients map[string]kubernetes.UserClientInterface` — a map from cluster name to a Kubernetes client scoped to the authenticated user's token. This means all reads and writes automatically enforce the user's RBAC. The Kiali SA clients (`saClients`) are only used for operations that genuinely require elevated access (e.g. reading mesh-wide namespace lists, checking webhook configurations).

The `observability` package wraps business layer methods with OpenTelemetry spans (`observability.StartSpan`) and exposes Prometheus internal metrics (`internalmetrics`) for operation timing. Internal Prometheus metrics (e.g. `GetGraphAppenderTimePrometheusTimer`) are distinct from the Istio telemetry queried for the traffic graph.
