---
scribe:
  title: "Backend Architecture"
  description: "Server startup, HTTP routing, handlers, and middleware pipeline for the Kiali Go backend"
  watch_paths: [cmd/, server/, handlers/, routing/, kiali.go, doc.go]
  scan: "HEAD"
  freshness: 60
  human_input: 0
  completeness: 88
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "entry-point", heading: "Entry Point and Cobra Command Setup"}
    - {id: "startup-sequence", heading: "Startup Sequence"}
    - {id: "server-struct", heading: "Server Struct and HTTP Listener"}
    - {id: "routing", heading: "HTTP Routing"}
    - {id: "middleware", heading: "Middleware Pipeline"}
    - {id: "handler-pattern", heading: "Handler Pattern"}
    - {id: "api-versioning", heading: "API Versioning and Base Path"}
    - {id: "handler-groupings", heading: "Key Handler Groupings"}
    - {id: "auth-strategies", heading: "Authentication Strategies"}
  stale_flags: []
---

# Backend Architecture

> TL;DR: Kiali is a Go binary whose `main()` calls `cmd.Execute()`, which starts a Cobra CLI that builds a Kubernetes client factory, initializes caches and controllers, then creates a gorilla/mux HTTP server with per-route authentication wrapping and a gzip/CORS/OTel middleware stack.

## Overview

The Kiali backend is a single Go binary. It serves two concerns from the same listener:

1. A JSON REST API under `/api/` (all routes authenticated by default).
2. A React SPA embedded into the binary via `//go:embed`, served for all other paths.

The build tag `!exclude_frontend` (the default) is required for the binary to compile — `kiali.go` (which contains `main()`) is guarded by this tag. Setting `exclude_frontend` removes `main()` from the build, so the binary cannot be built without it. The tag is used in `make test` to exclude frontend-related test files from unit test runs, not to build an API-only server binary.

## Entry Point and Cobra Command Setup

`kiali.go` contains `main()`:

```go
func main() {
    cmd.Execute()
}
```

`cmd/root.go` builds the root `cobra.Command` with `newRootCmd()`. The root command:

- Accepts `--config / -c` (path to YAML config file) and `--log-level / -l` flags.
- In `PersistentPreRunE`: initializes the logger, loads config from file if specified, sets `util.Clock`.
- In `RunE` (the default action when no subcommand is given):
  - Calls `maxprocs.Set()` to auto-tune `GOMAXPROCS` to the cgroup CPU quota.
  - Calls `memlimit.SetGoMemLimitWithOpts` to auto-tune `GOMEMLIMIT` from the cgroup memory limit (prevents OOM kills).
  - Validates config with `config.Validate(conf)`.
  - Resolves the home cluster name via `istioconfig.DetermineHomeClusterName`.
  - Calls `kubernetes.NewClientFactory(ctx, conf, restConf)` to build the client factory.
  - Calls `RunServer(ctx, conf, clientFactory)` and waits for termination.

The `-config` / `--config` flag quirk: the Kiali helm chart historically passed `-config` (single dash), so `Execute()` rewrites `-config` to `--config` before handing off to Cobra.

Two root-level subcommands are registered alongside the default `RunE`:
- `run` (`cmd/run.go`): runs Kiali in **local mode** using a kubeconfig file, supports port-forwarding to Prometheus, Tempo/Jaeger, and Grafana.
- `gather` (`cmd/gather.go`): runs Kiali in gather mode, wrapping the Prometheus client with a `QueryRecorder` that logs all graph queries to a file (`prom-graph-gather.log`) for offline test replay.

`run` itself registers one sub-subcommand:
- `run offline` (`cmd/offline.go`): runs against a directory of static YAML files (invoked as `kiali run offline`).

## Startup Sequence

`cmd/server.go:RunServer` → `run()` orchestrates the full startup:

1. Resolve TLS policy (`tlspolicy.Resolve`).
2. Build the controller-runtime manager (`newManager`) — creates per-cluster informer caches for the home cluster (via `ctrl.NewManager`) and for each remote cluster (via `cluster.New`). Cache transforms strip managed-fields and prune Pod/Service objects to fields Kiali actually uses.
3. Create `cache.KialiCache` from the SA clients and the controller-runtime readers.
4. Set build info on the cache.
5. Create `istio.Discovery` and `business.ControlPlaneMonitor`.
6. Set the Kiali SA token credential (watches the projected token file for rotations).
7. Initialize the Prometheus client — probes the `/‑/healthy` endpoint; on failure injects a `NoopClient` and records a `DisabledReason`.
8. Initialize the tracing client **asynchronously** in a goroutine; a loader closure is passed downstream so handlers can start the server before the tracing backend is reachable.
9. Initialize the Grafana service.
10. Create `business.Layer` (the primary business-logic entry point).
11. Create the validations controller if the reconcile interval is > 0 (`controller.NewValidationsController`), then start it in a background goroutine (`mgr.Start`).
12. Wait for all per-cluster caches to sync (`cache.WaitForCacheSync`).
13. Poll istiod for proxy status (or prime cluster cache if Istio API is disabled).
14. Start the health monitor (`business.HealthMonitor`) if enabled — runs after cache sync so the cluster list is populated.
15. Start the `server.Server` — `server.Start()` spawns the HTTP listener goroutine.

Shutdown is triggered by context cancellation (SIGINT/SIGTERM via `WaitForTermination`). The server, metrics server, and controller are stopped in reverse order.

## Server Struct and HTTP Listener

`server/server.go` defines:

```go
type Server struct {
    conf       *config.Config
    httpServer *http.Server
    router     *mux.Router
    tracer     *sdktrace.TracerProvider
}
```

`NewServer` constructs the server:

1. Creates a `grafana.Service` and `perses.Service`.
2. Calls `routing.NewRouter(...)` to build the fully-wired gorilla/mux router.
3. Optionally initialises an OTel `TracerProvider` if `conf.Server.Observability.Tracing.Enabled`.
4. Applies middleware: `securityHeaders` is always applied; `corsAllowed` if `conf.Server.CORSAllowAll`; `otelmux.Middleware` if tracing enabled.
5. Wraps the router in a gzip handler (content-types: `application/json`, `application/javascript`, `text/html`, `text/css`, `image/svg+xml`) if `conf.Server.GzipEnabled`.
6. Constructs `http.Server` bound to `conf.Server.Address:conf.Server.Port` with a 30 s read timeout and configurable write timeout (defaults to 30 s; raised to 60 s automatically when the profiler is enabled).
7. TLS configuration is applied from the resolved TLS policy (`conf.ResolvedTLSPolicy`), supporting `h2` and `http/1.1`.

`Server.Start()` spawns a goroutine. If `conf.IsServerHTTPS()`, it calls `ListenAndServeTLS`; otherwise `ListenAndServe`. It also conditionally starts the metrics server (`server/metrics_server.go`) on a separate port exposing Prometheus `/metrics` via `promhttp.Handler()`.

Security headers set on every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## HTTP Routing

`routing/router.go:NewRouter` constructs the gorilla/mux router:

1. Creates a `rootRouter` and, if `Server.WebRoot != "/"`, a sub-router (`appRouter`) scoped to that prefix.
2. A static file server (`http.FileServerFS`) serves the embedded React build from `appRouter`.
3. `serveIndexFile` rewrites the `<base href>` in `index.html` to match the configured web root; `serveEnvJsFile` generates `env.js` with runtime config for the UI (e.g. `HISTORY_MODE`).
4. `/console` prefix routes are forwarded to `index.html` to support React Router client-side navigation.
5. `NewRoutes(...)` builds all API route definitions and returns them as `[]Route`.
6. Auth strategy routes (callbacks, redirects for OpenID/OpenShift) are appended.
7. pprof routes are appended if `conf.Server.Profiler.Enabled`.
8. For each `Route`, the handler is assembled inside-out: `metricHandler` wraps the raw `HandlerFunc`; `authenticationHandler.Handle` (or `HandleUnauthenticated`) wraps that; finally `buildHttpHandlerLogger` wraps everything as the outermost layer (zerolog per-route logger with `X-Request-Id` propagation).

`routing/routes.go` defines the `Route` struct and the complete list via `NewRoutes`. Every route specifies `Name`, `LogGroupName`, `Method`, `Pattern`, `HandlerFunc`, and `Authenticated bool`.

## Middleware Pipeline

For each incoming request the chain is (from outermost to innermost):

```
rootRouter
  └── gorilla/mux global middlewares (applied via router.Use):
        securityHeaders
        [corsAllowed]          -- if CORSAllowAll
        [otelmux.Middleware]   -- if Observability.Tracing.Enabled
      └── httpHandlerLogger    -- OUTERMOST per-route layer
            hlog.NewHandler      -- zerolog request logger
            X-Request-Id handler -- uses incoming header or generates a UUID
            requestHeaders ctx   -- stores X-Request-Id in context for upstream propagation
            └── authHandler      -- authenticates via the configured strategy
                └── metricHandler  -- Prometheus timer; increments APIFailureMetric on 5xx
                    └── actual handlerFunc
```

The `metricHandler` wraps `http.ResponseWriter` in a `statusResponseWriter` to capture the status code, then calls `internalmetrics.ObserveDurationAndLogResults` and increments `APIFailureMetric` on 500/503.

## Handler Pattern

Handlers in `handlers/` follow a consistent closure pattern. Each public function returns an `http.HandlerFunc`. Dependencies (config, cache, clientFactory, prometheus, tracing, grafana, discovery, etc.) are closed over at router construction time, not injected per-request via context.

Example from `handlers/graph.go`:

```go
func GraphNamespaces(
    conf *config.Config,
    kialiCache cache.KialiCache,
    clientFactory kubernetes.ClientFactory,
    prom prometheus.ClientInterface,
    cpm business.ControlPlaneMonitor,
    traceClientLoader func() tracing.ClientInterface,
    grafana *grafana.Service,
    discovery *istio.Discovery,
    graphCache graph.GraphCache,
    refreshJobManager *graph.RefreshJobManager,
) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        defer handlePanic(r.Context(), w)
        business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
        graph.CheckError(err)
        o := graph.NewOptions(r, business, conf)
        code, payload := graphNamespacesWithCache(r.Context(), business, prom, o, graphCache, refreshJobManager)
        respond(w, code, payload)
    }
}
```

The critical call is `getLayer(r, ...)` in `handlers/utils.go`. It:

1. Calls `getAuthInfo(r)` — retrieves the `map[string]*api.AuthInfo` from the request context (placed there by the auth middleware).
2. Calls `business.NewLayer(conf, kialiCache, clientFactory, prom, tracingClient, cpm, grafana, discovery, authInfos)` — creates a `business.Layer` scoped to the authenticated user's tokens. `authInfos` is `map[string]*api.AuthInfo` (one entry per cluster), not a single `authInfo`.

`handlers/base.go` provides the response helpers used by all handlers:
- `RespondWithJSON(w, code, payload)` — marshals to JSON and sets `Content-Type: application/json`.
- `RespondWithAPIResponse(w, code, payload)` — calls `ConvertToResponse()` first (nil-slice normalisation etc.).
- `RespondWithError(w, code, message)` and `RespondWithDetailedError`.

Request bodies are limited to 10 MB via `boundedReadAll` / `http.MaxBytesReader`.

## API Versioning and Base Path

All API routes are prefixed with `/api`. There is **no versioning path segment** — the API is explicitly documented as internal and subject to change without backward-compatibility guarantees (see `kiali.go` swagger metadata and `kiali_internal_api.md`).

The swagger metadata at the top of `kiali.go` records `BasePath: /api`.

When `Server.WebRoot` is configured (e.g. `/kiali`), the effective API base becomes `/kiali/api`. The router uses gorilla/mux's `PathPrefix` subrouter so all route patterns in `routes.go` are relative to the web root.

## Key Handler Groupings

Handler files in `handlers/` map to functional areas:

| File | Routes (examples) |
|---|---|
| `graph.go` | `GET /api/namespaces/graph`, `GET /api/namespaces/{ns}/workloads/{wl}/graph`, `GET /api/mesh/graph` |
| `apps.go` | `GET /api/clusters/apps`, `GET /api/namespaces/{ns}/apps/{app}` |
| `workloads.go` | `GET /api/clusters/workloads`, `GET /api/namespaces/{namespace}/workloads/{workload}`, `PATCH` (update) |
| `services.go` | `GET /api/clusters/services`, `GET /api/namespaces/{ns}/services/{svc}`, `PATCH` (update) |
| `istio_config.go` | `GET/POST/PATCH/DELETE /api/namespaces/{ns}/istio/{group}/{version}/{kind}/{object}` |
| `metrics.go` | `GET /api/namespaces/{ns}/services/{svc}/metrics`, workload/app/namespace/control-plane metrics |
| `dashboards.go` | `GET /api/namespaces/{ns}/services/{svc}/dashboard`, app/workload/ztunnel dashboards |
| `health.go` | `GET /api/clusters/health`, namespace/workload/app health |
| `tracing.go` | `GET /api/namespaces/{ns}/apps/{app}/traces`, `/spans`, `/errortraces`, `GET /api/traces/{traceID}` |
| `namespaces.go` | `GET /api/namespaces`, `PATCH /api/namespaces/{ns}`, namespace info |
| `mesh.go` | `GET /api/mesh/graph`, `GET /api/mesh/controlplanes`, `GET /api/mesh/tls` |
| `grafana.go` | `GET /api/grafana` |
| `perses.go` | `GET /api/perses` |
| `ai.go` | `POST /api/chat/{provider}/{model}/ai`, `POST /api/chat/mcp/{tool_name}`, conversations CRUD |
| `authentication.go` | `GET /api/authenticate`, `GET /api/logout`, `GET /api/auth/info` |
| `root.go` | `GET /api` (status), `GET /healthz`, `GET /api/config` |
| `istio_status.go` | `GET /api/istio/status` |

## Authentication Strategies

`handlers/authentication/` contains one `AuthController` implementation per supported strategy:

| Strategy name | Controller file |
|---|---|
| `token` | `token_auth_controller.go` |
| `openid` | `openid_auth_controller.go` |
| `openshift` | `openshift_auth_controller.go` (adds `/api/auth/redirect` and `/api/auth/callback` routes) |
| `header` | `header_auth_controller.go` |
| `anonymous` | No controller; used in `run` local mode |

`routing/router.go` instantiates the right controller based on `conf.Auth.Strategy`. The `authenticationHandler` (created from `handlers.NewAuthenticationHandler`) wraps each route's handler function. For authenticated routes it calls `AuthController.ValidateSession` and injects the resulting `map[string]*api.AuthInfo` into the request context. Handlers then extract it via `authentication.GetAuthInfoContext`.
