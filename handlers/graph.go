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
//   GraphWorkload:    Generate a graph centered on a specified workload, limited to
//                    requesting and requested nodes.
//
// The handlers accept the following query parameters (some handlers may ignore some parameters):
//   appenders:      Comma-separated list of appenders to run from [circuit_breaker, unused_service...] (default all)
//                   Note, appenders may support appender-specific query parameters
//   duration:       time.Duration indicating desired query range duration, (default 10m)
//   graphType:      Determines how to present the telemetry data. app | versionedApp | workload (default workload)
//   groupBy:        If supported by vendor, visually group by a specified node attribute (default version)
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

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/cytoscape"
	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/vizceral"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// GraphNamespace is a REST http.HandlerFunc handling namespace-wide graph
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

	// The appenders can add/remove/alter nodes. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the outsiders (i.e. nodes not in the requested namespaces)
	// - mark the insider traffic generators (i.e. inside the namespace and only outgoing edges)
	for _, s := range trafficMap {
		if isOutside(s, o.Namespaces) {
			s.Metadata["isOutside"] = true
		} else if isRoot(s) {
			s.Metadata["isRoot"] = true
		}
	}

	return trafficMap
}

func isOutside(s *graph.Node, namespaces []string) bool {
	if s.Namespace == graph.UnknownNamespace {
		return false
	}
	for _, ns := range namespaces {
		if s.Namespace == ns {
			return false
		}
	}
	return true
}

func isRoot(s *graph.Node) bool {
	if len(s.Edges) == 0 {
		return false
	}
	_, hasRateIn := s.Metadata["rate"]
	return !hasRateIn
}

// buildNamespaceTrafficMap returns a map of all namespace nodes (key=id).  All
// nodes either directly send and/or receive requests from a node in the namespace.
func buildNamespaceTrafficMap(namespace string, o options.Options, client *prometheus.Client) graph.TrafficMap {
	// query prometheus for request traffic in three queries:
	// 1) query for traffic originating from "unknown" (i.e. the internet)
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code"
	query := fmt.Sprintf("sum(rate(%v{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the unknown originating request traffic time-series
	unkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 2) query for traffic originating from a workload outside of the namespace
	query = fmt.Sprintf("sum(rate(%v{reporter=\"source\",source_workload_namespace!=\"%v\",destination_service_namespace=\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespace,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the externally originating request traffic time-series
	extVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf("sum(rate(%v{reporter=\"source\",source_workload_namespace=\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the internally originating request traffic time-series
	intVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	populateTrafficMap(trafficMap, &unkVector, o)
	populateTrafficMap(trafficMap, &extVector, o)
	populateTrafficMap(trafficMap, &intVector, o)

	// istio component telemetry is only reported destination-side, so we must perform additional queries
	if o.IncludeIstio {
		istioNamespace := config.Get().IstioNamespace

		// 4) if the target namespace is istioNamespace re-query for traffic originating from a workload outside of the namespace
		if namespace == istioNamespace {
			query = fmt.Sprintf("sum(rate(%v{reporter=\"destination\",source_workload_namespace!=\"%v\",destination_service_namespace=\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
				o.Metric,
				namespace,
				namespace,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)

			// fetch the externally originating request traffic time-series
			extIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
			populateTrafficMap(trafficMap, &extIstioVector, o)
		}

		// 5) supplemental query for traffic originating from a workload inside of the namespace with istioSystem destination
		query = fmt.Sprintf("sum(rate(%v{reporter=\"destination\",source_workload_namespace=\"%v\",destination_service_namespace=\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
			o.Metric,
			namespace,
			istioNamespace,
			"[2345][0-9][0-9]",        // regex for valid response_codes
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)

		// fetch the internally originating request traffic time-series
		intIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMap(trafficMap, &intIstioVector, o)
	}

	return trafficMap
}

func populateTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, o options.Options) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_app"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_app"]
		lDestVer, destVerOk := m["destination_version"]
		lCode, codeOk := m["response_code"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlOk || !destAppOk || !destVerOk || !codeOk {
			log.Warningf("Skipping %v, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvcName := string(lDestSvcName)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)
		code := string(lCode)

		source, sourceFound := addSourceNode(trafficMap, sourceWlNs, sourceWl, sourceApp, sourceVer, o)
		dest, destFound := addDestNode(trafficMap, destSvcNs, destWl, destApp, destVer, destSvcName, o)

		addToDestServices(dest.Metadata, destSvcName)

		var edge *graph.Edge
		for _, e := range source.Edges {
			if dest.ID == e.Dest.ID {
				edge = e
				break
			}
		}
		if nil == edge {
			edge = source.AddEdge(dest)
		}

		val := float64(s.Value)

		// A workload may mistakenly have multiple app and or version label values.
		// This is a misconfiguration we need to handle. See Kiali-1309.
		if sourceFound {
			handleMisconfiguredLabels(source, sourceApp, sourceVer, val, o)
		}
		if destFound {
			handleMisconfiguredLabels(dest, destApp, destVer, val, o)
		}

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
		addToRate(edge.Metadata, ck, val)
		addToRate(edge.Metadata, "rate", val)

		addToRate(source.Metadata, "rateOut", val)
		addToRate(dest.Metadata, ck, val)
		addToRate(dest.Metadata, "rate", val)
	}
}

func addToRate(md map[string]interface{}, k string, v float64) {
	if curr, ok := md[k]; ok {
		md[k] = curr.(float64) + v
	} else {
		md[k] = v
	}
}

func addToDestServices(md map[string]interface{}, destService string) {
	destServices, ok := md["destServices"]
	if !ok {
		destServices = make(map[string]bool)
		md["destServices"] = destServices
	}
	destServices.(map[string]bool)[destService] = true
}

func handleMisconfiguredLabels(node *graph.Node, app, version string, rate float64, o options.Options) {
	isVersionedAppGraph := o.VendorOptions.GraphType == graph.GraphTypeVersionedApp
	isWorkloadNode := node.NodeType == graph.NodeTypeWorkload
	isVersionedAppNode := node.NodeType == graph.NodeTypeApp && isVersionedAppGraph
	if isWorkloadNode || isVersionedAppNode {
		labels := []string{}
		if node.App != app {
			labels = append(labels, "app")
		}
		if node.Version != version {
			labels = append(labels, "version")
		}
		// prefer the labels of an active time series as often the other labels are inactive
		if len(labels) > 0 {
			node.Metadata["isMisconfigured"] = fmt.Sprintf("labels=%v", labels)
			if rate > 0.0 {
				node.App = app
				node.Version = version
			}
		}
	}
}

func addSourceNode(trafficMap graph.TrafficMap, namespace, workload, app, version string, o options.Options) (*graph.Node, bool) {
	id, nodeType := graph.Id(namespace, workload, app, version, "", o.VendorOptions.GraphType)
	node, found := trafficMap[id]
	if !found {
		newNode := graph.NewNodeExplicit(id, namespace, workload, app, version, "", nodeType, o.VendorOptions.GraphType)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}

func addDestNode(trafficMap graph.TrafficMap, namespace, workload, app, version, service string, o options.Options) (*graph.Node, bool) {
	id, nodeType := graph.Id(namespace, workload, app, version, service, o.VendorOptions.GraphType)
	node, found := trafficMap[id]
	if !found {
		newNode := graph.NewNodeExplicit(id, namespace, workload, app, version, service, nodeType, o.VendorOptions.GraphType)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}

// mergeTrafficMaps ensures that we only have unique nodes by removing duplicate
// nodes and merging their edges.  When also need to avoid duplicate edges, it can
// happen when an terminal node of one namespace is a root node of another:
//   ns1 graph: unknown -> ns1:A -> ns2:B
//   ns2 graph:   ns1:A -> ns2:B -> ns2:C
func mergeTrafficMaps(trafficMap, nsTrafficMap graph.TrafficMap) {
	for nsId, nsNode := range nsTrafficMap {
		if node, isDup := trafficMap[nsId]; isDup {
			for _, nsEdge := range nsNode.Edges {
				isDupEdge := false
				for _, e := range node.Edges {
					if nsEdge.Dest.ID == e.Dest.ID {
						isDupEdge = true
						break
					}
				}
				if !isDupEdge {
					node.Edges = append(node.Edges, nsEdge)
				}
			}
		} else {
			trafficMap[nsId] = nsNode
		}
	}
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

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Debugf("Executing query %s@time=%v (now=%v, %v)\n", query, queryTime.Format(graph.TF), time.Now().Format(graph.TF), queryTime.Unix())

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
//func ids(r *[]graph.Node) []string {
//	s := []string{}
//	for _, r := range *r {
//		s = append(s, r.ID)
//	}
//	return s
//}

//func keys(m map[string]*graph.Node) []string {
//	s := []string{}
//	for k := range m {
//		s = append(s, k)
//	}
//	return s
//}
