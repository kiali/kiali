// Package internalmetrics provides functionality to collect Prometheus metrics.
package internalmetrics

import (
	// Because this package is used all throughout the codebase, be VERY careful adding new
	// kiali imports here. Most likely you will encounter an import cycle error that will
	// cause a compilation failure.
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/rs/zerolog"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// These constants define the different label names for the different metric timeseries
const (
	labelAppender         = "appender"
	labelCheckerName      = "checker"
	labelCluster          = "cluster"
	labelGraphKind        = "graph_kind"
	labelGraphType        = "graph_type"
	labelHealthType       = "health_type"
	labelModel            = "ai_model"
	labelName             = "name"
	labelNamespace        = "namespace"
	labelProvider         = "ai_provider"
	labelQueryGroup       = "query_group"
	labelRoute            = "route"
	labelService          = "service"
	labelType             = "type"
	labelUsername         = "username"
	labelWithServiceNodes = "with_service_nodes"
)

// MetricsType defines all of Kiali's own internal metrics.
type MetricsType struct {
	AICompletionTokensTotal        *prometheus.CounterVec
	AIPromptTokensTotal            *prometheus.CounterVec
	AIRequestDurationSeconds       *prometheus.HistogramVec
	AIRequestsTotal                *prometheus.CounterVec
	AIStoreConversationsTotal      prometheus.Gauge
	AIStoreEvictionsTotal          prometheus.Counter
	AITotalTokensTotal             *prometheus.CounterVec
	APIFailures                    *prometheus.CounterVec
	APIProcessingTime              *prometheus.HistogramVec
	CacheHitsTotal                 *prometheus.CounterVec
	CacheRequestsTotal             *prometheus.CounterVec
	CheckerProcessingTime          *prometheus.HistogramVec
	GraphAppenderTime              *prometheus.HistogramVec
	GraphCacheEvictionsTotal       prometheus.Counter
	GraphCacheHitsTotal            prometheus.Counter
	GraphCacheMissesTotal          prometheus.Counter
	GraphGenerationTime            *prometheus.HistogramVec
	GraphMarshalTime               *prometheus.HistogramVec
	GraphNodes                     *prometheus.GaugeVec
	HealthCacheHitsTotal           *prometheus.CounterVec
	HealthCacheMissesTotal         *prometheus.CounterVec
	HealthRefreshDuration          *prometheus.HistogramVec
	HealthStatus                   *prometheus.GaugeVec
	KubernetesClients              *prometheus.GaugeVec
	PrometheusProcessingTime       *prometheus.HistogramVec
	SingleValidationProcessingTime *prometheus.HistogramVec
	TracingProcessingTime          *prometheus.HistogramVec
	ValidationProcessingTime       *prometheus.HistogramVec
}

// Metrics contains all of Kiali's own internal metrics.
// These metrics can be accessed directly to update their values, or
// you can use available utility functions defined below.
var Metrics = MetricsType{
	AICompletionTokensTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_ai_completion_tokens_total",
			Help: "Cumulative completion tokens received from AI providers, labelled by username, provider and model.",
		},
		[]string{labelUsername, labelProvider, labelModel},
	),
	AIPromptTokensTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_ai_prompt_tokens_total",
			Help: "Cumulative prompt tokens sent to AI providers, labelled by username, provider and model.",
		},
		[]string{labelUsername, labelProvider, labelModel},
	),
	AITotalTokensTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_ai_total_tokens_total",
			Help: "Cumulative total tokens (prompt + completion) used with AI providers, labelled by username, provider and model.",
		},
		[]string{labelUsername, labelProvider, labelModel},
	),
	AIStoreConversationsTotal: prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "kiali_ai_store_conversations_total",
			Help: "The current number of conversations stored in the AI store.",
		},
	),
	AIStoreEvictionsTotal: prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "kiali_ai_store_evictions_total",
			Help: "The total number of conversations evicted from the AI store.",
		},
	),
	AIRequestsTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_ai_requests_total",
			Help: "The total number of AI requests sent by provider and model.",
		},
		[]string{labelProvider, labelModel},
	),
	AIRequestDurationSeconds: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_ai_request_duration_seconds",
			Help: "The time required to process an AI request by provider and model.",
		},
		[]string{labelProvider, labelModel},
	),
	GraphNodes: prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "kiali_graph_nodes",
			Help: "The number of nodes in a generated graph.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	GraphGenerationTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_graph_generation_duration_seconds",
			Help: "The time required to generate a graph.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	GraphAppenderTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_graph_appender_duration_seconds",
			Help: "The time required to execute an appender while generating a graph.",
		},
		[]string{labelAppender},
	),
	GraphMarshalTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_graph_marshal_duration_seconds",
			Help: "The time required to marshal and return the JSON for a graph.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	APIProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_api_processing_duration_seconds",
			Help: "The time required to execute a particular REST API route request.",
		},
		[]string{labelRoute},
	),
	PrometheusProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_prometheus_processing_duration_seconds",
			Help: "The time required to execute a Prometheus query.",
		},
		[]string{labelQueryGroup},
	),
	KubernetesClients: prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "kiali_kubernetes_clients",
			Help: "The number of Kubernetes clients in use.",
		},
		[]string{},
	),
	APIFailures: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_api_failures_total",
			Help: "Counts the total number of failures encountered by a particular API handler.",
		},
		[]string{labelRoute},
	),
	CheckerProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_checker_processing_duration_seconds",
			Help: "The time required to execute a validation checker.",
		},
		[]string{labelCheckerName},
	),
	ValidationProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_validation_processing_duration_seconds",
			Help: "The time required to execute a full validation check on a namespace or service.",
		},
		[]string{labelNamespace, labelService},
	),
	SingleValidationProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_single_validation_processing_duration_seconds",
			Help: "The time required to execute a validation check on a single Istio object.",
		},
		[]string{labelNamespace, labelType, labelName},
	),
	CacheRequestsTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_cache_requests_total",
			Help: "The number of total requests for the cache.",
		},
		[]string{labelName},
	),
	CacheHitsTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_cache_hits_total",
			Help: "The number of total hits for the cache.",
		},
		[]string{labelName},
	),
	GraphCacheHitsTotal: prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "kiali_graph_cache_hits_total",
			Help: "The number of total hits for the graph cache.",
		},
	),
	GraphCacheMissesTotal: prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "kiali_graph_cache_misses_total",
			Help: "The number of total misses for the graph cache.",
		},
	),
	GraphCacheEvictionsTotal: prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "kiali_graph_cache_evictions_total",
			Help: "The number of total evictions for the graph cache.",
		},
	),
	HealthCacheHitsTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_health_cache_hits_total",
			Help: "The number of health cache hits.",
		},
		[]string{labelHealthType},
	),
	HealthCacheMissesTotal: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_health_cache_misses_total",
			Help: "The number of health cache misses.",
		},
		[]string{labelHealthType},
	),
	HealthRefreshDuration: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "kiali_health_refresh_duration_seconds",
			Help:    "The time required to refresh health data.",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10), // 0.1s to ~51s
		},
		[]string{labelCluster},
	),
	HealthStatus: prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "kiali_health_status",
			Help: "Health status of individual apps, services, workloads, and namespaces as a numeric value. 0=Healthy (best), 1=Not Ready, 2=Degraded, 3=Failure (worst). NA or missing entities: series removed after max_consecutive_na consecutive health refresh cycles (server config). Labels: cluster, namespace, health_type (app/service/workload/namespace), name.",
		},
		[]string{labelCluster, labelNamespace, labelHealthType, labelName},
	),
	TracingProcessingTime: prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "kiali_tracing_processing_duration_seconds",
			Help: "The time required to execute a Tracing query.",
		},
		[]string{labelQueryGroup},
	),
}

// ObserveDurationAndLogResults will observe the duration time and then log it.
// The logger is to be found in the given context.
// The timerName can be anything, but convention is that you pass in the name of the
// function defined in this file which was used to obtain the timer. For example, if you
// obtained the timer via "GetGraphGenerationTimePrometheusTimer" the timerName you pass
// into this function should best be set to "GraphGenerationTime".
// data is a map of key/value pairs that will be logged in the structured data along with the given log message.
func ObserveDurationAndLogResults(ctx context.Context, cfg *config.Config, timer *prometheus.Timer, timerName string, data map[string]string, msg string) {
	duration := timer.ObserveDuration()

	// Skip logging anything if the duration is "fast" ("fast" being configurable).
	// Fast operations are typically uninteresting when troubleshooting - normally we only care about things that are slow.
	if duration < cfg.KialiInternal.MetricLogDurationLimit {
		return
	}

	zl := log.FromContext(ctx)

	if zl.GetLevel() > zerolog.TraceLevel {
		return // Trace level is not enabled, nothing left for us to do so return immediately
	}

	zle := zl.Trace()

	// add the given structured data if there is any
	if len(data) > 0 {
		for k, v := range data {
			zle = zle.Str(k, v)
		}
	}

	// log the message
	zle.Str("timer", timerName).
		Str("duration", duration.String()).
		Msg(msg)
}

// SuccessOrFailureMetricType let's you capture metrics for both successes and failures,
// where successes are tracked using a duration histogram and failures are tracked with a counter.
// Typical usage is:
//
//	func SomeFunction(...) (..., err error) {
//		sof := GetSuccessOrFailureMetricTypeObject()
//		defer sof.ObserveNow(&err)
//		... do the work of SomeFunction here...
//	}
//
// If a function doesn't support returning an error, then call ObserveDuration directly:
//
//	func SomeFunction(...) (...) {
//		sof := GetSuccessOrFailureMetricTypeObject()
//		defer sof.ObserveDuration()
//		... do the work of SomeFunction here...
//	}
//
// If a function doesn't support returning an error, but you still need to report a failure,
// call Inc() directly to increment the failure counter:
//
//	func SomeFunction(...) (...) {
//		sof := GetSuccessOrFailureMetricTypeObject()
//		defer func() { if (somethingBadHappened) { sof.Inc() } else { sof.ObserveDuration() }}()
//		... do the work of SomeFunction here...
//	}
type SuccessOrFailureMetricType struct {
	*prometheus.Timer
	prometheus.Counter
}

// ObserveNow will observe a duration unless *err is not nil
// in which case the error counter will be incremented instead.
// We use a pointer to err because this function is normally
// invoked via 'defer' and so the actual value of the error
// won't be set until the actual invocation of this function.
// (read the docs on 'defer' if you don't get it).
func (sof *SuccessOrFailureMetricType) ObserveNow(err *error) {
	if *err == nil {
		sof.ObserveDuration()
	} else {
		sof.Inc()
	}
}

// AITokenEntry holds cumulative token totals for a single (username, provider, model) triple.
// It is maintained in memory alongside the Prometheus counters to enable fast aggregation
// for the usage summary API without requiring a Prometheus HTTP query.
type AITokenEntry struct {
	CompletionTokens int64
	Model            string
	PromptTokens     int64
	Provider         string
	TotalTokens      int64
	Username         string
}

// AITokenEvent is a single token-usage observation recorded at a point in time.
// Events are kept in a bounded in-memory log and used to produce time-series charts.
type AITokenEvent struct {
	CompletionTokens int64
	Model            string
	PromptTokens     int64
	Provider         string
	Timestamp        time.Time
	TotalTokens      int64
	Username         string
}

var (
	aiTokenEventsMu  sync.RWMutex
	aiTokenEventsLog []AITokenEvent
	aiTokenTotals    = map[string]*AITokenEntry{}
	aiTokenTotalsMu  sync.RWMutex
	// aiTokensSeedingComplete is false from startup until InitAITokensFromPrometheus
	// finishes (or is confirmed unnecessary). The usage API exposes this as
	// dataReady so the frontend can show a loading state instead of empty charts.
	aiTokensSeedingComplete atomic.Bool
	// aiTokensSeedingDoneCh is closed once when seeding completes so that
	// WaitForAITokensSeedingComplete can block cheaply via a channel select.
	aiTokensSeedingDoneCh    = make(chan struct{})
	aiTokensSeedingCloseOnce sync.Once
	// maxAITokenEventAge is the primary retention policy for the event log.
	// Events older than this TTL are pruned on the next write, making the
	// time-series window predictable regardless of traffic volume.
	maxAITokenEventAge = 7 * 24 * time.Hour
	// maxAITokenEvents is a hard safety cap on the event log length.
	// It only activates under extreme burst traffic where the TTL window
	// alone would fill memory (e.g. > 10 000 AI requests within 7 days).
	// When hit, the oldest entries are dropped to keep the most recent data.
	maxAITokenEvents = 10_000
	// maxAITokenTotals is the maximum number of unique (username, provider, model) keys
	// kept in the cumulative totals map. When the cap is hit the 25 % of entries with
	// the smallest total-token count are pruned (least-significant users first).
	maxAITokenTotals = 5_000
	// aiTokenSeedStep is the Prometheus query step used when back-filling the event log
	// from historical range data at startup. One hour gives a good balance between
	// chart resolution and query cost over the 7-day retention window.
	aiTokenSeedStep = time.Hour
)

// pruneAITokenTotals removes the 25 % of entries with the smallest TotalTokens from
// aiTokenTotals. Must be called with aiTokenTotalsMu write-locked.
func pruneAITokenTotals() {
	pruneCount := maxAITokenTotals / 4

	// Collect all entries into a slice, sort ascending by TotalTokens, and delete
	// the bottom pruneCount entries.  Sorting is O(n log n) but only happens when
	// the map is already at capacity, so the amortised cost is acceptable.
	type kv struct {
		key   string
		total int64
	}
	entries := make([]kv, 0, len(aiTokenTotals))
	for k, e := range aiTokenTotals {
		entries = append(entries, kv{key: k, total: e.TotalTokens})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].total < entries[j].total })
	for i := 0; i < pruneCount && i < len(entries); i++ {
		delete(aiTokenTotals, entries[i].key)
	}
}

// GetAITokenEvents returns all token events recorded since the given time.
// The returned slice is a copy and safe to read after the call returns.
func GetAITokenEvents(since time.Time) []AITokenEvent {
	aiTokenEventsMu.RLock()
	defer aiTokenEventsMu.RUnlock()
	var out []AITokenEvent
	for _, ev := range aiTokenEventsLog {
		if !ev.Timestamp.Before(since) {
			out = append(out, ev)
		}
	}
	return out
}

// GetAITokenTotals returns a snapshot of cumulative token totals per (username, provider, model).
// The returned slice is a copy and safe to read after the call returns.
func GetAITokenTotals() []AITokenEntry {
	aiTokenTotalsMu.RLock()
	defer aiTokenTotalsMu.RUnlock()
	out := make([]AITokenEntry, 0, len(aiTokenTotals))
	for _, e := range aiTokenTotals {
		out = append(out, *e)
	}
	return out
}

// RegisterInternalMetrics must be called at startup to prepare the Prometheus scrape endpoint.
func RegisterInternalMetrics() {
	prometheus.MustRegister(
		Metrics.AICompletionTokensTotal,
		Metrics.AIPromptTokensTotal,
		Metrics.AITotalTokensTotal,
		Metrics.APIFailures,
		Metrics.APIProcessingTime,
		Metrics.AIRequestDurationSeconds,
		Metrics.AIRequestsTotal,
		Metrics.AIStoreConversationsTotal,
		Metrics.AIStoreEvictionsTotal,
		Metrics.CacheHitsTotal,
		Metrics.CacheRequestsTotal,
		Metrics.CheckerProcessingTime,
		Metrics.GraphAppenderTime,
		Metrics.GraphCacheEvictionsTotal,
		Metrics.GraphCacheHitsTotal,
		Metrics.GraphCacheMissesTotal,
		Metrics.GraphGenerationTime,
		Metrics.GraphMarshalTime,
		Metrics.GraphNodes,
		Metrics.HealthCacheHitsTotal,
		Metrics.HealthCacheMissesTotal,
		Metrics.HealthRefreshDuration,
		Metrics.HealthStatus,
		Metrics.KubernetesClients,
		Metrics.PrometheusProcessingTime,
		Metrics.SingleValidationProcessingTime,
		Metrics.TracingProcessingTime,
		Metrics.ValidationProcessingTime,
	)
}

//
// The following are utility functions that can be used to update the internal metrics.
//

// SetGraphNodes sets the node count metric
func SetGraphNodes(graphKind string, graphType string, withServiceNodes bool, nodeCount int) {
	Metrics.GraphNodes.With(prometheus.Labels{
		labelGraphKind:        graphKind,
		labelGraphType:        graphType,
		labelWithServiceNodes: strconv.FormatBool(withServiceNodes),
	}).Set(float64(nodeCount))
}

// GetGraphGenerationTimePrometheusTimer returns a timer that can be used to store
// a value for the graph generation time metric. The timer is ticking immediately
// when this function returns.
// Typical usage is as follows:
//
//	promtimer := GetGraphGenerationTimePrometheusTimer(...)
//	defer promtimer.ObserveDuration()
func GetGraphGenerationTimePrometheusTimer(graphKind string, graphType string, withServiceNodes bool) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.GraphGenerationTime.With(prometheus.Labels{
		labelGraphKind:        graphKind,
		labelGraphType:        graphType,
		labelWithServiceNodes: strconv.FormatBool(withServiceNodes),
	}))
	return timer
}

// GetGraphAppenderTimePrometheusTimer returns a timer that can be used to store
// a value for the graph appender time metric. The timer is ticking immediately
// when this function returns.
// Typical usage is as follows:
//
//	promtimer := GetGraphAppenderTimePrometheusTimer(...)
//	... run the appender ...
//	promtimer.ObserveDuration()
func GetGraphAppenderTimePrometheusTimer(appenderName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.GraphAppenderTime.With(prometheus.Labels{
		labelAppender: appenderName,
	}))
	return timer
}

// GetGraphMarshalTimePrometheusTimer returns a timer that can be used to store
// a value for the graph marshal time metric. The timer is ticking immediately
// when this function returns.
// Typical usage is as follows:
//
//	promtimer := GetGraphMarshalTimePrometheusTimer(...)
//	defer promtimer.ObserveDuration()
func GetGraphMarshalTimePrometheusTimer(graphKind string, graphType string, withServiceNodes bool) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.GraphMarshalTime.With(prometheus.Labels{
		labelGraphKind:        graphKind,
		labelGraphType:        graphType,
		labelWithServiceNodes: strconv.FormatBool(withServiceNodes),
	}))
	return timer
}

// GetAPIProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the API processing time metric. The timer is ticking immediately
// when this function returns.
// Typical usage is as follows:
//
//	promtimer := GetAPIProcessingTimePrometheusTimer(...)
//	defer promtimer.ObserveDuration()
func GetAPIProcessingTimePrometheusTimer(apiRouteName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.APIProcessingTime.With(prometheus.Labels{
		labelRoute: apiRouteName,
	}))
	return timer
}

// GetPrometheusProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the Prometheus query processing time metric. The timer is ticking immediately
// when this function returns.
//
// Note that the queryGroup parameter is simply some string that can be used to
// identify a particular set of Prometheus queries. This queryGroup does not necessarily have to
// identify a unique query (indeed, if you do that, that might cause too many timeseries to
// be collected), but it only needs to identify a set of queries. For example, perhaps there
// is a group of similar Prometheus queries used to generate a graph - in this case,
// the processing time for all of those queries can be combined into a single metric timeseries
// by passing in a queryGroup of "Graph-Generation".
//
// Typical usage is as follows:
//
//	promtimer := GetPrometheusProcessingTimePrometheusTimer(...)
//	... execute the query ...
//	promtimer.ObserveDuration()
func GetPrometheusProcessingTimePrometheusTimer(queryGroup string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.PrometheusProcessingTime.With(prometheus.Labels{
		labelQueryGroup: queryGroup,
	}))
	return timer
}

// GetCheckerProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the validation checker processing time metric. The timer is ticking immediately
// when this function returns.
//
// Typical usage is as follows:
//
//	promtimer := GetCheckerProcessingTimePrometheusTimer(...)
//	... execute the validation check ...
//	promtimer.ObserveDuration()
func GetCheckerProcessingTimePrometheusTimer(checkerName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.CheckerProcessingTime.With(prometheus.Labels{
		labelCheckerName: checkerName,
	}))
	return timer
}

// GetValidationProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the validation processing time metric (time to validate a namespace
// or service). The timer is ticking immediately when this function returns.
//
// When service is an empty string, it means this timer will track how long it took to validate
// all services within the namespace.
//
// Typical usage is as follows:
//
//	promtimer := GetValidationProcessingTimePrometheusTimer(...)
//	... execute the validation checks ...
//	promtimer.ObserveDuration()
func GetValidationProcessingTimePrometheusTimer(namespace string, service string) *prometheus.Timer {
	var labels prometheus.Labels
	if service != "" {
		labels = prometheus.Labels{
			labelNamespace: namespace,
			labelService:   service,
		}
	} else if namespace != "" {
		labels = prometheus.Labels{
			labelNamespace: namespace,
			labelService:   "_all_",
		}
	} else {
		labels = prometheus.Labels{
			labelNamespace: "_all_",
			labelService:   "_all_",
		}
	}
	timer := prometheus.NewTimer(Metrics.ValidationProcessingTime.With(labels))
	return timer
}

// GetSingleValidationProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the single validation processing time metric (time to validate a specific
// Istio object in a specific namespace. The timer is ticking immediately when this function returns.
//
// Typical usage is as follows:
//
//	promtimer := GetSingleValidationProcessingTimePrometheusTimer(...)
//	... execute the validation check ...
//	promtimer.ObserveDuration()
func GetSingleValidationProcessingTimePrometheusTimer(namespace string, objectType string, objectName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.SingleValidationProcessingTime.With(prometheus.Labels{
		labelNamespace: namespace,
		labelType:      objectType,
		labelName:      objectName,
	}))
	return timer
}

func GetAPIFailureMetric(route string) prometheus.Counter {
	return Metrics.APIFailures.With(prometheus.Labels{
		labelRoute: route,
	})
}

// SetKubernetesClients sets the kubernetes client count
func SetKubernetesClients(clientCount int) {
	Metrics.KubernetesClients.With(prometheus.Labels{}).Set(float64(clientCount))
}

func GetCacheRequestsTotalMetric(cache string) prometheus.Counter {
	return Metrics.CacheRequestsTotal.With(prometheus.Labels{
		labelName: cache,
	})
}

func GetCacheHitsTotalMetric(cache string) prometheus.Counter {
	return Metrics.CacheHitsTotal.With(prometheus.Labels{
		labelName: cache,
	})
}

func GetAIRequestsTotalMetric(provider string, model string) prometheus.Counter {
	return Metrics.AIRequestsTotal.With(prometheus.Labels{
		labelProvider: provider,
		labelModel:    model,
	})
}

func GetAIRequestDurationPrometheusTimer(provider string, model string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.AIRequestDurationSeconds.With(prometheus.Labels{
		labelProvider: provider,
		labelModel:    model,
	}))
	return timer
}

func SetAIStoreConversationsTotal(count int) {
	Metrics.AIStoreConversationsTotal.Set(float64(count))
}

func GetAIStoreEvictionsTotalMetric() prometheus.Counter {
	return Metrics.AIStoreEvictionsTotal
}

func GetGraphCacheHitsTotalMetric() prometheus.Counter {
	return Metrics.GraphCacheHitsTotal
}

func GetGraphCacheMissesTotalMetric() prometheus.Counter {
	return Metrics.GraphCacheMissesTotal
}

func GetGraphCacheEvictionsTotalMetric() prometheus.Counter {
	return Metrics.GraphCacheEvictionsTotal
}

// GetHealthCacheHitsTotalMetric returns the health cache hits counter vec.
func GetHealthCacheHitsTotalMetric() *prometheus.CounterVec {
	return Metrics.HealthCacheHitsTotal
}

// GetHealthCacheMissesTotalMetric returns the health cache misses counter vec.
func GetHealthCacheMissesTotalMetric() *prometheus.CounterVec {
	return Metrics.HealthCacheMissesTotal
}

// GetTracingProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the Tracing query processing time metric. The timer is ticking immediately
// when this function returns.
//
// Note that the queryGroup parameter is simply some string that can be used to
// identify a particular set of Tracing queries. This queryGroup does not necessarily have to
// identify a unique query (indeed, if you do that, that might cause too many timeseries to
// be collected), but it only needs to identify a set of queries.
//
// Typical usage is as follows:
//
//	promtimer := GetTracingProcessingTimePrometheusTimer(...)
//	... execute the query ...
//	promtimer.ObserveDuration()
func GetTracingProcessingTimePrometheusTimer(queryGroup string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.TracingProcessingTime.With(prometheus.Labels{
		labelQueryGroup: queryGroup,
	}))
	return timer
}

//
// Health metrics helper functions
//

// HealthType represents the type of health (app, service, workload, or namespace for all types)
type HealthType string

const (
	HealthTypeApp       HealthType = "app"
	HealthTypeNamespace HealthType = "namespace" // all types (app + service + workload)
	HealthTypeService   HealthType = "service"
	HealthTypeWorkload  HealthType = "workload"
)

// GetHealthRefreshDurationTimer returns a timer for measuring health refresh duration.
func GetHealthRefreshDurationTimer(cluster string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.HealthRefreshDuration.With(prometheus.Labels{
		labelCluster: cluster,
	}))
	return timer
}

// IncrementHealthCacheHits increments the health cache hits counter for a given type.
func IncrementHealthCacheHits(healthType HealthType) {
	Metrics.HealthCacheHitsTotal.With(prometheus.Labels{
		labelHealthType: string(healthType),
	}).Inc()
}

// IncrementHealthCacheMisses increments the health cache misses counter for a given type.
func IncrementHealthCacheMisses(healthType HealthType) {
	Metrics.HealthCacheMissesTotal.With(prometheus.Labels{
		labelHealthType: string(healthType),
	}).Inc()
}

// HealthStatusValue converts a health status string to a numeric value.
// Returns (value, ok) where ok is false for "NA" status (should not be exported).
// Value mapping: 0=Healthy (best), 1=Not Ready, 2=Degraded, 3=Failure (worst).
func HealthStatusValue(status string) (float64, bool) {
	switch status {
	case "Healthy":
		return 0.0, true
	case "Not Ready":
		return 1.0, true
	case "Degraded":
		return 2.0, true
	case "Failure":
		return 3.0, true
	case "NA":
		return 0.0, false
	default:
		// Unknown status treated as NA
		return 0.0, false
	}
}

// SetHealthStatusForItem sets the health status gauge for an individual item.
// Only call this when status is not NA (check with HealthStatusValue first).
func SetHealthStatusForItem(cluster, namespace string, healthType HealthType, name string, value float64) {
	Metrics.HealthStatus.With(prometheus.Labels{
		labelCluster:    cluster,
		labelNamespace:  namespace,
		labelHealthType: string(healthType),
		labelName:       name,
	}).Set(value)
}

// DeleteHealthStatusForItem deletes the health status gauge for an individual item.
// Call this when an entity should no longer be tracked.
func DeleteHealthStatusForItem(cluster, namespace string, healthType HealthType, name string) {
	Metrics.HealthStatus.Delete(prometheus.Labels{
		labelCluster:    cluster,
		labelNamespace:  namespace,
		labelHealthType: string(healthType),
		labelName:       name,
	})
}

// GetHealthStatusMetric returns the health status gauge vec.
func GetHealthStatusMetric() *prometheus.GaugeVec {
	return Metrics.HealthStatus
}

// RecordAITokens increments the three token counters for a single AI response.
// All three counters share the same {username, ai_provider, ai_model} label set so
// that charts can be sliced and aggregated by any combination of those dimensions.
// Counters with a zero value are skipped to avoid creating unused label sets.
// The call also updates the in-memory totals map and event log used by the usage summary API.
func RecordAITokens(username, provider, model string, promptTokens, completionTokens, totalTokens int64) {
	labels := prometheus.Labels{
		labelModel:    model,
		labelProvider: provider,
		labelUsername: username,
	}
	if promptTokens > 0 {
		Metrics.AIPromptTokensTotal.With(labels).Add(float64(promptTokens))
	}
	if completionTokens > 0 {
		Metrics.AICompletionTokensTotal.With(labels).Add(float64(completionTokens))
	}
	if totalTokens > 0 {
		Metrics.AITotalTokensTotal.With(labels).Add(float64(totalTokens))
	}

	// Update cumulative totals used by the usage summary API.
	key := username + "\x00" + provider + "\x00" + model
	aiTokenTotalsMu.Lock()
	entry, ok := aiTokenTotals[key]
	if !ok {
		entry = &AITokenEntry{Model: model, Provider: provider, Username: username}
		aiTokenTotals[key] = entry
	}
	entry.CompletionTokens += completionTokens
	entry.PromptTokens += promptTokens
	entry.TotalTokens += totalTokens

	// Prune the map when it exceeds the cap to prevent unbounded growth with many
	// unique users. Remove the 25 % of entries with the smallest total-token count
	// (least-active users) so the most significant data is retained.
	if len(aiTokenTotals) > maxAITokenTotals {
		pruneAITokenTotals()
	}
	aiTokenTotalsMu.Unlock()

	// Append to the time-series event log.
	aiTokenEventsMu.Lock()
	aiTokenEventsLog = append(aiTokenEventsLog, AITokenEvent{
		CompletionTokens: completionTokens,
		Model:            model,
		PromptTokens:     promptTokens,
		Provider:         provider,
		Timestamp:        time.Now(),
		TotalTokens:      totalTokens,
		Username:         username,
	})

	// Primary retention: drop events older than maxAITokenEventAge so the
	// time-series window is always predictable, regardless of traffic volume.
	// Events are appended in chronological order, so a binary search gives an
	// O(log n) fast-path: if the oldest event is still within the TTL, no work
	// is done at all.
	if len(aiTokenEventsLog) > 0 {
		cutoff := time.Now().Add(-maxAITokenEventAge)
		if aiTokenEventsLog[0].Timestamp.Before(cutoff) {
			i := sort.Search(len(aiTokenEventsLog), func(j int) bool {
				return !aiTokenEventsLog[j].Timestamp.Before(cutoff)
			})
			trimmed := make([]AITokenEvent, len(aiTokenEventsLog)-i)
			copy(trimmed, aiTokenEventsLog[i:])
			aiTokenEventsLog = trimmed
		}
	}

	// Safety cap: guards against extreme bursts where the TTL window alone
	// would hold more events than maxAITokenEvents. Drop from the front
	// (oldest first) to keep the most recent data.
	if len(aiTokenEventsLog) > maxAITokenEvents {
		keep := aiTokenEventsLog[len(aiTokenEventsLog)-maxAITokenEvents:]
		trimmed := make([]AITokenEvent, maxAITokenEvents)
		copy(trimmed, keep)
		aiTokenEventsLog = trimmed
	}
	aiTokenEventsMu.Unlock()
}

// MarkAITokensSeedingComplete signals that seeding has finished (or will not
// happen). Safe to call multiple times; the channel is closed exactly once.
func MarkAITokensSeedingComplete() {
	aiTokensSeedingComplete.Store(true)
	aiTokensSeedingCloseOnce.Do(func() { close(aiTokensSeedingDoneCh) })
}

// WaitForAITokensSeedingComplete blocks until seeding is done, the context is
// cancelled, or the timeout elapses — whichever comes first. Callers should
// check IsAITokensSeedingComplete() after returning if they need to distinguish
// a clean completion from a timeout.
func WaitForAITokensSeedingComplete(ctx context.Context, timeout time.Duration) {
	if aiTokensSeedingComplete.Load() {
		return
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-aiTokensSeedingDoneCh:
	case <-timer.C:
	case <-ctx.Done():
	}
}

// InitAITokensFromPrometheus seeds the in-memory AI token totals map and event
// log by querying the external Prometheus server. It is intended to be called
// once at startup (in a background goroutine) after the Prometheus client has
// connected, so that statistics survive a Kiali restart.
//
// The function is best-effort: any query errors are logged and the in-memory
// state is left unchanged for the affected keys. It is safe to call from a
// single goroutine; no internal locking is performed beyond the existing map
// and event-log mutexes.
func InitAITokensFromPrometheus(ctx context.Context, api prom_v1.API) {
	defer MarkAITokensSeedingComplete()
	if api == nil {
		return
	}
	log.Info("Seeding AI token statistics from Prometheus")
	seedAITokenTotalsFromPrometheus(ctx, api)
	seedAITokenEventsFromPrometheus(ctx, api)
	seedAITokenOrphanEventsFromTotals(time.Now().Truncate(aiTokenSeedStep))
	log.Info("AI token statistics seeded from Prometheus")
}

// promDurationStr converts a time.Duration to a Prometheus-compatible duration
// string (e.g. 1h, 30m, 45s). Only whole hours, minutes, or seconds are
// supported; sub-second durations are rounded up to one second.
func promDurationStr(d time.Duration) string {
	if h := int64(d / time.Hour); h > 0 && d%time.Hour == 0 {
		return fmt.Sprintf("%dh", h)
	}
	if m := int64(d / time.Minute); m > 0 && d%time.Minute == 0 {
		return fmt.Sprintf("%dm", m)
	}
	s := int64(d / time.Second)
	if s < 1 {
		s = 1
	}
	return fmt.Sprintf("%ds", s)
}

// seedAITokenTotalsFromPrometheus queries the three AI token counter metrics
// from Prometheus and merges the results into the in-memory totals map.
// For each (username, provider, model) key, the stored value is updated to
// max(current in-memory value, Prometheus value) so that neither post-restart
// events nor historical data are discarded.
func seedAITokenTotalsFromPrometheus(ctx context.Context, api prom_v1.API) {
	type sample struct {
		completion float64
		prompt     float64
		total      float64
	}
	data := map[string]*sample{}

	// Use max_over_time over the full retention window instead of a plain instant
	// query. After a pod restart, CounterVec series are absent from the /metrics
	// endpoint until the first .With(labels).Add(v) call, so a plain instant query
	// would find nothing. max_over_time looks back through stored samples and
	// returns the peak value per label set, which is the pre-restart total.
	retention := promDurationStr(maxAITokenEventAge)
	queryInstant := func(metricName string) model.Vector {
		query := fmt.Sprintf("max_over_time(%s[%s])", metricName, retention)
		result, warnings, err := api.Query(ctx, query, time.Now())
		if len(warnings) > 0 {
			log.Warningf("InitAITokensFromPrometheus: warnings querying %s: %v", metricName, warnings)
		}
		if err != nil {
			log.Warningf("InitAITokensFromPrometheus: error querying %s: %v", metricName, err)
			return nil
		}
		vec, ok := result.(model.Vector)
		if !ok {
			return nil
		}
		return vec
	}

	extractKey := func(metric model.Metric) string {
		username := string(metric[model.LabelName(labelUsername)])
		provider := string(metric[model.LabelName(labelProvider)])
		aiModel := string(metric[model.LabelName(labelModel)])
		return username + "\x00" + provider + "\x00" + aiModel
	}

	for _, s := range queryInstant("kiali_ai_total_tokens_total") {
		key := extractKey(s.Metric)
		if data[key] == nil {
			data[key] = &sample{}
		}
		data[key].total = float64(s.Value)
	}
	for _, s := range queryInstant("kiali_ai_prompt_tokens_total") {
		key := extractKey(s.Metric)
		if data[key] == nil {
			data[key] = &sample{}
		}
		data[key].prompt = float64(s.Value)
	}
	for _, s := range queryInstant("kiali_ai_completion_tokens_total") {
		key := extractKey(s.Metric)
		if data[key] == nil {
			data[key] = &sample{}
		}
		data[key].completion = float64(s.Value)
	}

	if len(data) == 0 {
		return
	}

	aiTokenTotalsMu.Lock()
	defer aiTokenTotalsMu.Unlock()
	for key, d := range data {
		parts := strings.SplitN(key, "\x00", 3)
		if len(parts) != 3 {
			continue
		}
		entry, exists := aiTokenTotals[key]
		if !exists {
			entry = &AITokenEntry{
				Model:    parts[2],
				Provider: parts[1],
				Username: parts[0],
			}
			aiTokenTotals[key] = entry
		}

		// Warm up the in-process Prometheus counters with the delta between
		// what has already been recorded since this restart and the historical
		// peak. This makes the CounterVec time series visible at the /metrics
		// endpoint immediately (they only appear after at least one .Add call),
		// and ensures the scraped value looks continuous to Prometheus.
		// Adding the delta (not the full value) avoids double-counting tokens
		// that were already recorded via RecordAITokens since the pod started.
		labels := prometheus.Labels{
			labelModel:    parts[2],
			labelProvider: parts[1],
			labelUsername: parts[0],
		}
		if v := int64(math.Round(d.total)); v > entry.TotalTokens {
			Metrics.AITotalTokensTotal.With(labels).Add(float64(v - entry.TotalTokens))
			entry.TotalTokens = v
		}
		if v := int64(math.Round(d.prompt)); v > entry.PromptTokens {
			Metrics.AIPromptTokensTotal.With(labels).Add(float64(v - entry.PromptTokens))
			entry.PromptTokens = v
		}
		if v := int64(math.Round(d.completion)); v > entry.CompletionTokens {
			Metrics.AICompletionTokensTotal.With(labels).Add(float64(v - entry.CompletionTokens))
			entry.CompletionTokens = v
		}
	}
	if len(aiTokenTotals) > maxAITokenTotals {
		pruneAITokenTotals()
	}
}

// seedAITokenEventsFromPrometheus reconstructs a synthetic event log from
// Prometheus range data covering the maxAITokenEventAge retention window.
// Each synthetic event represents the token increase within one aiTokenSeedStep
// interval and carries the same label dimensions as the real events. Synthetic
// events are prepended to the existing in-memory log so that real events
// recorded since startup are preserved.
func seedAITokenEventsFromPrometheus(ctx context.Context, api prom_v1.API) {
	now := time.Now()
	windowStart := now.Add(-maxAITokenEventAge).Truncate(aiTokenSeedStep)
	windowEnd := now.Truncate(aiTokenSeedStep)

	if !windowStart.Before(windowEnd) {
		return
	}

	// If the in-memory log already starts before the window we would query,
	// there is no historical gap to fill.
	aiTokenEventsMu.RLock()
	if len(aiTokenEventsLog) > 0 && !aiTokenEventsLog[0].Timestamp.After(windowStart) {
		aiTokenEventsMu.RUnlock()
		return
	}
	aiTokenEventsMu.RUnlock()

	rangeParams := prom_v1.Range{
		End:   windowEnd,
		Start: windowStart,
		Step:  aiTokenSeedStep,
	}
	stepStr := promDurationStr(aiTokenSeedStep)

	type eventKey struct {
		aiModel  string
		provider string
		ts       time.Time
		username string
	}
	type eventData struct {
		completion float64
		prompt     float64
		total      float64
	}
	merged := map[eventKey]*eventData{}

	queryRange := func(metricName string) model.Matrix {
		query := fmt.Sprintf("increase(%s[%s])", metricName, stepStr)
		result, warnings, err := api.QueryRange(ctx, query, rangeParams)
		if len(warnings) > 0 {
			log.Warningf("InitAITokensFromPrometheus: warnings querying %s range: %v", metricName, warnings)
		}
		if err != nil {
			log.Warningf("InitAITokensFromPrometheus: error querying %s range: %v", metricName, err)
			return nil
		}
		mat, ok := result.(model.Matrix)
		if !ok {
			return nil
		}
		return mat
	}

	for _, series := range queryRange("kiali_ai_total_tokens_total") {
		username := string(series.Metric[model.LabelName(labelUsername)])
		provider := string(series.Metric[model.LabelName(labelProvider)])
		aiModel := string(series.Metric[model.LabelName(labelModel)])
		for _, point := range series.Values {
			if point.Value <= 0 {
				continue
			}
			k := eventKey{aiModel: aiModel, provider: provider, ts: point.Timestamp.Time(), username: username}
			if merged[k] == nil {
				merged[k] = &eventData{}
			}
			merged[k].total = float64(point.Value)
		}
	}
	for _, series := range queryRange("kiali_ai_prompt_tokens_total") {
		username := string(series.Metric[model.LabelName(labelUsername)])
		provider := string(series.Metric[model.LabelName(labelProvider)])
		aiModel := string(series.Metric[model.LabelName(labelModel)])
		for _, point := range series.Values {
			if point.Value <= 0 {
				continue
			}
			k := eventKey{aiModel: aiModel, provider: provider, ts: point.Timestamp.Time(), username: username}
			if merged[k] == nil {
				merged[k] = &eventData{}
			}
			merged[k].prompt = float64(point.Value)
		}
	}
	for _, series := range queryRange("kiali_ai_completion_tokens_total") {
		username := string(series.Metric[model.LabelName(labelUsername)])
		provider := string(series.Metric[model.LabelName(labelProvider)])
		aiModel := string(series.Metric[model.LabelName(labelModel)])
		for _, point := range series.Values {
			if point.Value <= 0 {
				continue
			}
			k := eventKey{aiModel: aiModel, provider: provider, ts: point.Timestamp.Time(), username: username}
			if merged[k] == nil {
				merged[k] = &eventData{}
			}
			merged[k].completion = float64(point.Value)
		}
	}

	if len(merged) == 0 {
		return
	}

	synthetic := make([]AITokenEvent, 0, len(merged))
	for k, d := range merged {
		synthetic = append(synthetic, AITokenEvent{
			CompletionTokens: int64(math.Round(d.completion)),
			Model:            k.aiModel,
			PromptTokens:     int64(math.Round(d.prompt)),
			Provider:         k.provider,
			Timestamp:        k.ts,
			TotalTokens:      int64(math.Round(d.total)),
			Username:         k.username,
		})
	}
	sort.Slice(synthetic, func(i, j int) bool {
		return synthetic[i].Timestamp.Before(synthetic[j].Timestamp)
	})

	aiTokenEventsMu.Lock()
	defer aiTokenEventsMu.Unlock()
	// Preserve real in-memory events whose timestamps fall after the seed window
	// to avoid double-counting the partial hour since the last restart.
	var tail []AITokenEvent
	for _, ev := range aiTokenEventsLog {
		if !ev.Timestamp.Before(windowEnd) {
			tail = append(tail, ev)
		}
	}
	combined := make([]AITokenEvent, 0, len(synthetic)+len(tail))
	combined = append(combined, synthetic...)
	combined = append(combined, tail...)
	aiTokenEventsLog = combined
}

// seedAITokenOrphanEventsFromTotals creates a single synthetic AITokenEvent for
// each entry in aiTokenTotals that has a non-zero total but no corresponding
// event in aiTokenEventsLog. This handles the case where a Prometheus counter
// appeared at a non-zero value (e.g. first scrape after a restart with a seeded
// value), so increase() returned 0 and seedAITokenEventsFromPrometheus produced
// no events for it. The synthetic event is placed at windowEnd so the series
// appears in the most recent complete bucket of the time-series chart.
func seedAITokenOrphanEventsFromTotals(windowEnd time.Time) {
	aiTokenTotalsMu.RLock()
	snapshot := make([]AITokenEntry, 0, len(aiTokenTotals))
	for _, e := range aiTokenTotals {
		if e.TotalTokens > 0 {
			snapshot = append(snapshot, *e)
		}
	}
	aiTokenTotalsMu.RUnlock()

	if len(snapshot) == 0 {
		return
	}

	aiTokenEventsMu.Lock()
	defer aiTokenEventsMu.Unlock()

	type eventKey struct {
		model    string
		provider string
		username string
	}
	hasEvent := make(map[eventKey]bool, len(aiTokenEventsLog))
	for _, ev := range aiTokenEventsLog {
		hasEvent[eventKey{model: ev.Model, provider: ev.Provider, username: ev.Username}] = true
	}

	var orphans []AITokenEvent
	for _, e := range snapshot {
		if !hasEvent[eventKey{model: e.Model, provider: e.Provider, username: e.Username}] {
			orphans = append(orphans, AITokenEvent{
				CompletionTokens: e.CompletionTokens,
				Model:            e.Model,
				PromptTokens:     e.PromptTokens,
				Provider:         e.Provider,
				Timestamp:        windowEnd,
				TotalTokens:      e.TotalTokens,
				Username:         e.Username,
			})
		}
	}

	if len(orphans) == 0 {
		return
	}

	log.Infof("InitAITokensFromPrometheus: adding %d synthetic events for series with totals but no time-series data", len(orphans))
	combined := make([]AITokenEvent, 0, len(aiTokenEventsLog)+len(orphans))
	combined = append(combined, aiTokenEventsLog...)
	combined = append(combined, orphans...)
	aiTokenEventsLog = combined
}
