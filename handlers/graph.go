package handlers

// Graph.go provides handlers for service-graph request endpoints.   The handlers return configuration
// for a specified vendor (default cytoscape).  The configuration format is vendor-specific, typically
// JSON, and provides what is necessary to allow the vendor's graphing tool to render the service graph.
//
// The algorithm is three-pass:
//   First Pass: Query Prometheus (istio-request-count metric) to retrieve the source-destination
//               service dependencies. Build a traffic map to provide a full representation of nodes
//               and edges.
//
//   Second Pass: Apply any requested appenders to append information to the graph.
//
//   Third Pass: Supply the traffic map to a vendor-specific config generator that
//               constructs the vendor-specific output.
//
// The current Handlers:
//   GraphNamespace:  Generate a graph for all services in a namespace (whether source or destination)
//   GraphService:    Generate a graph centered on versions of a specified service, limited to
//                    requesting and requested services.
//
// The handlers accept the following query parameters (some handlers may ignore some parameters):
//   appenders:      Comma-separated list of appenders to run from [circuit_breaker, unused_service] (default all)
//                   Note, appenders may support appender-specific query parameters
//   duration:       time.Duration indicating desired query range duration, (default 10m)
//   groupByVersion: If supported by vendor, visually group versions of the same service (default true)
//   includeIstio:   Include istio-system (infra) services (default false)
//   metric:         Prometheus metric name to be used to generate the dependency graph (default istio_request_count)
//   namespaces:     Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:      Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   vendor:         cytoscape | vizceral (default cytoscape)
//
// * Error% is the percentage of requests with response code != 2XX
// * See the vendor-specific config generators for more details about the specific vendor.
//
import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/cytoscape"
	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/vizceral"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// GraphNamespace is a REST http.HandlerFunc handling namespace-wide servicegraph
// config generation.
func GraphNamespace(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	checkError(err)

	graphNamespace(w, r, client)
}

// graphNamespace provides a testing hook that can supply a mock client
func graphNamespace(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := options.NewOptions(r)
	trafficMap := graphNamespaces(o, client)
	generateGraph(trafficMap, w, o)
}

func graphNamespaces(o options.Options, client *prometheus.Client) graph.TrafficMap {
	switch o.Vendor {
	case "cytoscape":
	case "vizceral":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Namespace Graphs", o.Vendor)))
	}

	log.Debugf("Build graph for [%v] namespaces [%s]", len(o.Namespaces), o.Namespaces)

	trafficMap := graph.NewTrafficMap()
	for _, namespace := range o.Namespaces {
		log.Debugf("Build traffic map for namespace [%s]", namespace)
		namespaceTrafficMap := buildNamespaceTrafficMap(namespace, o, client)

		for _, a := range o.Appenders {
			a.AppendGraph(namespaceTrafficMap, namespace)
		}
		mergeTrafficMaps(trafficMap, namespaceTrafficMap)
	}

	// The appenders can add/remove/alter services. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the roots (i.e. traffic generators, a service with only outgoing traffic.)
	// - mark the outsiders (i.e. terminal services (no children) and not in the requested namespaces)
	for _, s := range trafficMap {
		if s.Metadata["rate"].(float64) == 0.0 && s.Metadata["rateOut"].(float64) > 0.0 {
			s.Metadata["isRoot"] = true
		}
		if isOutside(s, o.Namespaces) {
			s.Metadata["isOutside"] = true
		}
	}

	return trafficMap
}

func isOutside(s *graph.ServiceNode, namespaces []string) bool {
	if len(s.Edges) > 0 {
		return false
	}
	for _, ns := range namespaces {
		if s.Namespace == ns {
			return false
		}
	}
	return true
}

// buildNamespaceTrafficMap returns a map of all namespace services (key=id).  All
// services either directly send and/or receive requests from a service in the namespace.
func buildNamespaceTrafficMap(namespace string, o options.Options, client *prometheus.Client) graph.TrafficMap {
	// query prometheus for request traffic in two queries. The first query gathers traffic for
	// requests originating outside of the namespace...
	namespacePattern := fmt.Sprintf(".*\\\\.%v\\\\..*", namespace)
	groupBy := "source_service,source_version,destination_service,destination_version,response_code,connection_mtls"
	query := fmt.Sprintf("sum(rate(%v{source_service!~\"%v\",destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespacePattern,          // regex for namespace-constrained service
		namespacePattern,          // regex for namespace-constrained service
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the externally originating request traffic time-series
	extVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// The second query gathers traffic for requests originating inside of the namespace...
	query = fmt.Sprintf("sum(rate(%v{source_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespacePattern,          // regex for namespace-constrained service
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the internally originating request traffic time-series
	intVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	populateTrafficMap(trafficMap, &extVector, o)
	populateTrafficMap(trafficMap, &intVector, o)

	return trafficMap
}

func populateTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, o options.Options) {
	for _, s := range *vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		sourceVer, sourceVerOk := m["source_version"]
		destSvc, destSvcOk := m["destination_service"]
		destVer, destVerOk := m["destination_version"]
		code, codeOk := m["response_code"]
		mtls, mtlsOk := m["connection_mtls"]

		if !sourceSvcOk || !sourceVerOk || !destSvcOk || !destVerOk || !codeOk || !mtlsOk {
			log.Warningf("Skipping %v, missing expected TS labels", m.String())
			continue
		}

		source, _ := addService(trafficMap, string(sourceSvc), string(sourceVer))

		// Don't include an istio-system destination (kiali-915) unless asked to do so
		if !o.IncludeIstio && strings.Contains(string(destSvc), options.NamespaceIstioSystem) {
			continue
		}

		dest, _ := addService(trafficMap, string(destSvc), string(destVer))

		var edge *graph.Edge
		for _, e := range source.Edges {
			if dest.ID == e.Dest.ID {
				edge = e
				break
			}
		}
		if nil == edge {
			edge = source.AddEdge(dest)
			edge.Metadata["rate"] = 0.0
			edge.Metadata["rate2xx"] = 0.0
			edge.Metadata["rate3xx"] = 0.0
			edge.Metadata["rate4xx"] = 0.0
			edge.Metadata["rate5xx"] = 0.0
		}

		val := float64(s.Value)
		var ck string
		switch {
		case strings.HasPrefix(string(code), "2"):
			ck = "rate2xx"
		case strings.HasPrefix(string(code), "3"):
			ck = "rate3xx"
		case strings.HasPrefix(string(code), "4"):
			ck = "rate4xx"
		case strings.HasPrefix(string(code), "5"):
			ck = "rate5xx"
		}
		edge.Metadata[ck] = edge.Metadata[ck].(float64) + val
		edge.Metadata["rate"] = edge.Metadata["rate"].(float64) + val

		// we set MTLS true if any TS for this edge has MTLS
		if mtls == "true" {
			edge.Metadata["isMTLS"] = true
		}

		source.Metadata["rateOut"] = source.Metadata["rateOut"].(float64) + val
		dest.Metadata[ck] = dest.Metadata[ck].(float64) + val
		dest.Metadata["rate"] = dest.Metadata["rate"].(float64) + val
	}
}

func addService(trafficMap graph.TrafficMap, name, version string) (*graph.ServiceNode, bool) {
	id := graph.Id(name, version)
	svc, found := trafficMap[id]
	if !found {
		newSvc := graph.NewServiceNodeWithId(id, name, version)
		svc = &newSvc
		svc.Metadata["rate"] = 0.0
		svc.Metadata["rate2xx"] = 0.0
		svc.Metadata["rate3xx"] = 0.0
		svc.Metadata["rate4xx"] = 0.0
		svc.Metadata["rate5xx"] = 0.0
		svc.Metadata["rateOut"] = 0.0
		trafficMap[id] = svc
	}
	return svc, !found
}

// mergeTrafficMaps ensures that we only have unique services by removing duplicate
// services and merging their edges.  When also ned to avoid duplicate edges, it can
// happen when an terminal node of one namespace is a root node of another:
//   ns1 graph: unknown -> ns1:A -> ns2:B
//   ns2 graph:   ns1:A -> ns2:B -> ns2:C
func mergeTrafficMaps(trafficMap, nsTrafficMap graph.TrafficMap) {
	for nsId, nsService := range nsTrafficMap {
		if service, isDup := trafficMap[nsId]; isDup {
			for _, nsEdge := range nsService.Edges {
				isDupEdge := false
				for _, e := range service.Edges {
					if nsEdge.Dest.ID == e.Dest.ID {
						isDupEdge = true
						break
					}
				}
				if !isDupEdge {
					service.Edges = append(service.Edges, nsEdge)
				}
			}
		} else {
			trafficMap[nsId] = nsService
		}
	}
}

// GraphService is a REST http.HandlerFunc handling service-specific servicegraph config generation.
func GraphService(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	checkError(err)

	graphService(w, r, client)
}

// graphService provides a testing hook that can supply a mock client
func graphService(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := options.NewOptions(r)

	switch o.Vendor {
	case "cytoscape":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Service Graphs", o.Vendor)))
	}

	log.Debugf("Build roots (root services nodes) for [%v] service graph with options [%+v]", o.Vendor, o)

	trafficMap := buildServiceTrafficMap(o, client)

	generateGraph(trafficMap, w, o)
}

// buildServiceTrafficMap returns a map of all relevant services (key=id).  All
// services either directly send and/or receive requests from the service.
func buildServiceTrafficMap(o options.Options, client *prometheus.Client) graph.TrafficMap {
	// query prometheus for request traffic in two queries. The first query gathers incoming traffic
	// for the service
	servicePattern := fmt.Sprintf("%v\\\\.%v\\\\..*", o.Service, o.Namespaces[0])
	groupBy := "source_service,source_version,destination_service,destination_version,response_code,connection_mtls"
	query := fmt.Sprintf("sum(rate(%v{destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		servicePattern,            // regex for namespace-constrained service
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the incoming request traffic time-series
	inVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// The second query gathers traffic for requests originating from the service...
	query = fmt.Sprintf("sum(rate(%v{source_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		servicePattern,            // regex for namespace-constrained service
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the outgoingrequest traffic time-series
	outVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	populateTrafficMap(trafficMap, &inVector, o)
	populateTrafficMap(trafficMap, &outVector, o)

	return trafficMap
}

func generateGraph(trafficMap graph.TrafficMap, w http.ResponseWriter, o options.Options) {
	log.Debugf("Generating config for [%v] service graph...", o.Vendor)

	var vendorConfig interface{}
	switch o.Vendor {
	case "vizceral":
		vendorConfig = vizceral.NewConfig(fmt.Sprintf("%v", o.Namespaces), trafficMap, o.VendorOptions)
	case "cytoscape":
		vendorConfig = cytoscape.NewConfig(trafficMap, o.VendorOptions)
	}

	log.Debugf("Done generating config for [%v] service graph.", o.Vendor)
	RespondWithJSONIndent(w, http.StatusOK, vendorConfig)
}

// TF is the TimeFormat for printing timestamp
const TF = "2006-01-02 15:04:05"

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Debugf("Executing query %s&time=%v (now=%v, %v)\n", query, queryTime.Format(TF), time.Now().Format(TF), queryTime.Unix())

	value, err := api.Query(ctx, query, queryTime)
	checkError(err)

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		checkError(errors.New(fmt.Sprintf("No handling for type %v!\n", t)))
	}

	return nil
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}

func handlePanic(w http.ResponseWriter) {
	if r := recover(); r != nil {
		var message string
		switch r.(type) {
		case string:
			message = r.(string)
		case error:
			message = r.(error).Error()
		case func() string:
			message = r.(func() string)()
		default:
			message = fmt.Sprintf("%v", r)
		}
		log.Errorf("%s: %s", message, debug.Stack())
		RespondWithError(w, http.StatusInternalServerError, message)
	}
}

// some debugging utils
//func ids(r *[]graph.ServiceNode) []string {
//	s := []string{}
//	for _, r := range *r {
//		s = append(s, r.ID)
//	}
//	return s
//}

//func keys(m map[string]*graph.ServiceNode) []string {
//	s := []string{}
//	for k := range m {
//		s = append(s, k)
//	}
//	return s
//}
