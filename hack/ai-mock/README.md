# AI Metrics Mocking Tools

This directory contains tools to mock and inject AI-related metrics into a locally running Prometheus instance. This is useful for testing the Kiali AI dashboard and usage endpoints without having to generate real AI traffic.

## Prerequisites

> **Note**: This is strictly a development procedure to populate AI token data for testing the Kiali AI dashboard locally. Do not enable this in production without understanding the security implications of the Remote Write and Admin APIs.

1. **Prometheus with Remote Write and Admin API Enabled**:
   The injection script uses the Prometheus Remote Write API (`/api/v1/write`) and the Admin API (`/api/v1/admin/tsdb/delete_series` for `-clean`). By default, Prometheus does not enable these APIs. You must start Prometheus with the `--web.enable-remote-write-receiver` and `--web.enable-admin-api` flags.
   
   If you are running Prometheus via a Kubernetes deployment (e.g., in a KinD, Minikube, or CRC cluster), you can patch the Prometheus deployment to include these flags. For example, if Prometheus is in the `istio-system` namespace, run:

   ```bash
   kubectl patch deployment prometheus -n istio-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/1/args/-", "value": "--web.enable-remote-write-receiver"}, {"op": "add", "path": "/spec/template/spec/containers/1/args/-", "value": "--web.enable-admin-api"}]'
   kubectl rollout status deployment prometheus -n istio-system
   ```

2. **Prometheus Configured for Out-of-Order Metrics**:
   Because the script injects 30 days of historical data by default, Prometheus will reject these older timestamps with an `HTTP 400: out of bounds` error unless configured to accept them.
   
   You must update the Prometheus configuration (usually a ConfigMap named `prometheus`) to include `out_of_order_time_window` under `storage.tsdb`. For example:

   ```yaml
   storage:
     tsdb:
       out_of_order_time_window: 35d
   global:
     # ...
   ```
   
   If you are running Prometheus in a cluster, you can patch the ConfigMap and restart the deployment using these commands:
   ```bash
   kubectl get configmap prometheus -n istio-system -o jsonpath='{.data.prometheus\.yml}' > /tmp/prometheus.yml
   sed -i 's/global:/storage:\n  tsdb:\n    out_of_order_time_window: 35d\nglobal:/' /tmp/prometheus.yml
   kubectl create configmap prometheus -n istio-system --from-file=prometheus.yml=/tmp/prometheus.yml --dry-run=client -o yaml | kubectl apply -f -
   kubectl rollout restart deployment prometheus -n istio-system
   ```

3. **Access to Prometheus**:
   The script needs to reach your Prometheus instance. If you are running Kiali locally, you can point the script to the same Prometheus URL that Kiali uses, or port-forward Prometheus to a local port.

## Scripts

### `inject.sh`

This script builds and runs a Go program (`inject_metrics.go`) that constructs a Prometheus Remote Write payload and sends it to your Prometheus instance.

Show all options:

```bash
./inject.sh -h
```

#### Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `-port` | `9090` (if `-url` is not set) | Local Prometheus port (`http://localhost:<port>`) |
| `-url` | — | Full Prometheus base URL (overrides `-port`) |
| `-history-hours` | `720` | Recent hours of cumulative counter history. `0` = only current time |
| `-history-step` | `30m` | Interval between cumulative counter samples (e.g. `5m`, `15m`, `30m`, `30m`) |
| `-clean` | `false` | Delete all Kiali AI metrics from Prometheus and exit |
| `-force` | `false` | Inject even if metrics for a provider already exist |
| `-h`, `--help` | — | Show usage help |

#### Metrics injected

**Base counters** (labels: `username`, `ai_provider`, `ai_model`, `request`):
- `kiali_ai_prompt_tokens_total`
- `kiali_ai_completion_tokens_total`
- `kiali_ai_total_tokens_total` (always `prompt + completion`)
- `kiali_ai_requests_total` (no `username` label — matches Kiali)
- `kiali_ai_request_duration_seconds` (histogram, no `username` label — matches Kiali)

**Global metrics** (no labels):
- `kiali_ai_store_conversations_total` (gauge)
- `kiali_ai_store_evictions_total` (counter)

**Weekly buckets** (last 12 weeks, labels: `username`, `ai_provider`, `ai_model`, `request`, `year`, `week`). Each series starts at 0 at week start:
- `kiali_ai_prompt_tokens_weekly_total`
- `kiali_ai_completion_tokens_weekly_total`
- `kiali_ai_tokens_weekly_total`

**Monthly buckets** (last 12 months, labels: `username`, `ai_provider`, `ai_model`, `request`, `year`, `month`). Each series starts at 0 on the 1st:
- `kiali_ai_prompt_tokens_monthly_total`
- `kiali_ai_completion_tokens_monthly_total`
- `kiali_ai_tokens_monthly_total`

**Mock users** (6 provider/model rows across 3 usernames):

| Username     | Provider  | Model           |
|--------------|-----------|-----------------|
| `anonymous`  | openai    | gpt-4           |
| `anonymous`  | anthropic | claude          |
| `kiali_user` | anthropic | claude          |
| `kiali_user` | google    | gemini-2.5-pro  |
| `kubeadmin`  | openai    | gpt-4           |
| `kubeadmin`  | google    | gemini-2.5-pro  |

#### Usage examples

```bash
# Show help
./inject.sh -h

# Default: http://localhost:9090, 30d of cumulative counters every 30m
./inject.sh

# Custom local port (e.g. port-forward)
./inject.sh -port 14000

# Custom Prometheus URL
./inject.sh -url http://prometheus-istio-system.apps-crc.testing

# Single snapshot at current time only (no time-series history)
./inject.sh -port 14000 -history-hours 0

# Explicit 30d window with 1h step (same as defaults)
./inject.sh -port 14000 -history-hours 720 -history-step 30m

# Force re-injection even when provider metrics already exist
./inject.sh -port 14000 -force

# Delete all Kiali AI metrics from Prometheus (requires --web.enable-admin-api)
./inject.sh -port 14000 -clean
```

#### Skip existing providers

By default the tool queries Prometheus before injecting each provider. If `kiali_ai_total_tokens_total` already exists for that provider/model/user combination, it skips it and continues with the next one. Use `-force` to inject anyway.

> **Note:** Prometheus remote-write may reject samples with timestamps too far in the past (`HTTP 400: out of bounds`).
> The default 30-day window is safe for most local setups. Use `-history-hours 0` for a single snapshot only.
> After injecting, restart Kiali (or wait for its Prometheus seed) so it rebuilds the in-memory event log from `increase(metric[1h])`.
> Weekly/monthly metrics are **per-period** counters. Each `year`/`week` or `year`/`month` series starts at **zero** at the beginning of that period and stores only that period's usage (not a lifetime running total). The current week/month is scaled by elapsed time since the period started.

If successful, you will see:

```text
Building the metric injection tool...
Running the metric injection tool with args: -port 14000
Injecting AI metrics to http://localhost:14000/api/v1/write...
Prepared metrics for openai/gpt-4 (anonymous)
Successfully injected 468 time series for 6 provider(s) (0 skipped).
```

You can then query these metrics in your local Kiali instance or Prometheus UI.
