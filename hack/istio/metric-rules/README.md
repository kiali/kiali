# Istio metric recording rules and federation

Reference artifacts and a **demo lab harness** for the [recording rules and federation guide](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation).

**Production assumption:** Kiali always queries **production** Prometheus (`external_services.prometheus.url`). Istio mesh metrics reach production via edge recording rules and federation. Kiali self-monitoring (`kiali_*`) has three deployment options—see the [KEP](https://github.com/kiali/kiali/blob/master/design/KEPS/metric-rules/proposal.md#kiali-self-monitoring-metrics).

Production deployments should **not** rely on `install.sh` to deploy Prometheus. Instead, merge the YAML snippets below into your existing edge and production Prometheus configuration.

## Metric tiers

| Tier | File | Who needs it | Default demo install |
|------|------|--------------|----------------------|
| **Core (Kiali)** | `kiali-required-metrics.yml` | Traffic graph, health, lists, mesh overview | Yes |
| **Dashboards (Perses)** | `perses-dashboard-metrics.yml` | Kiali Perses Istio dashboards | No (`--with-dashboards`) |
| **Kiali self-monitoring** | `kiali-export-metrics.yml` | Kiali operational metrics (`kiali_*`) | No (`--with-kiali-metrics`) |

Core tier matches the [Kiali FAQ required metrics](https://kiali.io/docs/faq/general/#requiredmetrics).

Dashboard tier adds metrics used by [Perses community-mixins Istio dashboards](https://github.com/perses/community-mixins/tree/main/examples/dashboards/perses/istio)
(control plane detail, performance, ztunnel, WASM). Mesh/service/workload dashboards
work on the core tier alone (except legacy `istio_request_duration_seconds_*` on
old Istio versions).

Federation selectors for the dashboard tier live in `federation-match-dashboards.yml`.
Kiali self-monitoring federation selectors live in `federation-match-kiali.yml`.

## Kiali self-monitoring edge options

| Option | Demo flag | Edge Prometheus | Recording rules |
|--------|-----------|-----------------|-----------------|
| **1 — Shared Istio edge** | `--with-kiali-metrics` (default) | Existing Istio `prometheus` | `recording-rules.yml` + `kiali-recording-rules.yml` |
| **2 — Dedicated Kiali edge** | `--with-kiali-metrics --kiali-edge dedicated` | `prometheus-kiali-edge` | `kiali-recording-rules.yml` only |
| **3 — Direct prod scrape** | (not in demo harness) | None | Dedup in prod queries/rules |

Both options 1 and 2 federate aggregated `kiali:*` series to production and relabel to `kiali_*`.
See `kiali-export-metrics.yml` for per-metric HA aggregation (`sum` vs `max`).

## Demo lab (not production)

`install.sh` targets the **Istio Prometheus add-on** in `istio-system` (kind-ci, minikube, small demos). It patches that edge Prometheus, deploys a sample `prometheus-prod` federator in the same namespace, and optionally repoints Kiali.

```bash
# Core Kiali federation only
./hack/istio/metric-rules/install.sh

# Core + Perses dashboard metrics
./hack/istio/metric-rules/install.sh --with-dashboards

# Core + Kiali self-monitoring (shared Istio edge Prometheus)
./hack/istio/metric-rules/install.sh --with-kiali-metrics

# Core + Kiali self-monitoring (dedicated Kiali edge Prometheus)
./hack/istio/metric-rules/install.sh --with-kiali-metrics --kiali-edge dedicated

# Point Kiali at the demo production Prometheus
./hack/istio/metric-rules/install.sh --switch-kiali
```

For production, follow the [kiali.io checklist](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#production-checklist) and apply `recording-rules.yml` plus federation `match[]` to your own Prometheus instances.

## Files

| File | Purpose |
|------|---------|
| `recording-rules.yml` | Edge Prometheus recording rules (`workload:*`) |
| `kiali-recording-rules.yml` | Edge recording rules for Kiali metrics (`kiali:*`) |
| `kiali-export-metrics.yml` | Canonical Kiali self-monitoring metric list |
| `kiali-required-metrics.yml` | Canonical core Istio metric list |
| `perses-dashboard-metrics.yml` | Optional dashboard metrics by dashboard ID |
| `federation-match-dashboards.yml` | Optional federation `match[]` selectors (Perses) |
| `federation-match-kiali.yml` | Federation `match[]` selectors for `kiali:*` |
| `prometheus-prod.yaml` | Example production federation job (core tier; demo deploy) |
| `prometheus-kiali-edge.yaml` | Example dedicated Kiali edge Prometheus (Option 2) |
| `render-prometheus-prod.py` | Renders prod config; merges optional tiers |
| `render-prometheus-kiali-edge.py` | Renders dedicated Kiali edge config |
| `merge-recording-rules.py` | Merges Istio + optional Kiali recording rules |
| `install.sh` / `uninstall.sh` | Demo lab deploy and teardown only |

## Operator integration

1. Deploy recording rules on the Prometheus that **scrapes Istio/Envoy** (edge).
2. Add a federation scrape job to your **existing long-retention** Prometheus (production).
3. Federate **core** `match[]` from `prometheus-prod.yaml` (or `kiali-required-metrics.yml`).
4. If Kiali Perses dashboards are enabled, also federate selectors from `federation-match-dashboards.yml`.
5. Point Kiali (`external_services.prometheus.url`) and Perses at the **production** URL (never the edge scraper in production).
6. If Kiali self-monitoring is enabled, choose a `kiali_*` deployment option (shared Istio edge, dedicated Kiali edge, or direct prod scrape)—see [KEP](https://github.com/kiali/kiali/blob/master/design/KEPS/metric-rules/proposal.md#kiali-self-monitoring-metrics). For options 1–2, apply `kiali-recording-rules.yml` on the Kiali edge and federate `federation-match-kiali.yml` to production.
