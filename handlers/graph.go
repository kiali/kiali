package handlers

// Graph.go provides handlers for graph request endpoints.   The handlers access vendor-specific
// telemetry (default istio) and return vendor-specific configuration. The configuration format
// depends on the vendor but is typically JSON and provides what is necessary to allow the vendor's
// tool to render the graph.
//
// The algorithm is two-phased:
//   Phase One: Generate a TrafficMap using the requested TelemetryVendor. This typically queries
//              Prometheus, Istio and Kubernetes.
//
//   Phase Two: Provide the TrafficMap to the requested ConfigVendor which returns the vendor-specific
//              configuration returned to the caller.
//
// The current Handlers:
//   GraphNamespaces: Generate a graph for one or more requested namespaces.
//   GraphNode:       Generate a graph for a specific node, detailing the immediate incoming and outgoing traffic.
//
// The handlers accept the following query parameters (see notes below)
//   appenders:       Comma-separated list of TelemetryVendor-specific appenders to run. (default: all)
//   configVendor:    default: common
//   duration:        time.Duration indicating desired query range duration, (default: 10m)
//   graphType:       Determines how to present the telemetry data. app | service | versionedApp | workload (default: workload)
//   boxBy:           If supported by vendor, visually box by a specified node attribute (default: none)
//   namespaces:      Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:       Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   TelemetryVendor: default: istio
//
//  Note: some handlers may ignore some query parameters.
//  Note: vendors may support additional, vendor-specific query parameters.
//
import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// GraphNamespaces is a REST http.HandlerFunc handling graph generation for 1 or more namespaces

func GraphNamespaces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		graph.CheckError(err)

		o := graph.NewOptions(r, &business.Namespace)

		code, payload := api.GraphNamespaces(r.Context(), business, o)
		respond(w, code, payload)
	}
}

// GraphNode is a REST http.HandlerFunc handling node-detail graph config generation.
func GraphNode(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		graph.CheckError(err)

		o := graph.NewOptions(r, &business.Namespace)

		code, payload := api.GraphNode(r.Context(), business, o)
		respond(w, code, payload)
	}
}

func handlePanic(w http.ResponseWriter) {
	code := http.StatusInternalServerError
	if r := recover(); r != nil {
		var message string
		switch err := r.(type) {
		case string:
			message = err
		case error:
			message = err.Error()
		case func() string:
			message = err()
		case graph.Response:
			message = err.Message
			code = err.Code
		default:
			message = fmt.Sprintf("%v", r)
		}
		if code == http.StatusInternalServerError {
			stack := debug.Stack()
			log.Errorf("%s: %s", message, stack)
			RespondWithDetailedError(w, code, message, "Stack trace available in Kiali logs")
			return
		}
		RespondWithError(w, code, message)
	}
}

func respond(w http.ResponseWriter, code int, payload interface{}) {
	if code == http.StatusOK {
		RespondWithJSONIndent(w, code, payload)
		return
	}
	if code == http.StatusForbidden {
		message := ""
		if payload != nil {
			message = payload.(string)
		}
		RespondWithJSON(w, code, message)
		return
	}
	RespondWithError(w, code, payload.(string))
}
