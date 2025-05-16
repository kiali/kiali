// Package internalmetrics provides functionality to collect Prometheus metrics.
package internalmetrics

import (
	// Because this package is used all throughout the codebase, be VERY careful adding new
	// kiali imports here. Most likely you will encounter an import cycle error that will
	// cause a compilation failure.
	"context"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/kiali/kiali/log"
)

// These constants define the different label names for the different metric timeseries
const (
	labelGraphKind        = "graph_kind"
	labelGraphType        = "graph_type"
	labelWithServiceNodes = "with_service_nodes"
	labelAppender         = "appender"
	labelRoute            = "route"
	labelQueryGroup       = "query_group"
	labelCheckerName      = "checker"
	labelNamespace        = "namespace"
	labelService          = "service"
	labelType             = "type"
	labelName             = "name"
)

// MetricsType defines all of Kiali's own internal metrics.
type MetricsType struct {
	APIFailures                    *prometheus.CounterVec
	APIProcessingTime              *prometheus.HistogramVec
	CheckerProcessingTime          *prometheus.HistogramVec
	GraphAppenderTime              *prometheus.HistogramVec
	GraphGenerationTime            *prometheus.HistogramVec
	GraphMarshalTime               *prometheus.HistogramVec
	GraphNodes                     *prometheus.GaugeVec
	KubernetesClients              *prometheus.GaugeVec
	PrometheusProcessingTime       *prometheus.HistogramVec
	SingleValidationProcessingTime *prometheus.HistogramVec
	CacheTotalRequests             *prometheus.CounterVec
	CacheHitsTotal                 *prometheus.CounterVec
	ValidationProcessingTime       *prometheus.HistogramVec
	TracingProcessingTime          *prometheus.HistogramVec
}

// Metrics contains all of Kiali's own internal metrics.
// These metrics can be accessed directly to update their values, or
// you can use available utility functions defined below.
var Metrics = MetricsType{
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
	CacheTotalRequests: prometheus.NewCounterVec(
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
func ObserveDurationAndLogResults(ctx context.Context, timer *prometheus.Timer, timerName string, data map[string]string, msg string) {
	duration := timer.ObserveDuration()

	// get the logger from context and start a trace message
	zl := log.FromContext(ctx).Trace()

	// add the given structured data if there is any
	if len(data) > 0 {
		for k, v := range data {
			zl = zl.Str(k, v)
		}
	}

	// log the message
	zl.
		Str("timer", timerName).
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

// RegisterInternalMetrics must be called at startup to prepare the Prometheus scrape endpoint.
func RegisterInternalMetrics() {
	prometheus.MustRegister(
		Metrics.GraphNodes,
		Metrics.GraphGenerationTime,
		Metrics.GraphAppenderTime,
		Metrics.GraphMarshalTime,
		Metrics.APIProcessingTime,
		Metrics.PrometheusProcessingTime,
		Metrics.KubernetesClients,
		Metrics.APIFailures,
		Metrics.CheckerProcessingTime,
		Metrics.ValidationProcessingTime,
		Metrics.SingleValidationProcessingTime,
		Metrics.CacheTotalRequests,
		Metrics.CacheHitsTotal,
		Metrics.TracingProcessingTime,
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
	return Metrics.CacheTotalRequests.With(prometheus.Labels{
		labelName: cache,
	})
}

func GetCacheHitsTotalMetric(cache string) prometheus.Counter {
	return Metrics.CacheHitsTotal.With(prometheus.Labels{
		labelName: cache,
	})
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
