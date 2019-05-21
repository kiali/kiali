package handlers

// Graph.go provides handlers for graph request endpoints.   The handlers access vendor-specific
// telemetry (default istio) and return vendor-specific configuration (default cytoscape). The
// configuration format depends on the vendor but is typically JSON and provides what is necessary
// to allow the vendor's tool to render the graph.
//
// The algorithm is two-phased:
//   Phase One: Generate a TrafficMap using the requested TelemetryVendor. This typically queries
//              Prometheus, Istio and Kubernetes.
//
//   Phase Two: Provide the TrafficMap to the requested ConfigVendor which returns the vendor-specific
//              configuration retuened to the caller.
//
// The current Handlers:
//   GraphNamespaces: Generate a graph for one or more requested namespaces.
//   GraphNode:       Generate a graph for a specific node, detailing the immediate incoming and outgoing traffic.
//
// The handlers accept the following query parameters (see notes below)
//   appenders:       Comma-separated list of TelemetryVendor-specific appenders to run. (default: all)
//   configVendor:    default: cytoscape
//   duration:        time.Duration indicating desired query range duration, (default: 10m)
//   graphType:       Determines how to present the telemetry data. app | service | versionedApp | workload (default: workload)
//   groupBy:         If supported by vendor, visually group by a specified node attribute (default: version)
//   includeIstio:    Include istio-system (infra) services (default false)
//   namespaces:      Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:       Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   TelemetryVendor: default: istio
//   vendor:          Deprecated: use configVendor
//
//  Note: some handlers may ignore some query parameters.
//  Note: vendors may support additional, vendor-specific query parameters.
//
import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// GraphNamespaces is a REST http.HandlerFunc handling graph generation for 1 or more namespaces
func GraphNamespaces(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)
	client, err := prometheus.NewClient()
	graph.CheckError(err)

	graphNamespaces(w, r, client)
}

// graphNamespaces provides a testing hook that can supply a mock client
func graphNamespaces(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := graph.NewOptions(r)

	business, err := getBusiness(r)
	graph.CheckError(err)

	code, payload := api.GraphNamespaces(business, client, o)
	respond(w, code, payload)
}

// GraphNode is a REST http.HandlerFunc handling node-detail graph config generation.
func GraphNode(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	graph.CheckError(err)

	graphNode(w, r, client)
}

// graphNode provides a testing hook that can supply a mock client
func graphNode(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := graph.NewOptions(r)

	business, err := getBusiness(r)
	graph.CheckError(err)

	code, payload := api.GraphNode(business, client, o)
	respond(w, code, payload)
}

func handlePanic(w http.ResponseWriter) {
	code := http.StatusInternalServerError
	if r := recover(); r != nil {
		var message string
		switch r.(type) {
		case string:
			message = r.(string)
		case error:
			message = r.(error).Error()
		case func() string:
			message = r.(func() string)()
		case graph.Response:
			message = r.(graph.Response).Message
			code = r.(graph.Response).Code
		default:
			message = fmt.Sprintf("%v", r)
		}
		if code == http.StatusInternalServerError {
			log.Errorf("%s: %s", message, debug.Stack())
		}
		RespondWithError(w, code, message)
	}
}

func respond(w http.ResponseWriter, code int, payload interface{}) {
	if code == http.StatusOK {
		RespondWithJSONIndent(w, code, payload)
	} else {
		RespondWithError(w, code, payload.(string))
	}
}
