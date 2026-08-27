# Istio Metric Recording Rules KEP

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#non-goals)
3. [Background](#background)
   1. [How Kiali Queries Istio Metrics Today](#how-kiali-queries-istio-metrics-today)
   2. [Where Cardinality Comes From](#where-cardinality-comes-from)
   3. [Existing Kiali Duration Constraints](#existing-kiali-duration-constraints)
4. [Problem Statement](#problem-statement)
5. [Proposed Solution](#proposed-solution)
   1. [Recording Rules on the Scraping Prometheus](#recording-rules-on-the-scraping-prometheus)
   2. [Kiali Configuration](#kiali-configuration)
   3. [Minimum Duration Sensitivity](#minimum-duration-sensitivity)
   4. [Query Path (No Federation for Kiali)](#query-path-no-federation-for-kiali)
6. [Recording Rules Design](#recording-rules-design)
   1. [Recommended Rule Set](#recommended-rule-set)
   2. [Evaluation Interval](#evaluation-interval)
   3. [Retention Strategy](#retention-strategy)
   4. [Complementary Upstream Reduction](#complementary-upstream-reduction)
7. [Kiali Implementation Plan](#kiali-implementation-plan)
   1. [Metric Name Resolution](#metric-name-resolution)
   2. [Affected Code Paths](#affected-code-paths)
   3. [Feature Detection](#feature-detection)
   4. [Metrics Out of Scope](#metrics-out-of-scope)
8. [Validation](#validation)
9. [Design Decisions](#design-decisions)
10. [Alternatives Considered](#alternatives-considered)
11. [Open Questions](#open-questions)
12. [Phased Roadmap](#phased-roadmap)

# Summary

This KEP explores support for **Prometheus recording rules** that pre-aggregate Istio mesh metrics by summing away per-proxy (pod-level) labels, reducing Prometheus storage and query load. Kiali already aggregates traffic at workload/service granularity in its PromQL queries and does not surface per-pod Istio telemetry. Pre-aggregated metrics are therefore largely compatible with Kiali's existing query patterns.

The proposal has two parts:

1. **Cluster-side**: Prometheus recording rules (e.g. `workload:istio_requests_total`) evaluated on the **same** Prometheus instance that scrapes the mesh, at an interval of approximately **2× the scrape interval**.

2. **Kiali-side**: Configuration to query the recording-rule output via an **`istio_metric_prefix`** (default `""`) and a **`metric_aggregation_interval`** used to constrain minimum user-facing rate windows.

Kiali must **not** rely on federated or second-stage Prometheus for live queries; near-real-time traffic graphs and health require querying the scraping Prometheus directly.

# Motivation

Users report high cardinality of Istio metrics in Prometheus. Kiali is a heavy consumer: traffic graphs issue multiple `sum(rate(...)) by (...)` queries per namespace; health monitoring fetches raw `rate(istio_requests_total{...})` vectors across namespaces; graph appenders add histogram and security-policy queries.

Although Kiali's queries already roll up to workload/service granularity, Prometheus still stores raw per-proxy series. Every Kiali query must scan and aggregate those series at query time, increasing Prometheus CPU and latency at scale.

Recording rules that sum away scrape-level labels (primarily `pod`, `instance`) reduce:

- **Storage**: fewer active series in the TSDB
- **Query cost**: Kiali reads lower-cardinality counters/histograms
- **Scrape-adjacent load**: complementary upstream label removal (Telemetry API) can further reduce emission

## Goals

- Document a recording-rules approach compatible with Kiali's traffic graph, health, and metrics features
- Define Kiali configuration (`istio_metric_prefix`, `metric_aggregation_interval`) for opt-in support
- Preserve **near-real-time** behavior (no federation hop for live queries)
- Maintain backward compatibility: default config preserves current behavior (raw `istio_*` metrics)
- Provide validation queries and a reference recording-rules bundle (future work)

## Non-Goals

- Shipping recording rules inside the Kiali operator/server (cluster operators own Prometheus config)
- Replacing all high-cardinality labels (e.g. `response_code`, mTLS principals) — pod-level aggregation only in the initial scope
- Pre-computing `rate()` in recording rules (Kiali continues to apply `rate()` at query time with user-selected windows)
- Changing Kiali's graph topology or health algorithms
- Mandating recording rules for all deployments

# Background

## How Kiali Queries Istio Metrics Today

Kiali does **not** query per-pod Istio labels (`source_pod`, `destination_pod`) for mesh traffic. The traffic graph builds queries such as:

```promql
sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo"}[600s]))
by (source_cluster,source_workload,...,response_code,grpc_response_status,response_flags)
```

Health queries use raw vectors:

```promql
rate(istio_requests_total{destination_service_namespace="bookinfo",...}[5m]) > 0
```

Aggregation to protocol + response code happens in Go (`models/health.go`). Graph appenders additionally query histogram and byte metrics.

Kiali does **not** consume Istio recording rules today. All queries target raw `istio_*` metric names.

## Where Cardinality Comes From

| Layer | Driver | Kiali impact |
| ----- | ------ | ------------ |
| Istio emission | Per-proxy counters with scrape labels (`pod`, `instance`) | Storage for all consumers |
| Prometheus storage | One series per proxy × label combination | Query scan cost |
| Kiali graph | 17+ labels in `group by`, including `response_code` | Multiple queries per namespace |
| Kiali appenders | Histogram `le` buckets, mTLS principals | Additional high-cardinality queries |
| Health monitor | Raw `rate()` per namespace | Background load; cache skipped at scale |

Pod-label aggregation addresses the **largest storage win** with the **lowest risk** to Kiali fidelity.

## Existing Kiali Duration Constraints

The frontend already filters the duration dropdown using `globalScrapeInterval × 2` (from Prometheus config via `/api/config`):

```typescript
// frontend/src/config/ServerConfig.ts
d[0] >= scrapeInterval * 2
```

Metrics charts use the same bound for minimum step size (`frontend/src/services/Prometheus.ts`). This assumes raw scrape granularity is the limiting factor. With recording rules, the relevant bound becomes the **rule evaluation interval**, not the scrape interval.

# Problem Statement

1. **Storage and query cost**: Raw Istio metrics are over-sharded for Kiali's workload-level use case.
2. **Wrong aggregation tier for Kiali**: Federation to a central Prometheus introduces unacceptable latency for live graphs and health. Kiali must query the scraping Prometheus.
3. **Different metric names**: Recording rules produce new series (e.g. `workload:istio_requests_total`). Kiali hardcodes `istio_requests_total` throughout the codebase.
4. **Duration floor**: Minimum user-facing rate windows must account for rule evaluation interval, not just scrape interval.
5. **No automatic redirect**: Prometheus does not map `istio_requests_total` queries to recorded equivalents.

# Proposed Solution

## Recording Rules on the Scraping Prometheus

Deploy recording rules on the **same** Prometheus Kiali queries. Rules aggregate counter/histogram **values** by summing away scrape-level labels:

```yaml
- record: workload:istio_requests_total
  expr: |
    sum without (pod, instance, namespace, job, service, endpoint, container)
    (istio_requests_total)
```

Kiali continues to apply `rate(...[duration])` and `sum by (...)` at query time. Recording rules reduce series cardinality; they do not replace Kiali's rate windows.

**Freshness budget** (15s scrape, 30s rule eval):

```
T+0s   Envoy emits counter
T+15s  Prometheus scrapes raw series
T+30s  Recording rule updates workload:* series
T+30s  Kiali: rate(workload:istio_requests_total[duration])
```

Maximum added staleness ≈ one rule evaluation interval. This is acceptable relative to Kiali's typical `rate([60s])`–`rate([600s])` windows.

## Kiali Configuration

New settings under `external_services.prometheus`:

```yaml
external_services:
  prometheus:
    # Prefix prepended to Istio traffic metric names in PromQL.
    # Default "" queries raw istio_* metrics (current behavior).
    # Example: "workload:" queries workload:istio_requests_total
    istio_metric_prefix: ""

    # Interval at which recording rules evaluate aggregated metrics.
    # Used to compute minimum valid rate/duration windows in the UI.
    # Default: 2 × globalScrapeInterval when unset.
    metric_aggregation_interval: 30s
```

Both values are exposed via `/api/config` for frontend duration filtering.

| Setting | Default | Purpose |
| ------- | ------- | ------- |
| `istio_metric_prefix` | `""` | Select raw vs recorded metric names |
| `metric_aggregation_interval` | `2 × scrape` | Minimum duration floor |

## Minimum Duration Sensitivity

When `istio_metric_prefix` is set (pre-aggregated metrics in use), minimum offered duration must satisfy:

```
duration >= 2 × metric_aggregation_interval
```

(ideally `>= 4 ×` for smoother rates at the floor)

| Scrape | Rule eval | Current min (`2× scrape`) | Required min (`2× rule eval`) |
| ------ | --------- | ------------------------- | ------------------------------ |
| 15s | 30s | 60s offered ✓ | 60s |
| 15s | 60s | 60s offered | **120s** needed |
| 30s | 30s | 60s offered ✓ | 60s |

Changes needed:

- **Frontend**: `computeValidDurations()` uses `metric_aggregation_interval` when prefix is non-empty
- **Backend**: `graph/options.go` clamps/rejects durations below the minimum (URL params currently bypass UI)
- **Metrics charts**: `computePrometheusRateParams()` uses aggregation interval for `minStep`

## Query Path (No Federation for Kiali)

```
                    ┌──────────────────────────────┐
  Envoy proxies ──▶ │ Scraping Prometheus          │
                    │  • scrape raw istio_*        │
                    │  • eval workload:* rules     │
                    │  • Kiali queries HERE        │
                    └──────────────────────────────┘
                              │
                              │ optional: remote_write workload:* only
                              ▼
                    ┌──────────────────────────────┐
                    │ Long-term store              │
                    │ (alerting, SRE dashboards)   │
                    │ NOT for Kiali live queries   │
                    └──────────────────────────────┘
```

Federation is acceptable for **retention tiering** and **platform alerting**, not as Kiali's query target.

# Recording Rules Design

## Recommended Rule Set

Based on [Istio Observability Best Practices](https://istio.io/latest/docs/ops/best-practices/observability/) and Kiali query patterns. Prefix `workload:` matches Istio convention.

**Counters:**

- `istio_requests_total`
- `istio_request_messages_total`
- `istio_response_messages_total`
- `istio_tcp_sent_bytes_total`
- `istio_tcp_received_bytes_total`
- `istio_tcp_connections_opened_total`
- `istio_tcp_connections_closed_total`

**Histograms** (all three components required for `histogram_quantile` and averages):

- `istio_request_duration_milliseconds_{bucket,sum,count}`
- `istio_request_bytes_{bucket,sum,count}`
- `istio_response_bytes_{bucket,sum,count}`

**Labels to drop** (scrape/infrastructure):

`pod`, `instance`, `namespace`, `job`, `service`, `endpoint`, `container`

**Labels to preserve** (Kiali semantic):

`reporter`, `source_*`, `destination_*`, `request_protocol`, `response_code`, `grpc_response_status`, `response_flags`, `connection_security_policy`, `source_principal`, `destination_principal`, `app`, `le`

Use `sum without (...)` rather than `sum by (...)` to avoid accidentally dropping required labels.

## Evaluation Interval

**Recommended: 2× scrape interval** (e.g. 15s scrape → 30s rule eval).

| Factor | 1× scrape | 2× scrape | 4× scrape |
| ------ | --------- | --------- | --------- |
| Freshness | Best | Good | Marginal at 60s graph window |
| Rule eval CPU | Highest | Moderate | Lowest |
| Kiali 60s graph | OK | OK | Risky |

Do **not** pre-compute `rate()` in rules; Kiali uses variable windows (`[60s]`–`[600s]`+).

## Retention Strategy

| Series | Retention | Consumer |
| ------ | --------- | -------- |
| Raw `istio_*` | Short (6–24h) | Rule evaluation input only |
| `workload:istio_*` | Long (30d+) | Kiali, dashboards, alerting |

Vanilla Prometheus lacks per-metric retention. Options:

- Accept temporary dual storage until raw ages out
- Use Mimir/Thanos label-based retention
- Remote-write `workload:*` to long-term store

**Important**: dropping raw at ingest via relabel breaks recording rules (rules read from TSDB). Short time-based retention is the safe approach.

## Complementary Upstream Reduction

Recording rules complement but do not replace upstream cardinality reduction via the Istio Telemetry API:

```yaml
tagOverrides:
  source_pod:
    operation: REMOVE
  destination_pod:
    operation: REMOVE
```

This reduces Envoy emission and scrape bandwidth. Recording rules still help by collapsing per-replica counters into workload-level series.

# Kiali Implementation Plan

## Metric Name Resolution

Central helper (config or prometheus package):

```go
func IstioMetricName(base string) string {
    return config.Get().ExternalServices.Prometheus.IstioMetricPrefix + base
}
```

Histogram suffixes append after prefix:

```go
IstioMetricName("istio_request_duration_milliseconds") + "_bucket"
// → workload:istio_request_duration_milliseconds_bucket
```

## Affected Code Paths

| Package | Usage | Apply prefix? |
| ------- | ----- | ------------- |
| `graph/telemetry/istio/istio.go` | Graph traffic queries | Yes |
| `graph/telemetry/istio/appender/*` | Response time, throughput, security | Yes |
| `prometheus/metrics.go` | Health rate queries | Yes |
| `business/metrics_definitions.go` | Metrics tab catalog | Yes |
| `handlers/config.go` | Disabled-features detection | Yes |
| `business/metrics.go` | Ztunnel TCP, `istio_build` | No (control-plane / pod-level) |

Estimated ~15–20 call sites.

## Feature Detection

`DisabledFeaturesHandler` probes Prometheus for metric existence. When `istio_metric_prefix` is set, probes must check prefixed names (e.g. `workload:istio_request_duration_milliseconds_sum`), or features will appear disabled incorrectly.

## Metrics Out of Scope

Initial prefix applies to **mesh traffic telemetry** only. These likely remain on raw names:

- `istio_build` (control plane version info)
- `container_*` / pod-scoped ztunnel resource metrics
- Kiali-exported metrics (`kiali_health_status`, etc.)

A future `istio_metric_prefix_exclude` list is possible if needed.

# Validation

Equivalence checks before cutover:

```promql
# Series count reduction
count({__name__="istio_requests_total"})
count({__name__="workload:istio_requests_total"})

# Rate equivalence (namespace-scoped)
sum(rate(istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))
-
sum(rate(workload:istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))

# Per-edge check
sum(rate(istio_requests_total{source_workload="productpage-v1",destination_workload="reviews-v1"}[5m]))
-
sum(rate(workload:istio_requests_total{source_workload="productpage-v1",destination_workload="reviews-v1"}[5m]))
```

Functional validation: traffic graph topology, edge status colors, health error ratios, metrics tab, response-time/throughput appenders.

# Design Decisions

## In-Place Aggregation, Not Federated Queries

Recording rules run on the scraping Prometheus. Kiali queries the same instance. Federation is for long-term storage only.

## Prefix Config Over Name Relabeling

An `istio_metric_prefix` config is explicit, supports coexistence during migration (raw + recorded), and avoids duplicate-series risk from relabeling both to `istio_*`.

Default `""` preserves backward compatibility.

## Aggregate Counter Values, Not Rates

Recording rules sum counter snapshots. Kiali applies `rate()` at query time with user-selected duration. This preserves variable rate windows.

## Scrape Labels Only in Initial Scope

Dropping `response_code`, principals, or other semantic labels requires separate analysis per feature. Pod/scrape label removal is low-risk because Kiali already aggregates them away in queries.

## Duration Floor Follows Rule Interval

When pre-aggregated metrics are enabled, minimum duration tracks `metric_aggregation_interval`, not scrape interval.

# Alternatives Considered

| Alternative | Rejected because |
| ----------- | ---------------- |
| Federation as Kiali query path | Unacceptable latency for live graphs |
| Relabel `workload:` → `istio_*` in Prometheus | Duplicate series if raw still scraped; implicit magic |
| Record as `istio_requests_total` (same name) | Conflicts with raw series in TSDB |
| Pre-compute `rate()` in rules | Locks window; Kiali uses variable `[duration]` |
| Kiali-side query caching of aggregated results | Does not reduce Prometheus storage; separate concern (see graph-cache KEP) |
| Telemetry API only (no recording rules) | Reduces labels per series but not per-replica counter fan-out |

# Open Questions

1. Should Kiali auto-detect `workload:*` metrics and prefer them when present, or require explicit config?
2. Should `metric_aggregation_interval` be auto-discovered from Prometheus rule groups, or config-only?
3. Do we ship a reference `PrometheusRule` YAML in `hack/istio/` for CI/local testing?
4. Should the outer `sum by (...)` in graph queries be elided when reading pre-aggregated series (optimization only)?
5. How do multicluster deployments handle per-cluster prefix/interval config?
6. Is a minimum duration of `4×` (vs `2×`) aggregation interval worth enforcing for rate quality?

# Phased Roadmap

- [ ] **Phase 0**: KEP review and consensus (this document)
- [ ] **Phase 1**: Kiali config schema — `istio_metric_prefix`, `metric_aggregation_interval`; CRD/operator/helm updates
- [ ] **Phase 2**: Backend metric name helper; wire through graph, health, metrics, feature detection
- [ ] **Phase 3**: Frontend/backend minimum duration enforcement using `metric_aggregation_interval`
- [ ] **Phase 4**: Reference recording-rules bundle (`hack/istio/recording-rules/`); CI validation script
- [ ] **Phase 5**: Documentation — operator guide, equivalence validation, Istio version compatibility notes
- [ ] **Phase 6** (optional): Query optimization — skip redundant `sum by` on pre-aggregated series
