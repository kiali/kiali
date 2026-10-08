# AI Consumption KEP

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#nongoals)
3. [Solution](#solution)
4. [Technical Challenges](#technical-challenges)
   1. [Usage vs cost](#usage-vs-cost)
   2. [Pricing catalog ownership](#pricing-catalog-ownership)
   3. [Per-user budgets](#per-user-budgets)
5. [Proposed Implementation](#proposed-implementation)
   1. [Architecture](#architecture)
   2. [Metrics](#metrics)
   3. [Cost estimation](#cost-estimation)
   4. [Built-in catalog and `prizes_config_map`](#built-in-catalog-and-prizes_config_map)
   5. [Operator and Helm mount](#operator-and-helm-mount)
   6. [Budgets](#budgets)
   7. [Dashboard access](#dashboard-access)
   8. [Configuration](#configuration)
6. [Future Considerations](#future-considerations)

# Summary

Add an AI consumption subsystem to Kiali that records ChatAI token usage, estimates monetary cost from a per-model price catalog, enforces optional per-user budgets, and exposes that data in the AI dashboard.

Usage recording is gated by `ai.metrics`. Cost estimates, budgets, and the consumption dashboard are configured under `ai.consumption`. Prices come from a built-in catalog (`config/ai_default_prices.yaml`) unless the administrator names a user-managed ConfigMap in `ai.consumption.prizes_config_map`; the operator/Helm chart then mounts that ConfigMap for the Kiali server to load.

# Motivation

Kiali ChatAI can generate substantial token usage across users, providers, and models. Platform and FinOps teams need to:

- See who is using which models and how many tokens
- Estimate cost without pushing every price into the Kiali CR
- Cap spend or tokens for specific users (or a `*` catch-all)
- Restrict which providers/models a user may call

Without a consumption subsystem:

- Token usage would only exist as raw Prometheus counters with no UI
- Cost would be unestimable unless operators scrape and join prices elsewhere
- There would be no in-product budget enforcement
- Custom/negotiated prices could not be supplied independently of the Kiali CR

## Goals

- Record ChatAI prompt/completion/total tokens per user, provider, and model
- Estimate cost from a versioned built-in catalog of USD-per-million-token prices
- Allow administrators to replace that catalog with a cluster ConfigMap
- Enforce optional weekly/monthly budgets (cost and/or tokens) and provider/model allowlists
- Restrict who can open the consumption dashboard
- Keep pricing data out of the main Kiali CR (the CR only names the ConfigMap)

## Non-goals

- Billing integration with cloud provider invoices
- Hot-reloading prices without a Kiali pod restart
- Merging a partial ConfigMap catalog on top of the built-in list (a configured catalog **replaces** the built-in one)
- Storing usage history inside Kiali (Prometheus is the source of truth for counters)
- Charging LightSpeed internally when the service does not expose billable model IDs the same way as other providers (cost is estimated only when a catalog entry matches provider + `model_id`)

# Solution

AI consumption is a **metrics-backed cost and budget layer** on top of ChatAI:

1. **`ai.metrics: true`** records token counters on each chat response
2. **`ai.consumption`** configures dashboard access, budgets, and an optional pricing ConfigMap
3. The server estimates cost by joining usage with a resolved `ModelPricings` catalog
4. Chat requests are rejected when the user's budget is exhausted or the provider/model is not allowed

The default catalog is embedded in the Kiali binary. Administrators who need custom prices create a ConfigMap and set `spec.ai.consumption.prizes_config_map` to its name. If that field is empty, the built-in catalog is used and no extra volume is mounted.

# Technical Challenges

## Usage vs cost

Token counts are objective (what the LLM returned). Cost is derived: it depends on provider, model ID, and published or negotiated rates. Those rates change often and must not be edited by reconciling the entire Kiali CR.

The implementation therefore:

- Stores **usage** in Prometheus (`kiali_ai_*_tokens_total`)
- Stores **prices** in an embedded YAML file or a user-managed ConfigMap
- Computes cost at query/enforce time: `tokens / 1e6 * cost_per_million`

## Pricing catalog ownership

Inlining hundreds of model prices in the Kiali CR would bloat the CR, dump them into the main ConfigMap, and force a Kiali reconcilation for every price change.

A dedicated user-managed ConfigMap:

- Is owned by FinOps/platform, not by the operator
- Is mounted only when the CR names it
- Uses the same YAML shape as the built-in file (`models:` list)
- Is `optional: true` so a missing ConfigMap does not block the pod; the server falls back to the built-in catalog

The operator never creates or writes this ConfigMap.

## Per-user budgets

Budgets must apply to exact usernames and to a `*` catch-all, without double-matching. Token limits are configured in **millions of tokens** so they stay in the same unit family as prices. Cost limits use the catalog currency (typically USD). Enforcement happens on the chat path before a new request is sent to the LLM, using Prometheus (and in-process counters) for usage in the current weekly or monthly window.

# Proposed Implementation

## Architecture

```
Chat request
    │
    ├─ ai.metrics == false  → no usage, no budgets, no cost
    │
    └─ ai.metrics == true
           │
           ├─ GetBudgetForUser(username)
           │     exact username, else "*", else no budget
           ├─ reject if provider/model not allowed
           ├─ reject if weekly/monthly cost or token cap already reached
           ├─ call LLM
           └─ RecordAITokens(username, provider, model, prompt, completion, total)

AI dashboard / consumption APIs
    │
    ├─ allowed_users_dashboard (empty = everyone)
    ├─ query Prometheus AI counters
    └─ calculateCost() via resolved ModelPricings
           │
           ├─ prizes_config_map == ""  → embed config/ai_default_prices.yaml
           └─ prizes_config_map set    → /kiali-ai-pricing/prices.yaml
                                         (fallback to embed on error)
```

Handler entry points live in `handlers/ai.go` and `handlers/ai_longterm.go`. Catalog loading lives in `config/ai.go`. Counters live in `prometheus/internalmetrics`.

## Metrics

When `ai.metrics` is true, each ChatAI response calls `RecordAITokens`. Counters share labels `{username, ai_provider, ai_model, request="chat"}`:

- `kiali_ai_prompt_tokens_total`
- `kiali_ai_completion_tokens_total`
- `kiali_ai_total_tokens_total`
- `kiali_ai_requests_total`
- `kiali_ai_request_duration_seconds` (histogram)

Weekly/monthly aggregates used by budgets and the dashboard are derived from these series (and from in-process event logs for the current process).

`ai.metrics` is required for consumption. If it is false, cost calculation returns nil, budgets are not enforced, and the consumption dashboard is disabled.

## Cost estimation

```go
inputCost  = (promptTokens / 1e6)     * prices.input_cost_per_million
outputCost = (completionTokens / 1e6) * prices.output_cost_per_million
total      = inputCost + outputCost
```

A catalog row matches when `provider` and `model_id` equal the usage labels. Optional cache write/read prices exist on the catalog for providers that publish them (for example Anthropic prompt caching); the current cost function uses input and output rates.

If no row matches, cost is omitted (tokens still display).

## Built-in catalog and `prizes_config_map`

The built-in catalog is `config/ai_default_prices.yaml`, embedded with `go:embed`. Entries cover Anthropic, OpenAI, and Google models with USD per million tokens.

`prizes_config_map` is a **string**: the name of a ConfigMap in the Kiali deployment namespace.

| `prizes_config_map` | Server behavior |
|---|---|
| omitted or `""` | Load embedded `ai_default_prices.yaml`. No extra volume. |
| ConfigMap name | Read `/kiali-ai-pricing/prices.yaml`. On missing/invalid file, log and fall back to the embedded catalog. |

The ConfigMap catalog **replaces** the built-in list. It must use the same schema:

```yaml
models:
  - provider: openai          # openai | anthropic | google | lightspeed
    model_id: gpt-4o          # provider model ID (matches usage label ai_model)
    currency: USD
    prices:
      input_cost_per_million: 2.50
      output_cost_per_million: 10.00
      cache_write_cost_per_million: 0    # optional
      cache_read_cost_per_million: 1.25  # optional
```

Resolved rows are kept in memory as `AIConsumptionConfig.ModelPricings` (`yaml:"-"`). They are not dumped back into the Kiali ConfigMap.

## Operator and Helm mount

When `spec.ai.consumption.prizes_config_map` (operator) or `ai.consumption.prizes_config_map` (Helm) is a non-empty name:

- Volume `kiali-ai-pricing` sources that ConfigMap (`optional: true`)
- VolumeMount path is `/kiali-ai-pricing` (`readOnly: true`)
- Expected key: `prices.yaml`

The operator does not create the ConfigMap. Kubernetes and OpenShift deployment templates both apply the same condition. Helm does the same when the value is set.

Example:

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
---
apiVersion: kiali.io/v1alpha1
kind: Kiali
spec:
  ai:
    enabled: true
    metrics: true
    consumption:
      prizes_config_map: kiali-ai-prices
```

Updating ConfigMap contents requires a Kiali pod restart (the server loads prices at config unmarshal time).

## Budgets

`ai.consumption.budgets` is a list of `UserBudgetConfig`:

| Field | Meaning |
|---|---|
| `usernames` | Users this budget applies to. Required, non-empty. `*` is a catch-all. |
| `interval` | `weekly` or `monthly` |
| `max_cost` | Max estimated cost in the interval (catalog currency) |
| `max_tokens` | Max tokens in the interval, in **millions** |
| `allowed_providers` | Provider types (`openai`, `anthropic`, `google`, `lightspeed`). Empty = all configured providers |
| `allowed_models` | Model names/IDs; `*` wildcards allowed. Empty = all models of allowed providers |

`GetBudgetForUser` prefers an exact username match (with `anonymous-shared` mapped to `anonymous`), then `*`. Empty `budgets` means no restrictions.

On each chat request (when metrics are on):

1. Resolve the budget for the user
2. Reject if the selected provider type is not in `allowed_providers`
3. Reject if the selected model is not in `allowed_models`
4. Reject if used cost ≥ `max_cost` or used tokens ≥ `max_tokens * 1e6` in the current interval

The UI receives remaining cost/tokens for the current user so the dashboard can show budget status.

## Dashboard access

`allowed_users_dashboard` is a list of usernames that may open the consumption dashboard. Empty means all authenticated users. This is independent of `ai.chat.allowed_users` (who may use the chatbot).

The public `/api/config` payload only exposes whether consumption is enabled and whether the current user is allowed; it does not leak the catalog or other users' budgets.

## Configuration

```yaml
ai:
  enabled: true
  metrics: true                 # required for usage, cost, budgets, dashboard
  consumption:
    allowed_users_dashboard: [] # empty = everyone
    prizes_config_map: ""       # empty = built-in catalog; set to a ConfigMap name to replace it
    budgets:
      - usernames: ["alice", "bob"]
        interval: monthly
        max_cost: 50
        max_tokens: 10          # 10 million tokens
        allowed_providers: ["openai", "anthropic"]
        allowed_models: ["gpt-4o", "claude-sonnet-*"]
      - usernames: ["*"]
        interval: weekly
        max_cost: 5
```

Defaults:

- `ai.metrics`: `false`
- `ai.consumption.allowed_users_dashboard`: `[]`
- `ai.consumption.prizes_config_map`: `""`
- `ai.consumption.budgets`: `[]`

Ansible/Helm defaults keep `prizes_config_map: ""`. An empty **list** must not be used for that field; it is a string ConfigMap name, not inline prices.

# Future Considerations

- **Hot reload**: watch `/kiali-ai-pricing` with fsnotify (same pattern as `CredentialManager`) so price edits do not require a pod restart
- **Merge catalogs**: allow the ConfigMap to override individual `provider`+`model_id` rows instead of replacing the whole built-in list
- **Cache token cost**: include `cache_write_cost_per_million` / `cache_read_cost_per_million` in `calculateCost` when the provider reports cached tokens
- **Alerting**: Prometheus rules on budget remaining or spend rate
- **Per-request cost in chat UI**: show estimated cost on each assistant message, not only on the consumption dashboard
