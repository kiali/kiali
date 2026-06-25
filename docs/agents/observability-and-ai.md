---
scribe:
  title: "Observability Integrations and AI"
  description: "Distributed tracing (Jaeger/Tempo/OTel), Grafana, Perses, Kiali self-instrumentation, and the AI Chat integration"
  watch_paths: [tracing/, grafana/, perses/, observability/, ai/]
  scan: "f9d619df93bb21a45a15076ec025938f8e79f856"
  freshness: 92
  human_input: 0
  completeness: 90
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "tracing-backends", heading: "Tracing: Supported Backends"}
    - {id: "tracing-client", heading: "Tracing Client Interfaces and Factory"}
    - {id: "jaeger", heading: "Jaeger Integration"}
    - {id: "tempo", heading: "Tempo Integration"}
    - {id: "grafana", heading: "Grafana Integration"}
    - {id: "perses", heading: "Perses Integration"}
    - {id: "observability-package", heading: "Observability Package: Kiali Self-Instrumentation"}
    - {id: "ai-overview", heading: "AI Chat Integration Overview"}
    - {id: "ai-providers", heading: "AI Providers"}
    - {id: "mcp-tools", heading: "MCP Tool System"}
    - {id: "ai-store", heading: "AI Conversation Store"}
  stale_flags: []
  review_notes:
    - finding: "Claim ai-providers:5: StopReasonPauseTurn block is at lines 76-83 (not 72-76), and at the final iteration the code returns an error rather than continuing — this edge case is not documented."
      severity: minor
      tag: WRONG_CLAIM
      confidence: 0.9
      date: "2026-05-14"
    - finding: "purgeInactiveSessions evicts based on session-level LastAccessed (AIChatConversation.LastAccessed), not per-conversation timestamps — all conversations in a stale session are purged together. This granularity detail is absent from the ai-store section."
      severity: minor
      tag: MISSING_SECTION
      confidence: 0.95
      date: "2026-05-14"
    - finding: "Several claim line numbers are off by 1-3 lines (ai-providers:4 cites line 52, actual is 53; ai-store:2 cites 346-375, actual function is 349-378)."
      severity: minor
      tag: STALE_REFERENCE
      confidence: 0.85
      date: "2026-05-14"
---

# Observability Integrations and AI

> TL;DR: Kiali proxies distributed traces from Jaeger or Tempo (via HTTP or gRPC), generates deep-links to Grafana and Perses dashboards, exports its own spans via OTel, and provides an AI Chat feature backed by OpenAI-compatible, Anthropic (Claude), or Google Gemini providers that call a set of MCP tools to query live mesh data.

## Overview

Kiali integrates with four categories of external observability tools:

1. **Distributed tracing backends** (Jaeger, Tempo) — proxied through a `ClientInterface` so the rest of the codebase is backend-agnostic.
2. **Dashboard/visualization tools** (Grafana, Perses) — URL discovery and deep-link generation for embedding into Kiali detail pages.
3. **Kiali self-instrumentation** (`observability/`) — the server emits its own OTel spans and Prometheus metrics.
4. **AI Chat** (`ai/`) — an LLM-backed chat interface that can query live mesh state via MCP tools.

## Tracing: Supported Backends

The `config.ExternalServices.Tracing.Provider` field controls which backend is active. Two values are recognized:

- `"jaeger"` (default) — Jaeger-compatible endpoints (Jaeger itself or any compatible API).
- `"tempo"` (`config.TempoProvider`) — Grafana Tempo via its HTTP search and gRPC stream APIs.

Both backends are accessed through the unified `tracing.ClientInterface`. The backend-specific transport is selected at client construction time in `tracing/client.go:newClient`.

Configuration fields relevant to tracing:

| Field | Purpose |
|---|---|
| `ExternalServices.Tracing.Enabled` | Feature flag |
| `ExternalServices.Tracing.InternalURL` | In-cluster URL (preferred); used for actual API calls |
| `ExternalServices.Tracing.ExternalURL` | Public URL (shown to users in the UI for direct links) |
| `ExternalServices.Tracing.UseGRPC` | Use gRPC instead of HTTP for Jaeger; for Tempo uses gRPC stream for search only |
| `ExternalServices.Tracing.GrpcPort` | Tempo gRPC port (separate from HTTP port) |
| `ExternalServices.Tracing.Provider` | `"jaeger"` or `"tempo"` |
| `ExternalServices.Tracing.Auth` | Auth config (type, token, UseKialiToken) |
| `ExternalServices.Tracing.CustomHeaders` | Extra HTTP/gRPC metadata headers |
| `ExternalServices.Tracing.QueryScope` | Additional tags always added to trace queries |
| `ExternalServices.Tracing.TempoConfig.CacheEnabled` | Enable trace-detail caching (Tempo only) |
| `ExternalServices.Tracing.TempoConfig.CacheCapacity` | FIFO cache capacity |

## Tracing Client Interfaces and Factory

`tracing/client.go` defines three interfaces:

```go
// Unified top-level interface used by business layer
type ClientInterface interface {
    GetAppTraces(ctx, ns, app string, query TracingQuery) (*TracingResponse, error)
    GetTraceDetail(ctx, traceId string) (*TracingSingleTrace, error)
    GetErrorTraces(ctx, ns, app string, duration) (int, error)
    GetServiceStatus(ctx) (bool, error)
    GetServices(ctx) ([]string, error)
}

// HTTP transport (Jaeger HTTP or Tempo HTTP)
type HTTPClientInterface interface {
    GetAppTracesHTTP(ctx, client, baseURL, serviceName, query) (*TracingResponse, error)
    GetTraceDetailHTTP(ctx, client, baseURL, traceID) (*TracingSingleTrace, error)
    GetServiceStatusHTTP(ctx, client, baseURL) (bool, error)
    GetServices(ctx, client, baseURL) ([]string, error)
}

// gRPC transport (Jaeger gRPC or Tempo gRPC stream)
type GRPCClientInterface interface {
    FindTraces(ctx, app, query) (*TracingResponse, error)
    GetTrace(ctx, traceID) (*TracingSingleTrace, error)
    GetServices(ctx) (bool, error)
    GetServicesList(ctx) ([]string, error)
}
```

The concrete `Client` struct holds both an `httpTracingClient HTTPClientInterface` and a `grpcClient GRPCClientInterface`. Each `Get*` method dispatches to the gRPC client when `grpcClient != nil`, falling back to HTTP otherwise. Exception: Tempo always uses HTTP for `GetTraceDetail`, regardless of gRPC being configured.

`NewClient(ctx, conf, token, retry bool)` constructs the client. If `retry = true` (production path), it calls `wait.PollUntilContextCancel` with a 30-second retry interval — the tracing backend is considered non-essential, and startup should not block waiting for it. In `cmd/server.go`, the tracing client is initialized in a goroutine and exposed via a loader closure:

```go
var tracingClient tracing.ClientInterface
tracingLoader := func() tracing.ClientInterface { return tracingClient }
go func() {
    client, err := tracing.NewClient(ctx, conf, kialiToken, true)
    tracingClient = client
}()
```

Handlers receive `traceClientLoader func() tracing.ClientInterface` and call it lazily.

Custom headers are propagated to downstream tracing API calls via gRPC metadata (`metadata.NewOutgoingContext`) using `prepareContextForClient`.

`tracing/discovery_client.go` provides `DiagnoseTracingConfig` — used by the `/api/tracing/diagnose` endpoint — which validates the configuration, probes connectivity, and returns a structured `TracingDiagnose` with a log of test steps.

## Jaeger Integration

`tracing/jaeger/` contains:

- `http_client.go` — `JaegerHTTPClient` implementing `HTTPClientInterface`. Queries `/api/traces` and `/api/traces/{traceID}` using the Jaeger v1 HTTP API.
- `grpc_client.go` — `JaegerGRPCClient` implementing `GRPCClientInterface`. Uses the Jaeger `query.proto` gRPC service (`FindTraces`, `GetTrace`).
- `model/` — protobuf-generated types plus JSON model types for Jaeger's HTTP response format.
- `logging.go` — logger helpers.

`NewGRPCJaegerClient` wraps a `model.QueryServiceClient` (generated from Jaeger's `query.proto`).

The Jaeger HTTP client uses the shared OTel HTTP helper `otel.MakeRequest` for HTTP calls, which handles context propagation.

## Tempo Integration

`tracing/tempo/` contains:

- `http_client.go` — `OtelHTTPClient` implementing `HTTPClientInterface`. Queries Tempo's `/api/search` endpoint using TraceQL (built by `traceQLBuilder.go`). Optionally caches single-trace responses in a `store.Store[string, *TracingSingleTrace]` with a 5-minute TTL (`store.NewExpirationStore` + `store.NewFIFOStore`).
- `grpc_client.go` — `TempoGRPCClient` implementing `GRPCClientInterface`. Uses Tempo's protobuf streaming API (`tempopb`).
- `util.go` — `ConstructTempoTenantURL` adjusts the base URL when a multi-tenant Tempo setup is configured.
- `model/` — Tempo-specific response models (OTel format).

For Tempo, `newClient` selects:
- HTTP only: `UseGRPC=false` — creates `OtelHTTPClient`.
- gRPC + HTTP: `UseGRPC=true` — creates both an `OtelHTTPClient` (for `GetTraceDetail`) and a gRPC stream client (for `FindTraces`).

The Tempo HTTP client re-uses Jaeger's JSON trace model via converter functions in `tracing/otel/model/converter/`.

## Grafana Integration

`grafana/grafana.go` provides `Service`, a thin wrapper around Grafana's REST API used to:

1. **Discover the Grafana URL** — if `ExternalServices.Grafana.InternalURL` is set, `ParseUrl` parses the hostname and calls `discoverServiceURL` to look up an OpenShift Route in the target namespace. The discovered URL is cached in `routeURL *string` under a `sync.RWMutex`.
2. **Generate dashboard deep-links** — `Info(ctx, dashboardSupplier)` iterates `conf.ExternalServices.Grafana.Dashboards`, calls Grafana's `/api/search?query=<dashboardName>` API, and constructs full URLs by joining the external base URL with the returned dashboard path.
3. **Return connection info** for the business layer — `Links(ctx, linksSpec)` processes per-resource dashboard link specifications from monitoring dashboard definitions.

Dashboard links support query-string parameters (e.g. `orgId=1`) appended from the configured external URL.

`VersionURL(ctx)` returns the Grafana `/api/frontend/settings` URL used to probe Grafana's version at health-check time.

The `DashboardSupplierFunc` type (`func(string, string, *config.Auth) ([]byte, int, error)`) is a seam for testing — `DashboardSupplier` is a package-level variable defaulting to `findDashboard` and can be overridden in tests.

Grafana auth credentials are loaded from the override-secrets directory (`SecretFileGrafanaUsername`, `SecretFileGrafanaToken`, etc.).

## Perses Integration

`perses/perses.go` provides `Service`, structurally parallel to the Grafana service. It:

1. **Discovers the Perses URL** — same OpenShift Route discovery pattern as Grafana, cached under a `sync.RWMutex`.
2. **Authenticates with Perses** — performs a login POST (`/api/auth/providers/native`) using configured credentials and caches the `AccessToken` / `RefreshToken` in `sessionData`.
3. **Generates dashboard deep-links** — fetches dashboard metadata from Perses REST API and constructs deep-links for embedding in Kiali detail pages.

Perses is configured under `conf.ExternalServices.Perses`. It is disabled by default and must be explicitly enabled and configured. The `/api/perses` endpoint returns `204 No Content` when Perses is disabled.

## Observability Package: Kiali Self-Instrumentation

`observability/tracing.go` configures Kiali's **own** OTel tracing — distinct from the external Jaeger/Tempo backends used for mesh traces:

```go
const TracingService = "kiali"

func InitTracer(collectorURL string) *sdktrace.TracerProvider
```

`InitTracer` creates an OTel `TracerProvider` that exports spans to an OTLP collector (HTTP or gRPC, inferred from the URL). It configures:
- `ParentBased(TraceIDRatioBased(conf.Server.Observability.Tracing.SamplingRate))` as the sampler.
- Resource attributes: `service.name`, `service.namespace`, `hostname` (set to `"kiali.<namespace>"`), `instance_name`.

The tracer is enabled when `conf.Server.Observability.Tracing.Enabled = true`. The server middleware (`otelmux.Middleware`) automatically creates spans for every HTTP request.

The `observability` package also exports the constant `TracingClusterTag = "istio.cluster_id"` used when annotating spans with the mesh cluster.

`server/metrics_server.go` runs a **separate HTTP server** (on `conf.Server.Observability.Metrics.Port`) exposing `promhttp.Handler()` for Prometheus scraping of Kiali's own internal metrics (`prometheus/internalmetrics/`). This server uses the same TLS policy as the main server.

## AI Chat Integration Overview

The `ai/` package implements an LLM-backed chat feature exposed at:
- `POST /api/chat/{provider}/{model}/ai` — send a user query; get an AI response.
- `POST /api/chat/mcp/{tool_name}` — call a single MCP tool directly (used by Kiali's own UI).
- `GET /api/chat/conversations` — list conversation IDs for the current session.
- `DELETE /api/chat/conversations?conversationIDs=<id1,id2,...>` — delete specific conversations. Returns HTTP 400 if the `conversationIDs` query parameter is absent.

The feature is gated by `conf.ChatAI.Enabled`. Providers and models are configured under `conf.ChatAI.Providers`.

## AI Providers

`ai/provider.go:NewAIProvider(conf, providerName, modelName)` constructs the right backend:

```go
switch provider.Type {
case config.OpenAIProvider:
    return openaiProvider.NewOpenAIProvider(conf, provider, model)
case config.AnthropicProvider:
    return anthropicProvider.NewAnthropicProvider(conf, provider, model)
case config.GoogleProvider:
    return googleProvider.NewGoogleAIProvider(conf, provider, model)
}
```

Three provider types are implemented:

### OpenAI Provider (`ai/providers/openai/`)

`openai_provider.go` uses the `github.com/openai/openai-go/v3` SDK. `NewOpenAIProvider` calls `getProviderOptions` which resolves the API key (from config secrets) and constructs `option.RequestOption` values for the SDK client. Three backend configs are supported via `provider.Config`:

| `provider.Config` | Behaviour |
|---|---|
| `"gemini"` | Routes to Google's OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai`) |
| `""` (default) | Standard OpenAI endpoint |
| `"azure"` | Azure OpenAI endpoint with `azureAPIVersion = "2024-06-01"` and `azure.NewTokenCredential` |

### Anthropic Provider (`ai/providers/anthropic/`)

`anthropic_provider.go` uses the `github.com/anthropics/anthropic-sdk-go` SDK. `NewAnthropicProvider` resolves the API key via `providers.ResolveProviderKey` and constructs an `anthropic.Client` with `option.WithAPIKey`. An optional `model.Endpoint` overrides the base URL (for custom Anthropic-compatible endpoints).

Only `provider.Config = ""` (default) is supported; other config type values return an error.

The provider uses an internal `anthropicConversation` struct that separates system messages (`[]anthropic.TextBlockParam`) from dialogue messages (`[]anthropic.MessageParam`), reflecting Anthropic's API shape where system prompts are passed as a top-level parameter rather than inline with the conversation.

`SendChat` iterates up to **5 tool-call rounds** (`maxToolIterations = 5`). Within each round:
1. Calls `p.client.Messages.New(ctx, ...)` with the current conversation and tool definitions.
2. If `resp.StopReason == StopReasonPauseTurn`, appends the response and continues without executing tools.
3. If tool-use blocks are present (`anthropicHasToolUse`), extracts them via `TransformToolCallToToolsProcessor`, executes them in parallel, and appends `ToolResult` blocks in a new user message.
4. If no tool use is present, extracts the text answer and exits the loop.

`TransformToolCallToToolsProcessor` returns `([]mcp.ToolsProcessor, []string, error)`, propagating JSON unmarshalling failures from tool argument payloads.

Tool schemas are normalized for Anthropic API compatibility by `normalizeAnthropicInputSchema`:
- `allOf` entries are merged into the top-level schema via `mergeTopLevelAllOf`.
- `anyOf` / `oneOf` combinators are stripped and their semantics approximated as human-readable constraint notes appended to the tool description and individual property descriptions.
- Object schemas without `additionalProperties` have it defaulted to `false`.

`ReduceConversation` uses the shared `providers.SplitConversationForReduction` helper (see below) and summarizes the middle portion via a dedicated `p.client.Messages.New` call with `reduceConversationMaxTokens = 1024`.

Token limits: `defaultMaxTokens = 4096` for chat, `reduceConversationMaxTokens = 1024` for summarization.

The provider implements `providers.AIProvider` (defined in `ai/providers/provider.go`):

```go
type AIProvider interface {
    InitializeConversation(conversation *[]ConversationMessage, req AIRequest)
    ReduceConversation(ctx, conversation, reduceThreshold) []ConversationMessage
    GetToolDefinitions() interface{}
    TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string, error)
    ConversationToProvider(conversation []ConversationMessage) interface{}
    ProviderToConversation(providerMessage interface{}) ConversationMessage
    SendChat(kialiInterface *mcputil.KialiInterface, req AIRequest, aiStore AIStore) (*AIResponse, int)
}
```

All three provider implementations (OpenAI, Anthropic, Google) propagate errors from `TransformToolCallToToolsProcessor`.

### Google Provider (`ai/providers/google/`)

`google_provider.go` uses the Google Generative AI Go SDK. The `GoogleAIProvider` implements the same `AIProvider` interface.

### Shared helpers (`ai/providers/helpers.go`)

`SplitConversationForReduction(conversation, reduceThreshold, keepCount)` splits a conversation into a system-instruction anchor, the summarizable middle portion, and the recent tail. Returns `(instructions, toSummarize, recentMessages, ok bool)` where `ok = false` if the conversation is below the threshold or too short to split meaningfully. The anchor is determined by counting leading messages whose `Role == "system"` (up to the first 2).

### Key credential resolution

`providers.ResolveProviderKey(conf, provider, model)` resolves API keys at runtime from the config's secret files. Provider-level keys take precedence over model-level keys. Secret file names follow the pattern `chat-ai-provider-<sanitized-name>` and `chat-ai-model-<sanitized-provider>-<sanitized-model>`.

## MCP Tool System

The `ai/mcp/` package defines a declarative tool system. Tool definitions live in YAML files under `ai/mcp/tools/` (embedded via `//go:embed tools`).

Each YAML file defines a `ToolDef`:

```go
type ToolDef struct {
    Name        string                 // tool name, e.g. "get_mesh_traffic_graph"
    Description string                 // human-readable description sent to the LLM
    InputSchema map[string]interface{} // JSON Schema for tool arguments
    Toolset     []string               // "default" | "mcp" | both
}
```

On first use, `LoadTools()` reads all YAML files and populates two maps:
- `MCPToolHandlers` — tools in the `"mcp"` toolset, used when Kiali acts as an MCP server.
- `DefaultToolHandlers` — tools in the `"default"` toolset, used for the built-in chat UI.

The tools implemented (each with its own subdirectory containing the handler `go` file):

| Tool name | Purpose |
|---|---|
| `get_mesh_traffic_graph` | Returns the traffic graph for given namespaces |
| `get_metrics` | Returns Prometheus metrics for a workload/service/app |
| `get_pod_performance` | Returns CPU/memory usage metrics |
| `get_logs` | Fetches pod logs |
| `get_mesh_status` | Returns overall mesh health and component status |
| `get_trace_details` | Fetches a specific trace by ID |
| `list_traces` | Lists traces for an app/service |
| `list_or_get_resources` | Lists or gets Kubernetes/Istio resources |
| `manage_istio_config` | Creates/updates/deletes Istio config objects |
| `manage_istio_config_read` | Read-only Istio config operations |
| `get_referenced_docs` | Returns relevant Kiali documentation (UI-only) |
| `get_action_ui` | Returns UI action suggestions (UI-only) |

Two special exclusions are maintained in `ExcludedToolNames` — `get_referenced_docs` and `get_action_ui` are excluded from the MCP server tool listing since they are UI-specific.

Tools that require Prometheus are tracked in `MetricToolNames`; tools that require a tracing backend in `TraceToolNames`. The handler logic checks `config.Get().ExternalServices.Prometheus.Enabled` / `Tracing.Enabled` before executing these tools and returns a helpful error message when the dependency is disabled.

`HeaderKialiUI = "Kiali-UI"` is an HTTP header the Kiali browser sends on `POST /api/chat/mcp/{tool}` to signal it is the internal UI client. When present, `ChatMCP` uses `DefaultToolHandlers` instead of `MCPToolHandlers`.

## AI Conversation Store

`ai/store.go` implements `types.AIStore`:

```go
type AIStore interface {
    Enabled() bool
    ReduceWithAI() bool
    ReduceThreshold() int
    GetConversation(sessionID, conversationID string) (*Conversation, bool)
    SetConversation(sessionID, conversationID string, conversation *Conversation) error
    GetConversationIDs(sessionID string) []string
    DeleteConversations(sessionID string, conversationIDs []string) error
}
```

The concrete `AIStoreImpl` stores conversations in a `map[sessionID]*AIChatConversation` where each value holds a `map[conversationID]*Conversation`. Thread-safety is maintained at two levels: a top-level `sync.RWMutex` on the store, and per-session and per-conversation mutexes.

**Memory management**: `SetConversation` calls `EstimateConversationMemory` (character count / 1024 / 1024 → MB) before storing. If the projected total memory would exceed `MaxCacheMemoryMB` (default 1024 MB), `evictLRUConversations` evicts the least-recently-accessed conversations until enough space is freed. A single conversation that alone exceeds `MaxCacheMemoryMB` is rejected immediately with an error rather than triggering eviction. After eviction, if the post-eviction projected memory still exceeds the cap, `SetConversation` returns an error. `internalmetrics.GetAIStoreEvictionsTotalMetric().Inc()` is called for each evicted conversation. When the last conversation in a session is evicted, the session entry itself is deleted.

**Inactivity-based cleanup**: `NewAIStore` launches a background goroutine (`startInactivityCleanupLoop`) when `Enabled = true` and `InactivityTimeout > 0`. The goroutine ticks at half the timeout duration (clamped between 50 ms and 1 minute) and calls `purgeInactiveSessions(now)`. Any session whose `LastAccessed` is older than `InactivityTimeout` is deleted wholesale. `GetConversationIDs` and `DeleteConversations` both update `AIChatConversation.LastAccessed` (previously only `SetConversation` / `GetConversation` updated it). Empty sessions (zero conversations) are also removed immediately after `DeleteConversations` empties them.

**Configuration** (loaded by `LoadAIStoreConfig`):

| Field | Default | Purpose |
|---|---|---|
| `InactivityTimeout` | 30m | Purge sessions not accessed within this duration |
| `MaxCacheMemoryMB` | 1024 | Memory cap across all sessions |
| `ReduceWithAI` | false | Use the AI to summarize long conversations before they hit the threshold |
| `ReduceThreshold` | 15 | Message count threshold that triggers AI-based reduction |

`InactivityTimeout` is loaded from `cfg.ChatAI.StoreConfig.InactivityTimeout` (parsed as a duration string). Invalid or zero values fall back to 30 minutes with a warning log.

A `Conversation` contains:
```go
type Conversation struct {
    Conversation []ConversationMessage
    LastAccessed time.Time
    EstimatedMB  float64
    Mu           sync.RWMutex
}
```

Each `ConversationMessage` has `Role`, `Content`, `Name`, and `Param` fields — the role/content model is provider-agnostic; providers convert to/from their SDK-specific message types via `ConversationToProvider` / `ProviderToConversation`.

**System prompt security**: The system prompt (`ai/types/prompt.go`) includes a `TOOL OUTPUT HANDLING` section that instructs the LLM to treat data returned by tools as raw, untrusted data — never as instructions — preventing prompt injection attacks via tool results that might contain directive text from the cluster.

The AI store is initialized in `routing/router.go` via `ai.NewAIStore(ctx, aiStoreConfig)` and passed to the AI handler functions as `aiStore types.AIStore`.
