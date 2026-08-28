# Istio metric recording rules and federation

Reference artifacts and a **demo lab harness** for the [recording rules and federation guide](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation).

Production deployments should **not** rely on `install.sh` to deploy Prometheus. Instead, merge the YAML snippets below into your existing edge and production Prometheus configuration.

## Metric tiers

| Tier | File | Who needs it | Default demo install |
|------|------|--------------|----------------------|
| **Core (Kiali)** | `kiali-required-metrics.yml` | Traffic graph, health, lists, mesh overview | Yes |
| **Dashboards (Perses)** | `perses-dashboard-metrics.yml` | Kiali Perses Istio dashboards | No (`--with-dashboards`) |

Core tier matches the [Kiali FAQ required metrics](https://kiali.io/docs/faq/general/#requiredmetrics).

Dashboard tier adds metrics used by [Perses community-mixins Istio dashboards](https://github.com/perses/community-mixins/tree/main/examples/dashboards/perses/istio)
(control plane detail, performance, ztunnel, WASM). Mesh/service/workload dashboards
work on the core tier alone (except legacy `istio_request_duration_seconds_*` on
old Istio versions).

Federation selectors for the dashboard tier live in `federation-match-dashboards.yml`.

## Demo lab (not production)

`install.sh` targets the **Istio Prometheus add-on** in `istio-system` (kind-ci, minikube, small demos). It patches that edge Prometheus, deploys a sample `prometheus-prod` federator in the same namespace, and optionally repoints Kiali.

```bash
# Core Kiali federation only
./hack/istio/metric-rules/install.sh

# Core + Perses dashboard metrics
./hack/istio/metric-rules/install.sh --with-dashboards

# Point Kiali at the demo production Prometheus
./hack/istio/metric-rules/install.sh --switch-kiali
```

For production, follow the [kiali.io checklist](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#production-checklist) and apply `recording-rules.yml` plus federation `match[]` to your own Prometheus instances.

## Files

| File | Purpose |
|------|---------|
| `recording-rules.yml` | Edge Prometheus recording rules (`workload:*`) |
| `kiali-required-metrics.yml` | Canonical core metric list |
| `perses-dashboard-metrics.yml` | Optional dashboard metrics by dashboard ID |
| `federation-match-dashboards.yml` | Optional federation `match[]` selectors |
| `prometheus-prod.yaml` | Example production federation job (core tier; demo deploy) |
| `render-prometheus-prod.py` | Renders prod config; merges dashboard tier when requested |
| `install.sh` / `uninstall.sh` | Demo lab deploy and teardown only |

## Operator integration

1. Deploy recording rules on the Prometheus that **scrapes Istio/Envoy** (edge).
2. Add a federation scrape job to your **existing long-retention** Prometheus (production).
3. Federate **core** `match[]` from `prometheus-prod.yaml` (or `kiali-required-metrics.yml`).
4. If Kiali Perses dashboards are enabled, also federate selectors from `federation-match-dashboards.yml`.
5. Point Kiali (`external_services.prometheus.url`) and Perses at the production URL.
