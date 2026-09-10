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
   1. [Target Architecture: Federation](#target-architecture-federation)
   2. [Why Not Same-TSDB Dual Storage](#why-not-same-tsdb-dual-storage)
   3. [Kiali Configuration](#kiali-configuration)
   4. [Minimum Duration Sensitivity](#minimum-duration-sensitivity)
   5. [Latency Budget](#latency-budget)
6. [Recording Rules Design](#recording-rules-design)
   1. [Recommended Rule Set](#recommended-rule-set)
   2. [Evaluation Interval](#evaluation-interval)
   3. [Federation Configuration](#federation-configuration)
   4. [Complementary Upstream Reduction](#complementary-upstream-reduction)
7. [Kiali Implementation Plan](#kiali-implementation-plan)
   1. [Metric Names](#metric-names)
   2. [Affected Code Paths](#affected-code-paths)
   3. [Feature Detection](#feature-detection)
   4. [Kiali Self-Monitoring Metrics](#kiali-self-monitoring-metrics)
8. [Validation](#validation)
9. [Design Decisions](#design-decisions)
10. [Alternatives Considered](#alternatives-considered)
11. [Open Questions](#open-questions)
12. [Phased Roadmap](#phased-roadmap)

# Summary

This KEP explores support for Prometheus recording rules that pre-aggregate Istio mesh metrics by summing away per-proxy (pod-level) labels, reducing Prometheus storage and query load. Kiali already aggregates traffic at workload/service granularity in its PromQL queries and does not surface per-pod Istio telemetry. Pre-aggregated metrics are therefore largely compatible with Kiali's existing query patterns.

The primary motivation for aggregation is reduced storage and faster Kiali queries (fewer series scanned per PromQL evaluation). Storing both raw and aggregated metrics in the same TSDB defeats the storage goal — operators adopting this pattern want raw metrics disposed of, not retained alongside aggregates.

The recommended architecture follows [Istio Observability Best Practices](https://istio.io/latest/docs/ops/best-practices/observability/):

1. Edge Prometheus: scrapes raw `istio_*`, evaluates `workload:*` recording rules, short retention (e.g. 6h).
2. Federated Prometheus (destination): federates `workload:*` from the edge, relabels to original metric names (`istio_requests_total`), long retention.
3. Kiali: queries Federated Prometheus — no metric name changes required.

Both Prometheus instances are production components; Federated Prometheus is Kiali's query target.

Kiali-side work focuses on documentation for pointing `external_services.prometheus.url` at Federated Prometheus. No new Kiali configuration is required: the existing `globalScrapeInterval` auto-detection provides the correct minimum duration floor when the federated Prometheus `global.scrape_interval` matches the federation job interval.

# Motivation

Users report high cardinality of Istio metrics in Prometheus. Kiali is a heavy consumer: traffic graphs issue multiple `sum(rate(...)) by (...)` queries per namespace; health monitoring fetches raw `rate(istio_requests_total{...})` vectors across namespaces; graph appenders add histogram and security-policy queries.

Although Kiali's queries already roll up to workload/service granularity, Prometheus still stores raw per-proxy series. Every Kiali query must scan and aggregate those series at query time, increasing Prometheus CPU and latency at scale.

Recording rules that sum away scrape-level labels (primarily `pod`, `pod_template_hash`, `instance`) reduce:

- Storage: fewer active series in the long-term TSDB
- Query cost: Kiali reads lower-cardinality counters/histograms
- Scrape-adjacent load: complementary upstream label removal (Telemetry API) can further reduce emission

## Goals

- Document a recording-rules + federation approach compatible with Kiali's traffic graph, health, and metrics features
- Align with Istio's recommended production monitoring architecture
- Document how Kiali's existing `globalScrapeInterval` auto-detection works correctly with federation (no new config needed)
- Preserve acceptable freshness for operational use (~1 minute latency budget)
- Maintain backward compatibility: default config preserves current behavior (raw `istio_*` on a single Prometheus)
- Provide validation queries and a reference recording-rules + federation bundle (future work)

## Non-Goals

- Shipping recording rules or federation config inside the Kiali operator/server (cluster operators own Prometheus config)
- Replacing all high-cardinality labels (e.g. `response_code`, mTLS principals) — pod-level aggregation only in the initial scope
- Pre-computing `rate()` in recording rules (Kiali continues to apply `rate()` at query time with user-selected windows)
- Changing Kiali's graph topology or health algorithms
- Mandating recording rules for all deployments
- VictoriaMetrics per-metric retention as a primary target — a single-TSDB approach where raw series are dropped while aggregates are retained is possible with VictoriaMetrics but is a niche solution outside this KEP's scope

# Background

## How Kiali Queries Istio Metrics Today

Kiali does not query per-pod Istio labels (`source_pod`, `destination_pod`) for mesh traffic. The traffic graph builds queries such as:

```promql
sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo"}[600s]))
by (source_cluster,source_workload,...,response_code,grpc_response_status,response_flags)
```

Health queries use raw vectors:

```promql
rate(istio_requests_total{destination_service_namespace="bookinfo",...}[5m]) > 0
```

Aggregation to protocol + response code happens in Go (`models/health.go`). Graph appenders additionally query histogram and byte metrics.

Kiali does not consume Istio recording rules today. All queries target raw `istio_*` metric names on whatever Prometheus `external_services.prometheus.url` points to.

## Where Cardinality Comes From

| Layer              | Driver                                                    | Kiali impact                            |
| ------------------ | --------------------------------------------------------- | --------------------------------------- |
| Istio emission     | Per-proxy counters with scrape labels (`pod`, `instance`) | Storage for all consumers               |
| Prometheus storage | One series per proxy × label combination                  | Query scan cost                         |
| Kiali graph        | 17+ labels in `group by`, including `response_code`       | Multiple queries per namespace          |
| Kiali appenders    | Histogram `le` buckets, mTLS principals                   | Additional high-cardinality queries     |
| Health monitor     | Raw `rate()` per namespace                                | Background load; cache skipped at scale |

Pod-label aggregation addresses the largest storage win with the lowest risk to Kiali fidelity.

## Existing Kiali Duration Constraints

The frontend already filters the duration dropdown using `globalScrapeInterval × 2` (from Prometheus config via `/api/config`):

```typescript
// frontend/src/config/ServerConfig.ts
d[0] >= scrapeInterval * 2;
```

Metrics charts use the same bound for minimum step size (`frontend/src/services/Prometheus.ts`). This assumes raw scrape granularity is the limiting factor. With federated aggregated metrics, the relevant bound becomes the rule evaluation interval plus federation scrape interval.

# Problem Statement

1. Storage and query cost: Raw Istio metrics are over-sharded for Kiali's workload-level use case.
2. No per-metric TTL in Prometheus: Vanilla Prometheus cannot drop raw `istio_*` while retaining `workload:istio_*` in the same TSDB. Keeping both increases storage — the opposite of the operator's goal.
3. Duration floor: Minimum user-facing rate windows must account for rule evaluation and federation scrape intervals, not just Envoy scrape interval.
4. Deployment model: Kiali must document and support the Istio-recommended pattern of querying a federated Prometheus that holds only federated, relabeled aggregates.

# Proposed Solution

## Target Architecture: Federation

Following [Istio Observability Best Practices — Federation using workload-level aggregated metrics](https://istio.io/latest/docs/ops/best-practices/observability/#federation-using-workload-level-aggregated-metrics):

```
┌─────────────────────────────────────┐
│ Edge Prometheus             │
│  • scrape raw istio_*  (15s)        │
│  • eval workload:* rules (5–30s)    │
│  • retention: 6h (raw + workload:*) │
└──────────────┬──────────────────────┘
               │  /federate (30s)
               │  match: workload:*
               │  relabel: workload:(.*) → \1
               ▼
┌─────────────────────────────────────┐
│ Federated Prometheus               │
│  • stores istio_* (relabeled)       │
│  • low cardinality, long retention  │
│  • Kiali queries HERE               │
└─────────────────────────────────────┘
```

Key properties:

- Edge Prometheus holds raw metrics only long enough for recording rules to evaluate.
- Federated Prometheus receives only `workload:*` series (plus any additional matches such as `pilot*`).
- Federation relabel restores original names: `workload:istio_requests_total` → `istio_requests_total`.
- Kiali requires no metric prefix config when pointed at federated Prometheus — existing hardcoded `istio_*` names work unchanged.
- Raw metrics are not retained long-term; storage savings are real, not offset by dual retention.

Istio explicitly states that existing dashboards and queries continue working _"when pointed at the federated Prometheus instance (and away from the Istio instance)"_.

## Why Not Same-TSDB Dual Storage

Prometheus has global TSDB retention only — no per-metric TTL. Options for keeping both raw and aggregated in one instance:

| Approach                       | Storage outcome                                                           |
| ------------------------------ | ------------------------------------------------------------------------- |
| Same retention for both        | Increased storage (raw + aggregate coexist for full window)           |
| Short global retention         | Both raw and aggregate expire together — no long-term aggregate retention |
| Drop raw at ingest via relabel | Breaks recording rules (rules read raw from TSDB)                         |

Operators adopt aggregation to reduce storage. The federation model achieves this by:

- Edge: raw exists briefly as rule input, then ages out with short retention
- Federated: only aggregated, relabeled series with long retention

A single-TSDB approach where raw is dropped but aggregates are kept is only practical with systems that support per-metric retention (e.g. VictoriaMetrics `-retentionFilter`). That is out of scope for this KEP.

## Kiali Configuration

Primary change: document that `external_services.prometheus.url` should point at the federated Prometheus when using this pattern.

No new Kiali configuration setting is required. Kiali already reads `globalScrapeInterval` from the Prometheus it queries and filters the duration dropdown to `>= 2 × globalScrapeInterval`. When the federated Prometheus `global.scrape_interval` matches the federation job's `scrape_interval` (both 30s in the recommended setup), Kiali auto-detects the correct minimum duration of 60s (1m). Operators should ensure the federated Prometheus `global.scrape_interval` matches or exceeds the federation job interval.

No `istio_metric_prefix` is needed when Kiali queries the federated Prometheus (names are relabeled upstream).

## Minimum Duration Sensitivity

When Kiali queries federated aggregated metrics, minimum offered duration must satisfy:

```
duration >= 2 × federation_scrape_interval
```

Each federation scrape produces exactly one data point in the federated TSDB. Prometheus `rate()` requires at least two data points in the range window, so the minimum useful window is `2 × federation_scrape_interval`. The recording rule interval affects the freshness of each counter snapshot but does not change the spacing of data points in the federated TSDB.

| Federation scrape | Min duration (2×) | Notes |
| ----------------- | ----------------- | ----- |
| 15s               | 30s               | High federation load; rarely needed |
| 30s (recommended) | 60s               | Matches Kiali's smallest dropdown (1m) |
| 1m                | 2m                | Acceptable for large-scale, less-interactive use |

No new Kiali configuration is required. Kiali reads `globalScrapeInterval` from the federated Prometheus and computes the duration floor as `2 × globalScrapeInterval`. With 30s federation and federated Prometheus `global.scrape_interval: 30s`, Kiali auto-detects the correct floor of 60s (1m). Operators should ensure the federated Prometheus `global.scrape_interval` matches or exceeds the federation job interval.

## Latency Budget

Federation adds latency versus querying the edge Prometheus directly. With the recommended 30s/30s/30s intervals (edge scrape, rule evaluation, federation scrape), all three run on independent, unsynchronized clocks. Worst-case staleness of a single counter snapshot:

```
T+0s    Envoy emits counter
T+30s   Edge Prometheus scrapes raw (worst case, next scrape cycle)
T+60s   Recording rule evaluates (worst case, next rule cycle)
T+90s   Federated Prometheus federates (worst case, next federation cycle)
```

Worst-case staleness of the most recent data point is ~90s (three unsynchronized 30s intervals). Average staleness is ~45s. This staleness applies to each individual counter snapshot; rate accuracy between consecutive federation data points is unaffected because `rate()` computes the slope between pairs of correctly ordered samples regardless of their absolute delay.

| Kiali feature | Typical window | Acceptable?                                        |
| ------------- | -------------- | -------------------------------------------------- |
| Traffic graph | 60s–10m        | Yes                                                |
| Health        | 5m             | Yes                                                |
| Auto-refresh  | 15s–60s        | Graph advances each cycle; lags reality by ~30–90s |

Federation is efficient for data transfer and query cost (pre-aggregated series only) but trades freshness for storage savings. This is the intended Istio production tradeoff.

# Recording Rules Design

## Recommended Rule Set

Based on [Istio Observability Best Practices](https://istio.io/latest/docs/ops/best-practices/observability/) and Kiali query patterns. Prefix `workload:` matches Istio convention and is stripped by federation relabel before Kiali sees the data.

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

This should be the complete list, as we explicitly `sum without (...)` in the recording rules.

`pod`, `pod_template_hash`, `instance`, `namespace`, `job`, `node`

**Labels to preserve** (Kiali semantic):

This is not a complete list as we don't drop every attribute unused by Kiali. It is out of scope to maximize storage savings, we are more interested in reducing cardinality and ensuring the required Kiali attributes are preserved.

`reporter`, `source_*`, `destination_*`, `request_protocol`, `response_code`, `grpc_response_status`, `response_flags`, `connection_security_policy`, `source_principal`, `destination_principal`, `app`, `cluster`, `le`

Use `sum without (...)` rather than `sum by (...)` to avoid accidentally dropping required labels.

## Evaluation Interval

Set the recording rule group `interval` equal to the edge `scrape_interval` (both 30s in the recommended configuration). Evaluating rules faster than the scrape interval wastes CPU — the rule re-sums the same raw data with no new input. Evaluating slower means `workload:*` updates less often than new raw data arrives, adding unnecessary staleness.

Istio's own examples use `interval: 5s` with a 15s scrape. That was designed for their quick-start addon where the same Prometheus serves direct queries; 5s eval keeps `workload:*` fresh for local consumers. In a federation architecture where no one queries the edge directly, this benefit disappears — the federation scrape interval (not the rule eval interval) determines the sampling rate Kiali sees.

| Rule interval vs scrape | Effect |
| ----------------------- | ------ |
| Equal (recommended)     | One rule eval per scrape cycle; simple, efficient |
| Faster than scrape      | Extra evals re-sum unchanged data; wasted CPU |
| Slower than scrape      | `workload:*` updates lag behind available raw data |

Do not pre-compute `rate()` in rules; Kiali uses variable windows (`[60s]`–`[600s]`+).

## Federation Configuration

### Metric tiers

Federation config is split into two tiers so operators can keep the default
footprint small:

| Tier                 | Audience                                    | Source in `hack/istio/metric-rules/`                                  |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Core (Kiali)         | Traffic graph, health, lists, mesh overview | `core-metrics.yml`, `core-federation-match.yml`                       |
| Istio Dashboards     | Istio dashboards (Perses/Grafana)           | `istio-dashboard-metrics.yml`, `istio-dashboard-federation-match.yml` |

`kiali_*` self-monitoring metrics are not part of the Istio tiers above. See
[Kiali Self-Monitoring Metrics](#kiali-self-monitoring-metrics) for deployment options.

Core tier matches the [Kiali FAQ required metrics](https://kiali.io/docs/faq/general/#requiredmetrics).
Mesh, service, and workload Perses dashboards work on the core tier alone.

Dashboard tier adds metrics for control-plane detail, performance, ztunnel
(ambient), and WASM extension dashboards. Enable it only when Kiali Perses
dashboards are in use:

```bash
./hack/istio/metric-rules/demo/install.sh --with-dashboards
```

Operators integrating federation into their own Prometheus should merge
`istio-dashboard-federation-match.yml` selectors into federated Prometheus `match[]` only for
dashboard users. Perses must query the same federated Prometheus URL as Kiali.

Reference configuration from Istio docs:

```yaml
# Federated Prometheus scrape job
- job_name: "istio-prometheus"
  honor_labels: true
  metrics_path: "/federate"
  scrape_interval: 30s
  scrape_timeout: 30s
  params:
    "match[]":
      - '{__name__=~"workload:(.*)"}'
      - '{__name__=~"pilot(.*)"}'
  metric_relabel_configs:
    - source_labels: [__name__]
      regex: "workload:(.*)"
      target_label: __name__
      action: replace
```

The relabel step is what allows Kiali to query standard `istio_*` names without code changes.

`honor_labels: true` (required): Federation scrape jobs must set this. When
`honor_labels` is false (the Prometheus default), label conflicts between federated
series and the scrape job's own labels are resolved by renaming the federated labels
with an `exported_` prefix (for example `destination_workload` →
`exported_destination_workload`). Kiali PromQL expects the original Istio label names
(`source_*`, `destination_*`, `reporter`, etc.); without `honor_labels: true`,
federated metrics may not match graph, health, and metrics queries. Istio's federation
examples use `honor_labels: true` for the same reason.

Edge retention: Istio quick-start uses 6h. Raw and `workload:*` on the edge both expire with short retention; federated Prometheus holds the long-term relabeled history.

## Complementary Upstream Reduction

Recording rules complement but do not replace upstream cardinality reduction via the Istio Telemetry API:

```yaml
tagOverrides:
  source_pod:
    operation: REMOVE
  destination_pod:
    operation: REMOVE
```

This reduces Envoy emission and edge scrape bandwidth. Recording rules collapse per-replica counters into workload-level series for federation.

# Kiali Implementation Plan

## Metric Names

When Kiali queries the federated Prometheus, no metric name changes are required. Federation relabel restores `istio_requests_total` from `workload:istio_requests_total`.

Kiali code continues to use existing metric name strings. The deployment change is pointing `external_services.prometheus.url` at Federated Prometheus.

An `istio_metric_prefix` config is not planned for the federation path. It would only be relevant for operators querying the edge Prometheus directly (not the recommended production pattern).

## Affected Code Paths

| Area                                  | Change needed                                               |
| ------------------------------------- | ----------------------------------------------------------- |
| `graph/telemetry/istio/istio.go`      | None (metric names unchanged on federated Prom)             |
| `graph/telemetry/istio/appender/*`    | None                                                        |
| `prometheus/metrics.go`               | None                                                        |
| `business/metrics_definitions.go`     | None                                                        |
| `handlers/config.go`                  | Disabled-features probes use same names (on federated Prom) |
| `frontend/src/config/ServerConfig.ts` | None (existing `globalScrapeInterval` provides correct floor) |
| `graph/options.go`                    | None                                                        |
| Documentation                         | Federation deployment guide, prometheus.url targeting       |

## Feature Detection

`DisabledFeaturesHandler` probes for standard `istio_*` metric names. On the federated federated Prometheus these exist (via relabel). No prefix-aware probing needed.

Metrics not included in federation `match[]` will not be present on federated Prometheus. Kiali core features use the core tier only. Perses dashboard
panels that need the dashboard tier will be empty unless operators opt in
(see [Metric tiers](#metric-tiers)).

## Kiali Self-Monitoring Metrics

Kiali exports optional Prometheus metrics (`kiali_*`) from `server.observability.metrics`
(port default `9090`). These are not Istio/Envoy telemetry and are not covered by
the Istio recording rules or core/dashboard federation tiers.

| Setting                                              | Default | Purpose                                                   |
| ---------------------------------------------------- | ------- | --------------------------------------------------------- |
| `server.observability.metrics.enabled`               | `true`  | Operational metrics (API, graph, cache, validation, etc.) |
| `server.observability.metrics.health_status.enabled` | `false` | `kiali_health_status` gauge per mesh entity (opt-in)      |

The metrics listener starts when either flag is true. In all deployment options below,
`external_services.prometheus.url` targets federated Prometheus (federated mesh data).
The question is only where `kiali_*` series are scraped and whether they are aggregated
before reaching federated Prometheus.

### HA and `kiali_health_status`

With multiple Kiali replicas, each pod exports `kiali_health_status` for the same
entities with the same values (all replicas run the same health cache refresh).
This is duplicate series, not partition-of-work like Envoy counters.

| Metric family                                             | Multi-replica edge rule          | Rationale                                                       |
| --------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| Counters / histograms (`kiali_api_*`, `kiali_graph_*`, …) | `sum without (pod, instance, …)` | Each replica handles different requests; combine totals         |
| `kiali_health_status` (gauge)                             | `max without (pod, instance, …)` | Deduplicate identical copies; do not `sum` gauge values |

When replicas agree, `max` and `min` return the same status. When they briefly diverge,
`max` selects the worst status (higher value = worse health), which is appropriate for
alerting. Option 3 (direct to prod) must apply the same dedup in queries or recording
rules on federated Prometheus, because raw scrape retains per-replica duplicates.

### Option 1: Scrape Kiali on the Istio edge Prometheus

Kiali metrics are scraped by the same edge Prometheus that collects Istio/Envoy
telemetry. Recording rules on that edge aggregate `kiali_*` (with the dedup rule above
for `kiali_health_status`). Federated Prometheus federates both `workload:istio_*` and
aggregated `kiali_*` (or a chosen prefix), with relabel restoring original metric names.

```
Kiali pods ──scrape──┐
                     ├──► Istio edge Prom ──rules──► workload:* / kiali:*
Istio/Envoy ──scrape─┘              │                        │
                                    └── federate ────────────┼──► Federated Prom ◄── Kiali queries
```

When to use: Operators already run an Istio edge scraper and want a single edge
pipeline for mesh and Kiali self-monitoring.

Pros: One edge TSDB; same federation job pattern as Istio; Federated Prometheus receives
low-cardinality series only.

Cons: Couples Kiali scrape configuration to the Istio edge Prometheus lifecycle.

Reference bundle: `hack/istio/metric-rules/kiali-metrics-recording-rules.yml` merged into the
Istio edge rules; `kiali-metrics-federation-match.yml` appended to the Istio federation job in
`demo/render-prometheus-federated.py` (`--with-kiali-metrics --kiali-edge istio`).

### Option 2: Dedicated Kiali edge Prometheus

Kiali metrics are scraped by a separate edge Prometheus used only for Kiali (or
platform components). That edge evaluates `kiali_*` recording rules and federates to the
same federated Prometheus that receives Istio federated metrics.

```
Kiali pods ──scrape──► Kiali edge Prom ──rules──► kiali:* ──federate──┐
                                                                       ├──► Federated Prom ◄── Kiali
Istio/Envoy ──scrape──► Istio edge Prom ──rules──► workload:* ──federate──┘
```

When to use: Istio edge and Kiali monitoring are owned by different teams, live in
different namespaces/clusters, or must not share scrape configuration.

Pros: Isolation; same Federated Prometheus query URL for Kiali; Federated Prometheus still receives
aggregated series only.

Cons: Additional Prometheus instance to operate on the Kiali side.

Reference bundle: `hack/istio/metric-rules/demo/prometheus-kiali-edge.yaml` (dedicated edge
scraper + `kiali-metrics-recording-rules.yml`); separate federation job in
`demo/render-prometheus-federated.py` (`--with-kiali-metrics --kiali-edge dedicated`).

### Option 3: Scrape Kiali directly into Federated Prometheus

Kiali metrics are scraped directly into federated Prometheus with no edge
aggregation step. Istio mesh metrics still follow the edge → rules → federation path.

```
Kiali pods ──scrape──► Federated Prom ◄──query── Kiali
                         ▲
Istio edge ──federate───┘
```

When to use: Single-replica Kiali deployments, demos, or environments where
operational simplicity outweighs cardinality on federated Prometheus.

Pros: Simplest `kiali_*` pipeline; no extra edge Prom or federation `match[]` for Kiali.

Cons: Production retains raw per-replica `kiali_*` series when Kiali scales out;
histogram and counter queries must account for multiple targets. `kiali_health_status`
queries must deduplicate (for example `max by (cluster, namespace, health_type, name)
(kiali_health_status)`) even on federated Prometheus, because raw scrape does not remove replica
duplicates.

### Comparison

|                                   | Option 1 (Istio edge)       | Option 2 (Kiali edge)       | Option 3 (direct prod)  |
| --------------------------------- | --------------------------- | --------------------------- | ----------------------- |
| Kiali scrape target               | Istio edge Prom             | Dedicated Kiali edge Prom   | Production Prom         |
| `kiali_*` aggregation before prod | Yes (recording rules)       | Yes (recording rules)       | No                      |
| Istio federation unchanged        | Yes                         | Yes                         | Yes                     |
| `kiali_health_status` dedup       | Edge rule (`max without …`) | Edge rule (`max without …`) | Query-time or prod rule |
| Production cardinality            | Low                         | Low                         | Higher with HA          |

Reference recording rules and federation snippets for Options 1 and 2 are future work
in `hack/istio/metric-rules/` (not yet bundled; Istio tiers are implemented first).

Dashboard-tier files document optional additions for ztunnel, WASM, and detailed
control-plane panels.

# Validation

Equivalence (edge vs federated):

```promql
# On edge Prometheus
sum(rate(workload:istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))

# On federated Prometheus (after relabel)
sum(rate(istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))

# Should match
```

Series count (edge only, before federation):

```promql
count({__name__="istio_requests_total"})
count({__name__="workload:istio_requests_total"})
```

Functional validation: traffic graph topology, edge status colors, health error ratios, metrics tab, response-time/throughput appenders — all against federated Prometheus.

# Design Decisions

## Federation as the Primary Pattern

Operators aggregate to reduce storage. Federation to a federated Prometheus with relabeled names is the Istio-recommended way to dispose of raw metrics while retaining long-term aggregates. Kiali targets this pattern.

## No Same-TSDB Dual Retention

Storing raw and aggregated metrics in one Prometheus TSDB increases storage for the retention window. This defeats the operator's goal and is not a target deployment model.

## No Metric Prefix Config

Federation relabel restores original `istio_*` names on the federated Prometheus Kiali queries. No Kiali code changes to metric name strings are required.

## Aggregate Counter Values, Not Rates

Recording rules sum counter snapshots on the edge. Kiali applies `rate()` at query time with user-selected duration on the federated Prometheus.

## Duration Floor Follows Federation Scrape Interval

Minimum duration is `2 × federation_scrape_interval`, not Envoy scrape interval. Kiali's existing `globalScrapeInterval` auto-detection provides the correct floor when the federated Prometheus `global.scrape_interval` matches the federation job interval.

## VictoriaMetrics Out of Scope

VictoriaMetrics supports per-metric retention filters that could drop raw `istio_*` while keeping aggregates in a single TSDB. This is a valid niche approach but not the primary target for Kiali documentation or configuration.

# Alternatives Considered

| Alternative                                              | Outcome                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Same-TSDB raw + aggregate                                | Rejected — increases storage; no per-metric TTL in Prometheus                                              |
| Kiali queries edge Prometheus with `istio_metric_prefix` | Rejected as primary — raw retained on edge; prefix config adds complexity; doesn't solve long-term storage |
| Federation with relabel to federated Prom                | Selected — Istio-aligned; storage savings; no Kiali metric name changes                                |
| VictoriaMetrics single-TSDB with retention filters       | Valid niche; out of scope for this KEP                                                                     |
| Pre-compute `rate()` in rules                            | Rejected — locks window; Kiali uses variable `[duration]`                                                  |
| Telemetry API only (no recording rules)                  | Insufficient — reduces labels per series but not per-replica counter fan-out                               |

# Open Questions

1. ~~Should `metric_aggregation_interval` be auto-derived from Prometheus config or config-only?~~ Resolved: no new setting needed. Kiali's existing `globalScrapeInterval` auto-detection works correctly when the federated Prometheus `global.scrape_interval` matches the federation job interval.
2. Do we ship a reference recording-rules + federation bundle in `hack/istio/` for CI/local testing?
3. Should the outer `sum by (...)` in graph queries be elided when reading pre-aggregated series (optimization only)?
4. ~~How do multicluster deployments handle federation?~~ Typical pattern: each mesh cluster runs its own Edge Prometheus (local scrape + recording rules); each Edge federates into that cluster's Federated Prometheus, or into a shared central Federated Prometheus if the organization consolidates metrics. Kiali multicluster config already supports per-cluster `external_services.prometheus.url`—point each at the Federated Prometheus holding that cluster's federated series (not the Edge scraper). Whether to use per-cluster Federated Prometheus vs one central federator remains an organizational/storage decision; both fit this KEP.
5. ~~Is a minimum duration of `4×` (vs `2×`) aggregation interval worth enforcing for rate quality on federated data?~~ Resolved: `2 × federation_scrape_interval` is sufficient; this matches the existing `2 × globalScrapeInterval` behavior.
6. Which non-traffic metrics (ztunnel, `istio_build`) should be documented as optional `match[]` extensions?
7. ~~Which `kiali_*` deployment option should the reference bundle implement first?~~ Options 1–2 are in `hack/istio/metric-rules/`; Option 3 remains documentation-only.
8. Should `kiali_health_status` dedup use `max` or `min` when replicas briefly disagree during rollout?

# Phased Roadmap

- [ ] Phase 0: KEP review and consensus (this document)
- [ ] Phase 1: Reference recording-rules + federation bundle (`hack/istio/metric-rules/`); CI validation script; [kiali.io Prometheus tuning doc](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation)
- [ ] Phase 2: Documentation — operator guide (prometheus.url → federated Prom), equivalence validation, Istio version compatibility
- [x] Phase 3: Reference `kiali_*` recording rules and federation for Options 1–2 (`kiali-metrics-recording-rules.yml`, `kiali-metrics-federation-match.yml`, `demo/prometheus-kiali-edge.yaml`); dedup guidance for Option 3 in this KEP
- [ ] Phase 4 (optional): Query optimization — skip redundant `sum by` on pre-aggregated series
