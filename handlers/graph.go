package handlers

// Graph.go provides handlers for graph request endpoints.   The handlers return configuration
// for a specified vendor (default cytoscape).  The configuration format is vendor-specific, typically
// JSON, and provides what is necessary to allow the vendor's graphing tool to render the graph.
//
// The algorithm is three-pass:
//   First Pass: Query Prometheus (istio-requests-total metric) to retrieve the source-destination
//               dependencies. Build a traffic map to provide a full representation of nodes and edges.
//
//   Second Pass: Apply any requested appenders to alter or append to the graph.
//
//   Third Pass: Supply the traffic map to a vendor-specific config generator that
//               constructs the vendor-specific output.
//
// The current Handlers:
//   GraphNamespace:  Generate a graph for all services in a namespace (whether source or destination)
//   GraphNode:       Generate a graph centered on a specified node, limited to requesting and requested nodes.
//
// The handlers accept the following query parameters (some handlers may ignore some parameters):
//   appenders:      Comma-separated list of appenders to run from [circuit_breaker, unused_service...] (default all)
//                   Note, appenders may support appender-specific query parameters
//   duration:       time.Duration indicating desired query range duration, (default 10m)
//   graphType:      Determines how to present the telemetry data. app | service | versionedApp | workload (default workload)
//   groupBy:        If supported by vendor, visually group by a specified node attribute (default version)
//   includeIstio:   Include istio-system (infra) services (default false)
//   namespaces:     Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:      Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   vendor:         cytoscape (default cytoscape)
//
// * Error% is the percentage of requests with response code != 2XX
// * See the vendor-specific config generators for more details about the specific vendor.
//
import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/telemetry/istio"
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
	o := options.NewOptions(r)

	business, err := getBusiness(r)
	graph.CheckError(err)

	code, payload := istio.GraphNamespaces(business, client, o)
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
	o := options.NewOptions(r)

	business, err := getBusiness(r)
	graph.CheckError(err)

	code, payload := istio.GraphNode(business, client, o)
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
