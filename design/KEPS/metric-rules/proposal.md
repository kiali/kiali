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

This KEP explores support for **Prometheus recording rules** that pre-aggregate Istio mesh metrics by summing away per-proxy (pod-level) labels, reducing Prometheus storage and query load. Kiali already aggregates traffic at workload/service granularity in its PromQL queries and does not surface per-pod Istio telemetry. Pre-aggregated metrics are therefore largely compatible with Kiali's existing query patterns.

The primary motivation for aggregation is **reduced storage** and **faster Kiali queries** (fewer series scanned per PromQL evaluation). Storing both raw and aggregated metrics in the same TSDB defeats the storage goal — operators adopting this pattern want raw metrics disposed of, not retained alongside aggregates.

The recommended architecture follows [Istio Observability Best Practices](https://istio.io/latest/docs/ops/best-practices/observability/):

1. **Istio Prometheus** (edge): scrapes raw `istio_*`, evaluates `workload:*` recording rules, **short retention** (e.g. 6h).
2. **Production Prometheus** (destination): federates `workload:*` from the edge, **relabels to original metric names** (`istio_requests_total`), **long retention**.
3. **Kiali**: queries the **production** Prometheus — no metric name changes required.

Kiali-side work focuses on **`metric_aggregation_interval`** (rule eval + federation scrape) to constrain minimum user-facing rate windows, and documentation for pointing `external_services.prometheus.url` at the federated instance.

# Motivation

Users report high cardinality of Istio metrics in Prometheus. Kiali is a heavy consumer: traffic graphs issue multiple `sum(rate(...)) by (...)` queries per namespace; health monitoring fetches raw `rate(istio_requests_total{...})` vectors across namespaces; graph appenders add histogram and security-policy queries.

Although Kiali's queries already roll up to workload/service granularity, Prometheus still stores raw per-proxy series. Every Kiali query must scan and aggregate those series at query time, increasing Prometheus CPU and latency at scale.

Recording rules that sum away scrape-level labels (primarily `pod`, `instance`) reduce:

- **Storage**: fewer active series in the long-term TSDB
- **Query cost**: Kiali reads lower-cardinality counters/histograms
- **Scrape-adjacent load**: complementary upstream label removal (Telemetry API) can further reduce emission

## Goals

- Document a recording-rules + federation approach compatible with Kiali's traffic graph, health, and metrics features
- Align with Istio's recommended production monitoring architecture
- Define Kiali configuration for **`metric_aggregation_interval`** used to constrain minimum user-facing rate windows
- Preserve acceptable freshness for operational use (~1 minute latency budget)
- Maintain backward compatibility: default config preserves current behavior (raw `istio_*` on a single Prometheus)
- Provide validation queries and a reference recording-rules + federation bundle (future work)

## Non-Goals

- Shipping recording rules or federation config inside the Kiali operator/server (cluster operators own Prometheus config)
- Replacing all high-cardinality labels (e.g. `response_code`, mTLS principals) — pod-level aggregation only in the initial scope
- Pre-computing `rate()` in recording rules (Kiali continues to apply `rate()` at query time with user-selected windows)
- Changing Kiali's graph topology or health algorithms
- Mandating recording rules for all deployments
- **VictoriaMetrics per-metric retention** as a primary target — a single-TSDB approach where raw series are dropped while aggregates are retained is possible with VictoriaMetrics but is a niche solution outside this KEP's scope

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

Kiali does **not** consume Istio recording rules today. All queries target raw `istio_*` metric names on whatever Prometheus `external_services.prometheus.url` points to.

## Where Cardinality Comes From

| Layer              | Driver                                                    | Kiali impact                            |
| ------------------ | --------------------------------------------------------- | --------------------------------------- |
| Istio emission     | Per-proxy counters with scrape labels (`pod`, `instance`) | Storage for all consumers               |
| Prometheus storage | One series per proxy × label combination                  | Query scan cost                         |
| Kiali graph        | 17+ labels in `group by`, including `response_code`       | Multiple queries per namespace          |
| Kiali appenders    | Histogram `le` buckets, mTLS principals                   | Additional high-cardinality queries     |
| Health monitor     | Raw `rate()` per namespace                                | Background load; cache skipped at scale |

Pod-label aggregation addresses the **largest storage win** with the **lowest risk** to Kiali fidelity.

## Existing Kiali Duration Constraints

The frontend already filters the duration dropdown using `globalScrapeInterval × 2` (from Prometheus config via `/api/config`):

```typescript
// frontend/src/config/ServerConfig.ts
d[0] >= scrapeInterval * 2;
```

Metrics charts use the same bound for minimum step size (`frontend/src/services/Prometheus.ts`). This assumes raw scrape granularity is the limiting factor. With federated aggregated metrics, the relevant bound becomes the **rule evaluation interval plus federation scrape interval**.

# Problem Statement

1. **Storage and query cost**: Raw Istio metrics are over-sharded for Kiali's workload-level use case.
2. **No per-metric TTL in Prometheus**: Vanilla Prometheus cannot drop raw `istio_*` while retaining `workload:istio_*` in the same TSDB. Keeping both increases storage — the opposite of the operator's goal.
3. **Duration floor**: Minimum user-facing rate windows must account for rule evaluation and federation scrape intervals, not just Envoy scrape interval.
4. **Deployment model**: Kiali must document and support the Istio-recommended pattern of querying a production Prometheus that holds only federated, relabeled aggregates.

# Proposed Solution

## Target Architecture: Federation

Following [Istio Observability Best Practices — Federation using workload-level aggregated metrics](https://istio.io/latest/docs/ops/best-practices/observability/#federation-using-workload-level-aggregated-metrics):

```
┌─────────────────────────────────────┐
│ Istio Prometheus (edge)             │
│  • scrape raw istio_*  (15s)        │
│  • eval workload:* rules (5–30s)    │
│  • retention: 6h (raw + workload:*) │
└──────────────┬──────────────────────┘
               │  /federate (30s)
               │  match: workload:*
               │  relabel: workload:(.*) → \1
               ▼
┌─────────────────────────────────────┐
│ Production Prometheus               │
│  • stores istio_* (relabeled)       │
│  • low cardinality, long retention  │
│  • Kiali queries HERE               │
└─────────────────────────────────────┘
```

**Key properties:**

- Edge Prometheus holds raw metrics only long enough for recording rules to evaluate.
- Production Prometheus receives **only** `workload:*` series (plus any additional matches such as `pilot*`).
- Federation relabel restores original names: `workload:istio_requests_total` → `istio_requests_total`.
- **Kiali requires no metric prefix config** when pointed at production Prometheus — existing hardcoded `istio_*` names work unchanged.
- Raw metrics are not retained long-term; storage savings are real, not offset by dual retention.

Istio explicitly states that existing dashboards and queries continue working *"when pointed at the production Prometheus instance (and away from the Istio instance)"*.

## Why Not Same-TSDB Dual Storage

Prometheus has **global TSDB retention only** — no per-metric TTL. Options for keeping both raw and aggregated in one instance:

| Approach | Storage outcome |
| -------- | --------------- |
| Same retention for both | **Increased** storage (raw + aggregate coexist for full window) |
| Short global retention | Both raw and aggregate expire together — no long-term aggregate retention |
| Drop raw at ingest via relabel | Breaks recording rules (rules read raw from TSDB) |

Operators adopt aggregation to **reduce** storage. The federation model achieves this by:

- Edge: raw exists briefly as rule input, then ages out with short retention
- Production: only aggregated, relabeled series with long retention

A single-TSDB approach where raw is dropped but aggregates are kept is only practical with systems that support per-metric retention (e.g. VictoriaMetrics `-retentionFilter`). That is out of scope for this KEP.

## Kiali Configuration

Primary change: document that `external_services.prometheus.url` should point at the **production federated Prometheus** when using this pattern.

New setting under `external_services.prometheus`:

```yaml
external_services:
  prometheus:
    # Interval at which aggregated metrics receive new samples on the
    # Prometheus instance Kiali queries. Used to compute minimum valid
    # rate/duration windows in the UI.
    #
    # When using Istio's federation model, this is typically:
    #   rule_evaluation_interval + federation_scrape_interval
    # e.g. 5s rules + 30s federation = 35s, or 30s + 30s = 60s
    #
    # Default: 2 × globalScrapeInterval when unset (current behavior).
    metric_aggregation_interval: 35s
```

Exposed via `/api/config` for frontend duration filtering. No `istio_metric_prefix` is needed when Kiali queries the federated production Prometheus (names are relabeled upstream).

| Setting                       | Default      | Purpose                                        |
| ----------------------------- | ------------ | ---------------------------------------------- |
| `metric_aggregation_interval` | `2 × scrape` | Minimum duration floor; rule eval + federation |

## Minimum Duration Sensitivity

When Kiali queries federated aggregated metrics, minimum offered duration must satisfy:

```
duration >= 2 × metric_aggregation_interval
```

(ideally `>= 4 ×` for smoother rates at the floor)

`metric_aggregation_interval` should reflect the **coarsest sampling** of the data Kiali queries — typically federation scrape interval plus rule evaluation lag, not Envoy scrape interval.

| Rule eval | Federation scrape | Aggregation interval | Required min duration |
| --------- | ----------------- | -------------------- | --------------------- |
| 5s        | 30s               | 35s                  | 70s (→ 120s offered)  |
| 30s       | 30s               | 60s                  | 120s                  |

Changes needed:

- **Frontend**: `computeValidDurations()` uses `metric_aggregation_interval` when configured
- **Backend**: `graph/options.go` clamps/rejects durations below the minimum (URL params currently bypass UI)
- **Metrics charts**: `computePrometheusRateParams()` uses aggregation interval for `minStep`

## Latency Budget

Federation adds latency versus querying the edge Prometheus directly, but is efficient at scale and acceptable for Kiali's typical use:

```
T+0s    Envoy emits counter
T+15s   Edge Prometheus scrapes raw
T+20s   Recording rule updates workload:* (5s eval per Istio docs)
T+30s   Production Prometheus federates (30s interval per Istio docs)
T+30s   Kiali queries production Prom: rate(istio_requests_total[duration])
```

**Worst-case staleness: ~50s** (up to ~75s with 30s rule eval).

| Kiali feature | Typical window | Acceptable? |
| ------------- | -------------- | ----------- |
| Traffic graph | 60s–10m        | Yes         |
| Health        | 5m             | Yes         |
| Auto-refresh  | 15s–60s        | May lag 2–4 refresh cycles at 15s |

Federation is efficient for **data transfer and query cost** (pre-aggregated series only) but trades **freshness** for **storage savings**. This is the intended Istio production tradeoff.

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

`pod`, `instance`, `namespace`, `job`, `service`, `endpoint`, `container`

**Labels to preserve** (Kiali semantic):

`reporter`, `source_*`, `destination_*`, `request_protocol`, `response_code`, `grpc_response_status`, `response_flags`, `connection_security_policy`, `source_principal`, `destination_principal`, `app`, `le`

Use `sum without (...)` rather than `sum by (...)` to avoid accidentally dropping required labels.

## Evaluation Interval

Istio docs use **5s** rule evaluation. A practical range is **5s–30s** (up to 2× scrape interval).

| Factor              | 5s rules (Istio) | 30s rules |
| ------------------- | ---------------- | --------- |
| Freshness on edge   | Best             | Good      |
| Rule eval CPU       | Higher           | Lower     |
| Federation lag dom. | Yes              | Yes       |

Do **not** pre-compute `rate()` in rules; Kiali uses variable windows (`[60s]`–`[600s]`+).

## Federation Configuration

### Metric tiers

Federation config is split into two tiers so operators can keep the default
footprint small:

| Tier | Audience | Source in `hack/istio/metric-rules/` |
| ---- | -------- | ------------------------------------ |
| **Core (Kiali)** | Traffic graph, health, lists, mesh overview | `kiali-required-metrics.yml`, `prometheus-prod.yaml` |
| **Dashboards (Perses)** | Kiali Perses Istio dashboards | `perses-dashboard-metrics.yml`, `federation-match-dashboards.yml` |

`kiali_*` self-monitoring metrics are **not** part of the Istio tiers above. See
[Kiali Self-Monitoring Metrics](#kiali-self-monitoring-metrics) for deployment options.

Core tier matches the [Kiali FAQ required metrics](https://kiali.io/docs/faq/general/#requiredmetrics).
Mesh, service, and workload Perses dashboards work on the core tier alone.

Dashboard tier adds metrics for control-plane detail, performance, ztunnel
(ambient), and WASM extension dashboards. Enable it only when Kiali Perses
dashboards are in use:

```bash
./hack/istio/metric-rules/install.sh --with-dashboards
```

Operators integrating federation into their own Prometheus should merge
`federation-match-dashboards.yml` selectors into production `match[]` only for
dashboard users. Perses must query the same production Prometheus URL as Kiali.

Reference configuration from Istio docs:

```yaml
# Production Prometheus scrape job
- job_name: 'istio-prometheus'
  honor_labels: true
  metrics_path: '/federate'
  scrape_interval: 30s
  scrape_timeout: 30s
  params:
    'match[]':
      - '{__name__=~"workload:(.*)"}'
      - '{__name__=~"pilot(.*)"}'
  metric_relabel_configs:
    - source_labels: [__name__]
      regex: 'workload:(.*)'
      target_label: __name__
      action: replace
```

The relabel step is what allows Kiali to query standard `istio_*` names without code changes.

**Edge retention**: Istio quick-start uses 6h. Raw and `workload:*` on the edge both expire with short retention; production Prometheus holds the long-term relabeled history.

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

When Kiali queries the **production federated Prometheus**, no metric name changes are required. Federation relabel restores `istio_requests_total` from `workload:istio_requests_total`.

Kiali code continues to use existing metric name strings. The deployment change is pointing `external_services.prometheus.url` at the production instance.

An `istio_metric_prefix` config is **not planned** for the federation path. It would only be relevant for operators querying the edge Prometheus directly (not the recommended production pattern).

## Affected Code Paths

| Area | Change needed |
| ---- | ------------- |
| `graph/telemetry/istio/istio.go` | None (metric names unchanged on federated Prom) |
| `graph/telemetry/istio/appender/*` | None |
| `prometheus/metrics.go` | None |
| `business/metrics_definitions.go` | None |
| `handlers/config.go` | Disabled-features probes use same names (on federated Prom) |
| `config/` + `handlers/config.go` | Add `metric_aggregation_interval` |
| `frontend/src/config/ServerConfig.ts` | Duration floor from aggregation interval |
| `graph/options.go` | Backend duration validation |
| Documentation | Federation deployment guide, prometheus.url targeting |

## Feature Detection

`DisabledFeaturesHandler` probes for standard `istio_*` metric names. On the federated production Prometheus these exist (via relabel). No prefix-aware probing needed.

Metrics not included in federation `match[]` will not be present on production
Prometheus. Kiali core features use the **core tier** only. Perses dashboard
panels that need the **dashboard tier** will be empty unless operators opt in
(see [Metric tiers](#metric-tiers)).

## Kiali Self-Monitoring Metrics

Kiali exports optional Prometheus metrics (`kiali_*`) from `server.observability.metrics`
(port default `9090`). These are **not** Istio/Envoy telemetry and are **not** covered by
the Istio recording rules or core/dashboard federation tiers.

| Setting | Default | Purpose |
| ------- | ------- | ------- |
| `server.observability.metrics.enabled` | `true` | Operational metrics (API, graph, cache, validation, etc.) |
| `server.observability.metrics.health_status.enabled` | `false` | `kiali_health_status` gauge per mesh entity (opt-in) |

The metrics listener starts when **either** flag is true. In all deployment options below,
**`external_services.prometheus.url` targets production Prometheus** (federated mesh data).
The question is only where `kiali_*` series are scraped and whether they are aggregated
before reaching production.

### HA and `kiali_health_status`

With multiple Kiali replicas, each pod exports `kiali_health_status` for the **same**
entities with the **same** values (all replicas run the same health cache refresh).
This is **duplicate series**, not partition-of-work like Envoy counters.

| Metric family | Multi-replica edge rule | Rationale |
| ------------- | ---------------------- | --------- |
| Counters / histograms (`kiali_api_*`, `kiali_graph_*`, …) | `sum without (pod, instance, …)` | Each replica handles different requests; combine totals |
| `kiali_health_status` (gauge) | `max without (pod, instance, …)` | **Deduplicate** identical copies; do **not** `sum` gauge values |

When replicas agree, `max` and `min` return the same status. When they briefly diverge,
`max` selects the worst status (higher value = worse health), which is appropriate for
alerting. Option 3 (direct to prod) must apply the same dedup in **queries or recording
rules** on production, because raw scrape retains per-replica duplicates.

### Option 1: Scrape Kiali on the Istio edge Prometheus

Kiali metrics are scraped by the **same** edge Prometheus that collects Istio/Envoy
telemetry. Recording rules on that edge aggregate `kiali_*` (with the dedup rule above
for `kiali_health_status`). Production Prometheus federates both `workload:istio_*` and
aggregated `kiali_*` (or a chosen prefix), with relabel restoring original metric names.

```
Kiali pods ──scrape──┐
                     ├──► Istio edge Prom ──rules──► workload:* / kiali:*
Istio/Envoy ──scrape─┘              │                        │
                                    └── federate ────────────┼──► Prod Prom ◄── Kiali queries
```

**When to use:** Operators already run an Istio edge scraper and want a single edge
pipeline for mesh and Kiali self-monitoring.

**Pros:** One edge TSDB; same federation job pattern as Istio; production stays
low-cardinality.

**Cons:** Couples Kiali scrape configuration to the Istio edge Prometheus lifecycle.

**Reference bundle:** `hack/istio/metric-rules/kiali-recording-rules.yml` merged into the
Istio edge rules; `federation-match-kiali.yml` appended to the Istio federation job in
`render-prometheus-prod.py` (`--with-kiali-metrics --kiali-edge istio`).

### Option 2: Dedicated Kiali edge Prometheus

Kiali metrics are scraped by a **separate** edge Prometheus used only for Kiali (or
platform components). That edge evaluates `kiali_*` recording rules and federates to the
**same** production Prometheus that receives Istio federated metrics.

```
Kiali pods ──scrape──► Kiali edge Prom ──rules──► kiali:* ──federate──┐
                                                                       ├──► Prod Prom ◄── Kiali
Istio/Envoy ──scrape──► Istio edge Prom ──rules──► workload:* ──federate──┘
```

**When to use:** Istio edge and Kiali monitoring are owned by different teams, live in
different namespaces/clusters, or must not share scrape configuration.

**Pros:** Isolation; same production query URL for Kiali; production still receives
aggregated series only.

**Cons:** Additional Prometheus instance to operate on the Kiali side.

**Reference bundle:** `hack/istio/metric-rules/prometheus-kiali-edge.yaml` (dedicated edge
scraper + `kiali-recording-rules.yml`); separate federation job in
`render-prometheus-prod.py` (`--with-kiali-metrics --kiali-edge dedicated`).

### Option 3: Scrape Kiali directly into production Prometheus

Kiali metrics are scraped **directly** into production Prometheus with no edge
aggregation step. Istio mesh metrics still follow the edge → rules → federation path.

```
Kiali pods ──scrape──► Prod Prom ◄──query── Kiali
                         ▲
Istio edge ──federate───┘
```

**When to use:** Single-replica Kiali deployments, demos, or environments where
operational simplicity outweighs cardinality on production.

**Pros:** Simplest `kiali_*` pipeline; no extra edge Prom or federation `match[]` for Kiali.

**Cons:** Production retains **raw per-replica** `kiali_*` series when Kiali scales out;
histogram and counter queries must account for multiple targets. **`kiali_health_status`
queries must deduplicate** (for example `max by (cluster, namespace, health_type, name)
(kiali_health_status)`) even on production, because raw scrape does not remove replica
duplicates.

### Comparison

| | Option 1 (Istio edge) | Option 2 (Kiali edge) | Option 3 (direct prod) |
| --- | --- | --- | --- |
| Kiali scrape target | Istio edge Prom | Dedicated Kiali edge Prom | Production Prom |
| `kiali_*` aggregation before prod | Yes (recording rules) | Yes (recording rules) | No |
| Istio federation unchanged | Yes | Yes | Yes |
| `kiali_health_status` dedup | Edge rule (`max without …`) | Edge rule (`max without …`) | Query-time or prod rule |
| Production cardinality | Low | Low | Higher with HA |

Reference recording rules and federation snippets for Options 1 and 2 are **future work**
in `hack/istio/metric-rules/` (not yet bundled; Istio tiers are implemented first).

Dashboard-tier files document optional additions for ztunnel, WASM, and detailed
control-plane panels. Legacy `istio_request_duration_seconds_*` is listed only
for pre-1.17 Istio meshes.

# Validation

**Equivalence** (edge vs production federated):

```promql
# On edge Prometheus
sum(rate(workload:istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))

# On production Prometheus (after relabel)
sum(rate(istio_requests_total{destination_workload_namespace="bookinfo"}[5m]))

# Should match
```

**Series count** (edge only, before federation):

```promql
count({__name__="istio_requests_total"})
count({__name__="workload:istio_requests_total"})
```

**Functional validation**: traffic graph topology, edge status colors, health error ratios, metrics tab, response-time/throughput appenders — all against production Prometheus.

# Design Decisions

## Federation as the Primary Pattern

Operators aggregate to reduce storage. Federation to a production Prometheus with relabeled names is the Istio-recommended way to dispose of raw metrics while retaining long-term aggregates. Kiali targets this pattern.

## No Same-TSDB Dual Retention

Storing raw and aggregated metrics in one Prometheus TSDB increases storage for the retention window. This defeats the operator's goal and is not a target deployment model.

## No Metric Prefix Config

Federation relabel restores original `istio_*` names on the production Prometheus Kiali queries. No Kiali code changes to metric name strings are required.

## Aggregate Counter Values, Not Rates

Recording rules sum counter snapshots on the edge. Kiali applies `rate()` at query time with user-selected duration on the production Prometheus.

## Duration Floor Follows Aggregation Interval

Minimum duration tracks `metric_aggregation_interval` (rule eval + federation scrape), not Envoy scrape interval.

## VictoriaMetrics Out of Scope

VictoriaMetrics supports per-metric retention filters that could drop raw `istio_*` while keeping aggregates in a single TSDB. This is a valid niche approach but not the primary target for Kiali documentation or configuration.

# Alternatives Considered

| Alternative | Outcome |
| ----------- | ------- |
| Same-TSDB raw + aggregate | Rejected — increases storage; no per-metric TTL in Prometheus |
| Kiali queries edge Prometheus with `istio_metric_prefix` | Rejected as primary — raw retained on edge; prefix config adds complexity; doesn't solve long-term storage |
| Federation with relabel to production Prom | **Selected** — Istio-aligned; storage savings; no Kiali metric name changes |
| VictoriaMetrics single-TSDB with retention filters | Valid niche; out of scope for this KEP |
| Pre-compute `rate()` in rules | Rejected — locks window; Kiali uses variable `[duration]` |
| Telemetry API only (no recording rules) | Insufficient — reduces labels per series but not per-replica counter fan-out |

# Open Questions

1. Should `metric_aggregation_interval` be auto-derived from Prometheus config (scrape + federation job interval) or config-only?
2. Do we ship a reference recording-rules + federation bundle in `hack/istio/` for CI/local testing?
3. Should the outer `sum by (...)` in graph queries be elided when reading pre-aggregated series (optimization only)?
4. How do multicluster deployments handle federation — per-cluster production Prom, or central federator? Kiali already queries per-cluster Prometheus today.
5. Is a minimum duration of `4×` (vs `2×`) aggregation interval worth enforcing for rate quality on federated data?
6. Which non-traffic metrics (ztunnel, `istio_build`) should be documented as optional `match[]` extensions?
7. ~~Which `kiali_*` deployment option should the reference bundle implement first?~~ Options 1–2 are in `hack/istio/metric-rules/`; Option 3 remains documentation-only.
8. Should `kiali_health_status` dedup use `max` or `min` when replicas briefly disagree during rollout?

# Phased Roadmap

- [ ] **Phase 0**: KEP review and consensus (this document)
- [ ] **Phase 1**: Kiali config schema — `metric_aggregation_interval`; CRD/operator/helm updates
- [ ] **Phase 2**: Frontend/backend minimum duration enforcement using `metric_aggregation_interval`
- [ ] **Phase 3**: Reference recording-rules + federation bundle (`hack/istio/metric-rules/`); CI validation script; [kiali.io Prometheus tuning doc](https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation)
- [ ] **Phase 4**: Documentation — operator guide (prometheus.url → production Prom), equivalence validation, Istio version compatibility
- [x] **Phase 5**: Reference `kiali_*` recording rules and federation for Options 1–2 (`kiali-recording-rules.yml`, `federation-match-kiali.yml`, `prometheus-kiali-edge.yaml`); dedup guidance for Option 3 in this KEP
- [ ] **Phase 5** (optional): Query optimization — skip redundant `sum by` on pre-aggregated series
