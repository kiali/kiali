package internalmetrics

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	// GRAPH_KIND_NAMESPACE is a main graph showing everything in namespace(s)
	GRAPH_KIND_NAMESPACE string = "namespace"
	// GRAPH_KIND_NODE is a "drilled down" graph that is focused on a particular node
	GRAPH_KIND_NODE string = "node"
)

// These constants define the different label names for the different metric timeseries
const (
	labelGraphKind        = "graph_kind"
	labelGraphType        = "graph_type"
	labelWithServiceNodes = "with_service_nodes"
	labelAppender         = "appender"
	labelName             = "name"
	labelQueryID          = "query_id"
)

// MetricsType defines all of Kiali's own internal metrics.
type MetricsType struct {
	GraphsGenerated          *prometheus.CounterVec
	GraphNodes               *prometheus.GaugeVec
	GraphGenerationTime      *prometheus.SummaryVec
	GraphAppenderTime        *prometheus.SummaryVec
	APIProcessingTime        *prometheus.SummaryVec
	PrometheusProcessingTime *prometheus.SummaryVec
}

// Metrics contains all of Kiali's own internal metrics.
// These metrics can be accessed directly to update their values, or
// you can use available utility functions defined below.
var Metrics = MetricsType{
	GraphsGenerated: prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kiali_graphs_generated_total",
			Help: "The total number of graphs Kiali has generated.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	GraphNodes: prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "kiali_graph_nodes",
			Help: "The number of nodes in a generated graph.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	GraphGenerationTime: prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name: "kiali_graph_generation_duration_seconds",
			Help: "The time required to generate a graph.",
		},
		[]string{labelGraphKind, labelGraphType, labelWithServiceNodes},
	),
	GraphAppenderTime: prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name: "kiali_graph_appender_duration_seconds",
			Help: "The time required to execute an appender while generating a graph.",
		},
		[]string{labelAppender},
	),
	APIProcessingTime: prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name: "kiali_api_processing_duration_seconds",
			Help: "The time required to execute an API request.",
		},
		[]string{labelName},
	),
	PrometheusProcessingTime: prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name: "kiali_prometheus_processing_duration_seconds",
			Help: "The time required to execute a Prometheus query.",
		},
		[]string{labelQueryID},
	),
}

// RegisterInternalMetrics must be called at startup to prepare the Prometheus scrape endpoint.
func RegisterInternalMetrics() {
	prometheus.MustRegister(
		Metrics.GraphsGenerated,
		Metrics.GraphNodes,
		Metrics.GraphGenerationTime,
		Metrics.GraphAppenderTime,
		Metrics.APIProcessingTime,
		Metrics.PrometheusProcessingTime,
	)
}

//
// The following are utility functions that can be used to update the internal metrics.
//

// IncrementGraphsGenerated increments the counter for the given graph type
func IncrementGraphsGenerated(graphKind string, graphType string, withServiceNodes bool) {
	Metrics.GraphsGenerated.With(prometheus.Labels{
		labelGraphKind:        graphKind,
		labelGraphType:        graphType,
		labelWithServiceNodes: strconv.FormatBool(withServiceNodes),
	}).Inc()
}

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
//    promtimer := GetGraphGenerationTimePrometheusTimer(...)
//    defer promtimer.ObserveDuration()
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
//    promtimer := GetGraphAppenderTimePrometheusTimer(...)
//    ... run the appender ...
//    promtimer.ObserveDuration()
func GetGraphAppenderTimePrometheusTimer(appenderName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.GraphAppenderTime.With(prometheus.Labels{
		labelAppender: appenderName,
	}))
	return timer
}

// GetAPIProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the API processing time metric. The timer is ticking immediately
// when this function returns.
// Typical usage is as follows:
//    promtimer := GetAPIProcessingTimePrometheusTimer(...)
//    defer promtimer.ObserveDuration()
func GetAPIProcessingTimePrometheusTimer(apiName string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.APIProcessingTime.With(prometheus.Labels{
		labelName: apiName,
	}))
	return timer
}

// GetPrometheusProcessingTimePrometheusTimer returns a timer that can be used to store
// a value for the Prometheus query processing time metric. The timer is ticking immediately
// when this function returns.
//
// Note that the queryID parameter is simply some string that can be used to
// identify a particular set of Prometheus queries. This queryID does not necessarily have to
// identify a unique query (indeed, if you do that, that might cause too many timeseries to
// be collected), but it only needs to identify a set of queries. For example, perhaps there
// are a series of similar Prometheus queries used to generate a graph - in this case,
// the processing time for all of those queries can be combined into a single metric timeseries
// by passing in a queryID of "graph-generation".
//
// Typical usage is as follows:
//    promtimer := GetPrometheusProcessingTimePrometheusTimer(...)
//    ... execute the query ...
//    promtimer.ObserveDuration()
func GetPrometheusProcessingTimePrometheusTimer(queryID string) *prometheus.Timer {
	timer := prometheus.NewTimer(Metrics.PrometheusProcessingTime.With(prometheus.Labels{
		labelQueryID: queryID,
	}))
	return timer
}
