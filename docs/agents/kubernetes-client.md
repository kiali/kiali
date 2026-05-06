---
scribe:
  title: "Kubernetes Client Layer"
  description: "K8s/Istio API access, multi-cluster support, client factory, offline mode, store, and config"
  watch_paths: [kubernetes/, store/, config/]
  scan: "HEAD"
  freshness: 60
  human_input: 0
  completeness: 85
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "client-interfaces", heading: "Client Interfaces"}
    - {id: "client-factory", heading: "ClientFactory: Creation and Pooling"}
    - {id: "multi-cluster", heading: "Multi-Cluster Support"}
    - {id: "offline-mode", heading: "Offline Mode"}
    - {id: "store-package", heading: "The store Package"}
    - {id: "config-package", heading: "Config Package"}
    - {id: "kubernetes-types", heading: "Kubernetes Types and Scheme"}
    - {id: "filters", heading: "Filters and Host Matching"}
    - {id: "test-client", heading: "Fake / Test Clients"}
  stale_flags: []
---

# Kubernetes Client Layer

> TL;DR: All Kubernetes, Istio, Gateway API, and OpenShift API access flows through a `ClientFactory` that vends short-lived per-user `UserClientInterface` clients (15-minute TTL) and long-lived Kiali SA `ClientInterface` clients; multi-cluster is handled by reading remote cluster secrets at startup.

## Overview

The `kubernetes/` package is the single abstraction layer between Kiali's business logic and every external API it talks to: core Kubernetes, Istio CRDs, Gateway API CRDs, OpenShift-specific APIs, and the Gateway API Inference Extension. It exposes two flavours of client and a factory that manages their lifecycle.

## Client Interfaces

`kubernetes/client.go` defines the interface hierarchy:

```
ClientInterface              (read-only; used for SA/background operations)
├── K8SClientInterface       (core Kube reads: pods, deployments, namespaces, secrets, …)
├── IstioClientInterface     (Istio CRD reads: VirtualService, DestinationRule, AuthorizationPolicy, …)
└── OSClientInterface        (OpenShift reads: Routes, OAuthClients, DeploymentConfigs, Users, …)

UserClientInterface          (read-write; used for authenticated user requests)
├── ClientInterface          (everything above)
├── K8SUserClientInterface   (Kube writes: UpdateNamespace, UpdateService, UpdateWorkload)
├── IstioUserClientInterface (Istio writes: create/update/delete Istio resources)
└── OSUserClientInterface    (OpenShift writes)
```

The concrete type `K8SClient` (in `kubernetes/client.go`) implements the full `UserClientInterface`:

```go
type K8SClient struct {
    token          string
    k8s            kube.Interface          // client-go kubernetes client
    ctrlclient.Reader                      // controller-runtime reader (cache-backed)
    projectClient  projectclient.Interface
    routeClient    routeclient.Interface
    osAppsClient   osappsclient.Interface
    oAuthClient    oauthclient.Interface
    userClient     userclient.Interface
    istioClientset istio.Interface
    gatewayapi     gatewayapiclient.Interface
    inferenceapi   inferenceapiclient.Interface
    restConfig     *rest.Config
    clusterInfo    ClusterInfo
    conf           *kialiconfig.Config
    // capability detection (lazily initialized, pointer so nil means "not checked yet")
    isOpenShift     *bool
    isGatewayAPI    *bool
    isExpGatewayAPI *bool
    hasTLSRouteInV1 *bool
    isInferenceAPI  *bool
    isIstioGateway  *bool
    isIstioAPI      *bool
    ...
}
```

`ClusterInfo` wraps the `rest.Config` with the cluster name and secret name:

```go
type ClusterInfo struct {
    ClientConfig *rest.Config
    Name         string
    SecretName   string
}
```

Capability flags (`IsOpenShift()`, `IsGatewayAPI()`, etc.) are lazily computed by probing the API server for the relevant CRDs and cached in pointer-to-bool fields (nil = not yet checked).

The convenience function `ConvertFromUserClients` downcasts a `map[string]UserClientInterface` to `map[string]ClientInterface` for code paths that must not perform writes.

## ClientFactory: Creation and Pooling

`kubernetes/client_factory.go` defines `ClientFactory` and its implementation `clientFactory`.

```go
type ClientFactory interface {
    GetClient(authInfo *api.AuthInfo, cluster string) (UserClientInterface, error)
    GetClients(authInfos map[string]*api.AuthInfo) (map[string]UserClientInterface, error)
    GetSAClient(cluster string) ClientInterface
    GetSAClients() map[string]ClientInterface
    GetSAHomeClusterClient() ClientInterface
    GetSAClientsAsUserClientInterfaces() map[string]UserClientInterface
}
```

### SA Clients (Kiali Service Account)

SA clients are created once at startup and live for the process lifetime. `NewClientFactory` creates one SA client per known cluster:
- Home cluster: `NewClient(ClusterInfo{ClientConfig: restConf, Name: homeCluster})`.
- Each remote cluster: `newSAClient(clusterInfo.ClusterInfo)` using credentials from the remote cluster secrets.

SA clients are stored in `saClientEntries map[string]UserClientInterface`. Although the underlying type is `UserClientInterface`, they are exposed as `ClientInterface` by default (read-only). Write access is only granted via `GetSAClientsAsUserClientInterfaces()` for specific cases like anonymous/RBAC-disabled modes.

### User Clients (Per-Authenticated-User)

User clients are created on demand and cached by a SHA-256 hash of the token concatenated with any impersonation fields (`Impersonate`, `ImpersonateGroups`, `ImpersonateUserExtra`) when present — so two requests with the same token but different impersonation targets get distinct cached clients. They expire after 15 minutes (`defaultExpirationTime`). A background goroutine `watchClients()` monitors the `recycleChan`; when a client's timer fires, it sends its token hash to the channel and the goroutine removes it from `clientEntries`.

`GetClient(authInfo, cluster)` checks the cache; if not found it calls `newClient(authInfo, defaultExpirationTime, cluster)`:
1. Copies the base rest config (stripped of auth fields at factory init time).
2. Sets `BearerToken = authInfo.Token`.
3. For OpenID strategy with an API proxy configured, rewrites `Host` and `TLSClientConfig` to point at the proxy (unless the token is the Kiali SA token).
4. For header strategy, applies impersonation from `authInfo.Impersonate*`.
5. Spawns a goroutine that sleeps for `expirationTime`, then sends the token hash to `recycleChan`.

`GetClients(authInfos map[string]*api.AuthInfo)` calls `GetClient` for each cluster in the map and returns the combined map.

## Multi-Cluster Support

Remote cluster credentials are stored as Kubernetes Secrets in the home cluster. `GetRemoteClusterInfos()` (`kubernetes/cluster_secret.go`) reads these secrets, decodes the embedded kubeconfig, and returns a `map[string]RemoteClusterInfo` keyed by cluster name.

`NewClientFactory` calls `GetRemoteClusterInfos()` at startup and creates one SA client for each remote cluster.

During the server start, `cmd/server.go:newManager` creates a `cluster.Cluster` for each remote cluster (using the same scheme and cache transforms as the home cluster) and adds it to the controller-runtime manager. Each remote cluster gets its own `ctrlcache.Cache` stored in `kubeCaches map[string]ctrlcache.Cache`.

A watch error handler (`makeWatchErrorHandler`) reacts to Forbidden watch errors (e.g. namespace deletion or access revocation) by removing all informers for the affected cluster to prevent a stalled cache.

Configuration knob: `conf.Clustering.IgnoreHomeCluster = true` causes Kiali to treat the home cluster as a remote-only participant — the home cluster's resources are not shown in the UI. A warning is logged if only one cluster is detected in this mode.

## Offline Mode

`kubernetes/offline/offline.go` provides `NewOfflineClient(path string)` — a `ClientInterface` that reads a directory tree of YAML files instead of talking to a live cluster.

On construction it:
1. Walks the directory recursively with `filepath.WalkDir`.
2. Parses every `.yaml` / `.yml` file using the combined Kiali scheme (see Scheme below).
3. Accumulates all `runtime.Object` instances.
4. Constructs a `kubetest.NewFakeK8sClient(objects...)`.

The returned `OfflineClient` wraps the fake client. A special `namespaces/` subdirectory is tracked separately so that pod log and config-dump responses can read from flat files on disk.

Offline mode is activated via the `kiali run offline` subcommand or via test helpers.

## The store Package

`store/store.go` defines a generic thread-safe key-value interface:

```go
type Store[K comparable, V any] interface {
    Get(key K) (V, bool)
    Items() map[K]V
    Keys() []K
    Remove(key K)
    Replace(map[K]V)
    Set(key K, value V)
    Version() uint   // monotonically incremented on each mutation
}
```

Three implementations exist in `store/`:

| File | Type | Behaviour |
|---|---|---|
| `threadsafe_store.go` | `threadSafeStore[K,V]` | Plain map + `sync.RWMutex`. Default via `store.New[K,V]()`. |
| `fifo_store.go` | `fifoStore[K,V]` (unexported; constructed via `NewFIFOStore`) | Wraps another Store; evicts the oldest entry when capacity is exceeded. |
| `expiration_store.go` | `ExpirationStore[K,V]` | Wraps another Store; runs a background goroutine that removes entries past their TTL. |

The Tempo HTTP client uses a `fifoStore` + `ExpirationStore` combination for trace-detail caching (5-minute TTL, configurable capacity). The AI Store and graph cache use their own in-memory implementations outside this package.

## Config Package

`config/config.go` is the authoritative source of Kiali configuration. Key aspects:

### Loading

Config is loaded from a YAML file via `config.LoadConfig(path)` and validated by `config.Validate(conf)`. The global config singleton is accessed with `config.Get()` and updated with `config.Set(conf)`.

Sensitive credentials are loaded from `/kiali-override-secrets/` files that override ConfigMap values. Named constants in `config.go` map secret file names to their purpose (e.g. `SecretFileGrafanaToken`, `SecretFileTracingPassword`, `SecretFileChatAIProviderPrefix`).

### Auth Strategies

```go
const (
    AuthStrategyOpenshift = "openshift"
    AuthStrategyAnonymous = "anonymous"
    AuthStrategyToken     = "token"
    AuthStrategyOpenId    = "openid"
    AuthStrategyHeader    = "header"
)
```

### External Service Auth Types

```go
const (
    AuthTypeBasic  = "basic"
    AuthTypeBearer = "bearer"
    AuthTypeNone   = "none"
)
```

### Run Modes

`RunModeLocal` is set when `kiali run` is invoked. It forces `AuthStrategyAnonymous` and disables features that require in-cluster access.

### Notable Config Fields

- `conf.KubernetesConfig.ClusterName` — the home cluster name.
- `conf.Clustering.IgnoreHomeCluster` — exclude the home cluster from multi-cluster views.
- `conf.Deployment.AccessibleNamespaces` — when set, restricts cache and controller-runtime to these namespaces.
- `conf.ExternalServices.{Prometheus,Tracing,Grafana,Perses}.{Enabled,InternalURL,ExternalURL}` — per-service connectivity.
- `conf.ChatAI.Enabled` / `conf.ChatAI.Providers` — AI feature flag and provider list.
- `conf.Server.Observability.Tracing.{Enabled,CollectorURL,SamplingRate}` — Kiali's own OTel self-instrumentation.

## Kubernetes Types and Scheme

`kubernetes/scheme.go` builds the combined runtime `Scheme` used by controller-runtime and the offline client:

```go
addSchemeFuncs := []func(s *runtime.Scheme) error{
    clientgoscheme.AddToScheme,       // core Kubernetes types
    networkingv1.AddToScheme,         // Istio networking/v1
    networkingv1alpha3.AddToScheme,   // Istio networking/v1alpha3 (EnvoyFilter)
    extentionsv1alpha1.AddToScheme,   // Istio extensions/v1alpha1 (WasmPlugin)
    securityv1.AddToScheme,           // Istio security/v1 (AuthorizationPolicy, PeerAuth, RequestAuth)
    telemetryv1.AddToScheme,          // Istio telemetry/v1
    k8snetworkingv1.Install,          // Gateway API v1 (HTTPRoute, Gateway, GRPCRoute, TLSRoute)
    k8snetworkingv1beta1.Install,     // Gateway API v1beta1 (ReferenceGrant)
    k8snetworkingv1alpha2.Install,    // Gateway API v1alpha2 (TCPRoute - experimental)
    k8sinferencev1.Install,           // Gateway API Inference Extension v1 (InferencePool)
    osappsscheme.AddToScheme,         // OpenShift DeploymentConfig
    oauthscheme.AddToScheme,          // OpenShift OAuthClient
    projectscheme.AddToScheme,        // OpenShift Project
    routescheme.AddToScheme,          // OpenShift Route
    userscheme.AddToScheme,           // OpenShift User
    gatewayapischeme.AddToScheme,     // Gateway API client scheme
}
```

The Istio CRD types covered by the scheme include: `VirtualService`, `DestinationRule`, `Gateway`, `ServiceEntry`, `Sidecar`, `WorkloadEntry`, `WorkloadGroup`, `EnvoyFilter`, `WasmPlugin`, `AuthorizationPolicy`, `PeerAuthentication`, `RequestAuthentication`, `Telemetry`.

## Filters and Host Matching

`kubernetes/filters.go` provides utility functions used throughout the business layer to correlate Istio resources with Kubernetes objects:

- `FilterByHost(host, hostNamespace, serviceName, svcNamespace, identityDomain)` — returns true if an Istio host reference (simple name, `name.namespace`, `name.namespace.svc`, or FQDN) matches a given service.
- `FilterAuthorizationPoliciesBySelector` — matches `AuthorizationPolicy` resources against a workload's label set.
- `FilterDestinationRulesByHostname` — selects `DestinationRule` objects relevant to a hostname.
- Additional filter functions for VirtualService, Gateway, and other resource types.

## Fake / Test Clients

`kubernetes/kubetest/` contains the testing infrastructure:

| File | Purpose |
|---|---|
| `fake.go` | `NewFakeK8sClient(objects ...runtime.Object)` — builds a `K8SClient` backed by `k8s/client-go/fake` and fake Istio/OpenShift/GatewayAPI clientsets. Used by offline mode and unit tests. |
| `mock.go` | `K8SClientMock` — a `testify/mock`-based mock of `ClientInterface`. |
| `mock_kubernetes.go` | Mock helpers for core Kubernetes operations. |
| `mock_istio.go` | Mock helpers for Istio operations. |
| `mock_openshift.go` | Mock helpers for OpenShift operations. |

`kubernetes/testing.go` exposes package-level helpers:

- `SetConfig(t, newConfig)` — sets the global config for a test and restores it on cleanup.
- `NewTestingClientFactory(t, conf)` — builds a real `clientFactory` pointing at a fake `rest.Config`; suitable only for internal factory tests.
- `ReadFile(t, path)` — convenience file reader.

Unit tests outside the `kubernetes` package typically inject a `*kubetest.K8SClientMock` or a fake client returned by `kubetest.NewFakeK8sClient` via the `ClientFactory` interface, avoiding any live cluster dependency.
