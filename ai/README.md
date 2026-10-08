# Kiali AI

This package provides the Kiali AI Assistant backend. It wires the chat provider, tool execution, and optional conversation storage so the UI can answer questions, navigate Kiali, and manage Istio resources. It also records usage metrics and estimates consumption cost when those features are enabled.

## Table of contents

- [High-level flow](#high-level-flow)
- [Configuration summary](#configuration-summary)
- [Configuring providers and models](#configuring-providers-and-models)
  - [Top-level `ai` keys](#top-level-ai-keys)
  - [Chat keys (`ai.chat`)](#chat-keys-aichat)
  - [Provider keys (`ai.chat.providers[]`)](#provider-keys-aichatproviders)
  - [Model keys (`ai.chat.providers[].models[]`)](#model-keys-aichatprovidersmodels)
  - [Store config keys (`ai.chat.store_config`)](#store-config-keys-aichatstore_config)
  - [API Key Configuration](#api-key-configuration)
- [Metrics and consumption](#metrics-and-consumption)
  - [Consumption keys (`ai.consumption`)](#consumption-keys-aiconsumption)
  - [Budget keys (`ai.consumption.budgets[]`)](#budget-keys-aiconsumptionbudgets)
  - [Custom pricing ConfigMap (`prizes_config_map`)](#custom-pricing-configmap-prizes_config_map)
- [Providers Supported](#providers-supported)
- [MCP tools (summary)](#mcp-tools-summary)
- [AI Store](#ai-store)
- [AI Consumption](#ai-consumption)

## High-level flow

1. The UI sends a chat request with a model name and context.
2. `ai.NewAIProvider` selects a model from `ai.chat` configuration.
3. The provider sends the conversation to the model and exposes MCP tools.
4. Tool results (actions, referenced_docs, data) are combined into the final response.
5. We recommend enabling the AI store to retain context; it can optionally reduce stored conversations with AI (see [AI Store](#ai-store)).
6. When `ai.metrics` is true, token usage is recorded. The consumption dashboard estimates cost from the built-in price catalog or from a user-managed ConfigMap named by `ai.consumption.prizes_config_map`.

## Configuration summary

AI is configured under `ai` in `config/config.go` (Kiali CR `spec.ai`, or Helm `ai:` in `kiali-server` values). Key fields:

- `enabled`: Master switch for the AI subsystem.
- `chat`: Chat assistant (providers, models, tools, store).
- `metrics`: Enable ChatAI usage metrics (required for the AI dashboard and consumption tracking).
- `consumption`: Dashboard access, per-user budgets, and optional pricing ConfigMap.

The deprecated top-level `chat_ai` setting is still accepted and migrated to `ai.chat`. Prefer `ai.chat`. Validation rules are enforced in `Config.ValidateAI()`. Disabled providers/models are ignored during validation, but defaults must exist and be enabled.

Example configuration:

```yaml
ai:
  enabled: true
  metrics: true
  chat:
    enabled: true
    default_provider: "openai"
    tools:
      disabled_tools:
        - "manage_istio_config"
    providers:
      - name: "openai"
        enabled: true
        description: "OpenAI API Provider"
        type: "openai"
        config: "default"
        default_model: "gemini"
        tools:
          enabled_tools:
            - "get_logs"
            - "get_mesh_status"
        models:
          - name: "gemini"
            enabled: true
            model: "gemini-2.5-pro"
            description: "Model provided by Google with OpenAI API Support"
            endpoint: "https://generativelanguage.googleapis.com/v1beta/openai"
            key: "secret:my-key-secret:openai-gemini"
  consumption:
    allowed_users_dashboard: []
    prizes_config_map: ""   # empty = built-in catalog (config/ai_default_prices.yaml)
    budgets: []
```

Notes:

* Model keys override provider keys if both are set.
* `endpoint` is required for the `azure` config and optional for others.
* Provider and model names are used in secret volume names; avoid special characters.
* Operator/Helm mount `secret:<name>:<key>` credentials automatically. `prizes_config_map` is a ConfigMap name in the Kiali namespace, not a Secret.

## Configuring providers and models

Reference for every configuration key under `ai`, with type, allowed values, and description.

### Top-level `ai` keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Master switch for the AI subsystem. Required for chat. |
| `chat` | object | (see below) | Chat assistant settings. Keys are described in [Chat keys](#chat-keys-aichat). |
| `metrics` | boolean | `false` | Enable ChatAI usage metrics. Required for the AI dashboard and consumption tracking. |
| `consumption` | object | (see below) | Consumption dashboard, budgets, and pricing ConfigMap. Keys are described in [Consumption keys](#consumption-keys-aiconsumption). |

### Chat keys (`ai.chat`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Turns the AI assistant on or off. When `true`, `default_provider` is required. |
| `default_provider` | string | `""` | Name of the provider to use when the UI does not specify one. Must match a provider `name` and that provider must be enabled. |
| `allowed_users` | array | `[]` | Users allowed to use ChatAI. Empty means all users. |
| `max_tool_iterations` | integer | `5` | Maximum LLM call + tool execution rounds per request. Must be between 1 and 20. |
| `tools` | object | `{}` | Optional global filter for the chat toolset. `enabled_tools` acts as an allowlist: when set, only the listed tool names remain available. `disabled_tools` acts as a denylist and is applied afterwards. Empty means "use the default Kiali selection". |
| `providers` | array | `[]` | List of provider definitions. Each entry has the keys described in [Provider keys](#provider-keys-aichatproviders). |
| `store_config` | object | (see below) | Optional conversation storage settings. Keys are described in [Store config keys](#store-config-keys-aichatstore_config). |

### Provider keys (`ai.chat.providers[]`)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | Unique identifier for the provider. Used in API requests and in secret volume names; avoid special characters. |
| `type` | string | yes* | Backend to use. Values: `openai`, `google`, `anthropic`, `lightspeed`. Empty defaults to `openai`. |
| `config` | string | yes* | Mode for this provider. For `type: openai`: `default`, `azure`, or `gemini`. For `type: google`: `default` or `gemini` (both use Gemini). For `type: anthropic`: `default`. Empty is defaulted per type. |
| `enabled` | boolean | no | Enable or disable this provider. Defaults to `true`. Disabled providers are ignored. |
| `default_model` | string | yes | Name of the default model for this provider. Must match a model `name` in `models` and that model must be enabled. Not used for `type: lightspeed`. |
| `description` | string | no | Human-readable description of the provider (e.g. for UI). |
| `endpoint` | string | conditional | Provider base URL. Required for `type: lightspeed` and `config: azure`. |
| `insecure_skip_verify` | boolean | no | Skip TLS certificate verification for this provider. Default `false`. |
| `tools` | object | no | Optional provider-specific `enabled_tools`/`disabled_tools` filter applied after the global `ai.chat.tools` filter. It can further restrict the tools exposed to this provider, but it cannot re-enable a tool already filtered out globally or by feature availability. |
| `key` | string | conditional | API key for all models in this provider. Inline value or `secret:<secret-name>:<key-in-secret>`. Required if no model has a `key`. Not used for `type: lightspeed`. |
| `models` | array | yes | List of models. Each entry has the keys described in [Model keys](#model-keys-aichatprovidersmodels). Not used for `type: lightspeed`. |

### Model keys (`ai.chat.providers[].models[]`)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | Alias used in requests (e.g. when the UI selects a model). Used in secret volume names; avoid special characters. |
| `model` | string | yes | Provider-specific model ID sent to the API (e.g. `gpt-4o-mini`, `gemini-2.5-pro`). |
| `enabled` | boolean | no | Enable or disable this model. Defaults to `true`. Disabled models are ignored. |
| `description` | string | no | Human-readable description of the model (e.g. for UI). |
| `endpoint` | string | conditional | Base URL for the API. Required for `config: azure`. Optional for `openai`/`gemini` (e.g. override for OpenAI or Gemini endpoint). Not used for `type: google`. |
| `key` | string | conditional | Per-model API key. Overrides the provider `key` when set. Inline value or `secret:<secret-name>:<key-in-secret>`. Required when the provider has no `key`. |

### Store config keys (`ai.chat.store_config`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable the AI store. When enabled, conversation context is kept across requests. |
| `inactivity_timeout` | string | `"30m"` | Idle time before a conversation is deleted due to inactivity. |
| `max_cache_memory_mb` | integer | `1024` | Maximum memory (MB) for all stored conversations. Oldest conversations are pruned when the limit is reached. |
| `reduce_with_ai` | boolean | `false` | If `true`, long conversations are summarized using the configured AI provider when reduced; if `false`, older messages are dropped. |
| `reduce_threshold` | integer | `15` | When a conversation reaches this number of messages, it is reduced (by summarization or truncation depending on `reduce_with_ai`). |

### API Key Configuration

Provider and model API keys can be configured in two ways:

1. **Inline key** (not recommended for production):
   ```yaml
   ai:
     chat:
       providers:
       - name: my-provider
         key: "sk-abc123..."
   ```

2. **Secret reference** (recommended):
   ```yaml
   ai:
     chat:
       providers:
       - name: my-provider
         key: "secret:my-secret-name:api-key"
   ```

The secret reference syntax is `secret:<secret-name>:<key-in-secret>`. When using secret references:
- The Kiali Operator and Helm charts automatically mount the referenced secrets
- No need to configure `deployment.custom_secrets` separately
- Secrets must exist in the Kiali deployment namespace
- Only secrets for enabled providers and models are mounted

So, we just need create the secret containing your API key:

```shell
kubectl -n istio-system create secret generic my-key-secret --from-literal=openai-gemini=<token>
```

Then configure `ai.chat` to reference the secret. The Kiali Operator and Helm charts automatically mount secrets referenced in `ai.chat` configuration.

## Metrics and consumption

`ai.metrics: true` records ChatAI token usage. That flag is required for the AI dashboard and for consumption tracking. For design and behavior details, see [AI Consumption KEP](../design/KEPS/ai-consumption/proposal.md).

### Consumption keys (`ai.consumption`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `allowed_users_dashboard` | array | `[]` | Users allowed to view the consumption dashboard. Empty means all users. |
| `budgets` | array | `[]` | Per-user budget limits. Empty means no budget restrictions. See [Budget keys](#budget-keys-aiconsumptionbudgets). |
| `prizes_config_map` | string | `""` | Name of a user-managed ConfigMap in the Kiali deployment namespace that holds a custom token pricing catalog. Empty uses the built-in catalog (`config/ai_default_prices.yaml`). |

### Budget keys (`ai.consumption.budgets[]`)

| Key | Type | Description |
|-----|------|-------------|
| `usernames` | array | Users this budget applies to. Use `*` as a catch-all. Required and must not be empty. |
| `interval` | string | Budget reset interval: `weekly` or `monthly`. |
| `max_cost` | number | Maximum estimated cost in the budget interval (pricing currency, typically USD). |
| `max_tokens` | number | Maximum tokens in the budget interval, in **millions** of tokens. |
| `allowed_providers` | array | Provider types this budget allows (`openai`, `anthropic`, `google`, `lightspeed`). Empty means all configured providers. |
| `allowed_models` | array | Model names or IDs this budget allows. Supports `*` wildcards. Empty means all models of the allowed providers. |

### Custom pricing ConfigMap (`prizes_config_map`)

When `prizes_config_map` is empty, Kiali loads the embedded catalog from `config/ai_default_prices.yaml`.

When it is set to a ConfigMap name, the operator (and the `kiali-server` Helm chart) mounts that ConfigMap at `/kiali-ai-pricing` (`optional: true`, `readOnly: true`). The ConfigMap must live in the Kiali deployment namespace and contain a `prices.yaml` key in the same format as the built-in catalog. That catalog **replaces** the built-in list. If the file is missing or invalid, Kiali logs an error and falls back to the built-in catalog. Restart the Kiali pod after changing ConfigMap contents.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kiali-ai-prices
  namespace: istio-system
data:
  prices.yaml: |
    models:
      - provider: openai
        model_id: gpt-4o
        currency: USD
        prices:
          input_cost_per_million: 2.50
          output_cost_per_million: 10.00
          cache_read_cost_per_million: 1.25
```

```yaml
ai:
  enabled: true
  metrics: true
  consumption:
    prizes_config_map: kiali-ai-prices
```

Operator install path: Kiali CR `spec.ai.consumption.prizes_config_map`. See `docs/agents/operator-architecture.md` in the kiali-operator repo.

## Providers Supported

| Provider | Configuration |
| --- | --- |
| OpenAI | default, azure, gemini |
| Google | gemini |
| Anthropic | default |
| LightSpeed | endpoint only (no API key or model list in Kiali) |

See [AI Providers](providers/README.md) and [LightSpeed](providers/lightspeed/README.md).

## MCP tools (summary)

The AI uses MCP tools to interact with Kiali and the mesh:

- `get_action_ui`: Builds UI navigation actions (graphs, lists, details).
- `get_referenced_docs`: Finds relevant Istio/Kiali documentation links.
- `get_logs`: Retrieves Pod/workload logs with severity filtering.
- `get_mesh_status`: Returns high-level mesh health, control plane, observability stack, and connectivity status.
- `get_mesh_traffic_graph`: Returns compact service-to-service traffic topology with metrics (throughput, response time, mTLS).
- `get_metrics`: Returns Istio/Envoy metrics for services, workloads, or apps.
- `get_pod_performance`: Returns current Pod CPU/memory usage vs requests/limits.
- `list_or_get_resources`: Lists or gets details for services, workloads, apps, and namespaces (compact/LLM-optimized output).
- `list_traces`: Lists distributed traces for a service. Use `get_trace_details` for a single trace hierarchy.
- `manage_istio_config_read`: List/get Istio config (read-only).
- `manage_istio_config`: Create/patch/delete Istio config with confirmation flow.

For detailed tool documentation, see `ai/mcp/README.md`.

## AI Store

The AI store keeps conversation context (enabled by default). When limits are reached, older conversations are pruned. For all `store_config` keys, values, and descriptions, see [Store config keys](#store-config-keys-aichatstore_config). For design and behavior details, see [AI STORE README](../design/KEPS/ai-store/proposal.md).

## AI Consumption

AI consumption records ChatAI token usage, estimates cost from a per-model price catalog, and optionally enforces per-user budgets. Usage is gated by `ai.metrics`. Cost, dashboard access, and budgets are configured under `ai.consumption`. Prices come from the built-in catalog unless `prizes_config_map` names a user-managed ConfigMap, which the operator/Helm chart mounts at `/kiali-ai-pricing`.

For all consumption keys, values, and descriptions, see [Metrics and consumption](#metrics-and-consumption). For design and behavior details, see [AI Consumption KEP](../design/KEPS/ai-consumption/proposal.md).
