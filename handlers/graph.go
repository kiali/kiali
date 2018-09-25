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
//   namespaces:     Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:      Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   vendor:         cytoscape (default cytoscape)
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
	"github.com/kiali/kiali/graph/appender"
	"github.com/kiali/kiali/graph/cytoscape"
	"github.com/kiali/kiali/graph/options"
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
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%s] not supported", o.Vendor)))
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
	markOutsiders(trafficMap, o)
	markTrafficGenerators(trafficMap)

	return trafficMap
}

func markOutsiders(trafficMap graph.TrafficMap, o options.Options) {
	for _, n := range trafficMap {
		if isOutside(n, o.Namespaces) {
			n.Metadata["isOutside"] = true
			if isInaccessible(n, o.AccessibleNamespaces) {
				n.Metadata["isInaccessible"] = true
			}
		}
	}
}

func isOutside(n *graph.Node, namespaces []string) bool {
	if n.Namespace == graph.UnknownNamespace {
		return false
	}
	for _, ns := range namespaces {
		if n.Namespace == ns {
			return false
		}
	}
	return true
}

func isInaccessible(n *graph.Node, accessibleNamespaces map[string]bool) bool {
	if _, found := accessibleNamespaces[n.Namespace]; !found {
		return true
	} else {
		return false
	}
}

func markTrafficGenerators(trafficMap graph.TrafficMap) {
	destMap := make(map[string]*graph.Node)
	for _, n := range trafficMap {
		for _, e := range n.Edges {
			destMap[e.Dest.ID] = e.Dest
		}
	}
	for _, n := range trafficMap {
		if len(n.Edges) == 0 {
			continue
		}
		if _, isDest := destMap[n.ID]; !isDest {
			n.Metadata["isRoot"] = true
		}
	}
}

// buildNamespaceTrafficMap returns a map of all namespace nodes (key=id).  All
// nodes either directly send and/or receive requests from a node in the namespace.
func buildNamespaceTrafficMap(namespace string, o options.Options, client *prometheus.Client) graph.TrafficMap {
	httpMetric := "istio_requests_total"

	// query prometheus for request traffic in three queries:
	// 1) query for traffic originating from "unknown" (i.e. the internet).
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code"
	query := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
		httpMetric,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)
	unkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 2) query for traffic originating from a workload outside of the namespace.  Exclude any "unknown" source telemetry (an unusual corner case)
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace!="%s",source_workload!="unknown",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
		httpMetric,
		namespace,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the externally originating request traffic time-series
	extVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
		httpMetric,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(o.Duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the internally originating request traffic time-series
	intVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	populateTrafficMapHttp(trafficMap, &unkVector, o)
	populateTrafficMapHttp(trafficMap, &extVector, o)
	populateTrafficMapHttp(trafficMap, &intVector, o)

	// istio component telemetry is only reported destination-side, so we must perform additional queries
	if o.IncludeIstio {
		istioNamespace := config.Get().IstioNamespace

		// 4) if the target namespace is istioNamespace re-query for traffic originating from a workload outside of the namespace
		if namespace == istioNamespace {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%s",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				namespace,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)

			// fetch the externally originating request traffic time-series
			extIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
			populateTrafficMapHttp(trafficMap, &extIstioVector, o)
		}

		// 5) supplemental query for traffic originating from a workload inside of the namespace with istioSystem destination
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			istioNamespace,
			"[2345][0-9][0-9]",        // regex for valid response_codes
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)

		// fetch the internally originating request traffic time-series
		intIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMapHttp(trafficMap, &intIstioVector, o)
	}

	// Section for TCP services
	tcpMetric := "istio_tcp_sent_bytes_total"

	// 1) query for traffic originating from "unknown" (i.e. the internet)
	tcpGroupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_workload_namespace,destination_service_name,destination_workload,destination_app,destination_version"
	query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(o.Duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpUnkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 2) query for traffic originating from a workload outside of the namespace. Exclude any "unknown" source telemetry (an unusual corner case)
	tcpGroupBy = "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version"
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace!="%s",source_workload!="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		namespace,
		int(o.Duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpExtVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(o.Duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	populateTrafficMapTcp(trafficMap, &tcpUnkVector, o)
	populateTrafficMapTcp(trafficMap, &tcpExtVector, o)
	populateTrafficMapTcp(trafficMap, &tcpInVector, o)

	return trafficMap
}

func populateTrafficMapHttp(trafficMap graph.TrafficMap, vector *model.Vector, o options.Options) {
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
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
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

		val := float64(s.Value)

		if o.InjectServiceNodes {
			// don't inject a service node if the dest node is already a service node.  Also, we can't inject if destSvcName is not set.
			_, destNodeType := graph.Id(destSvcNs, destWl, destApp, destVer, destSvcName, o.VendorOptions.GraphType)
			if destSvcNameOk && destNodeType != graph.NodeTypeService {
				addHttpTraffic(trafficMap, val, code, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, "", "", "", destSvcName, o)
				addHttpTraffic(trafficMap, val, code, destSvcNs, "", "", "", destSvcName, destSvcNs, destWl, destApp, destVer, destSvcName, o)
			} else {
				addHttpTraffic(trafficMap, val, code, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, destWl, destApp, destVer, destSvcName, o)
			}
		} else {
			addHttpTraffic(trafficMap, val, code, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, destWl, destApp, destVer, destSvcName, o)
		}
	}
}

func addHttpTraffic(trafficMap graph.TrafficMap, val float64, code, sourceWlNs, sourceWl, sourceApp, sourceVer, sourceSvcName, destSvcNs, destWl, destApp, destVer, destSvcName string, o options.Options) {

	source, sourceFound := addNode(trafficMap, sourceWlNs, sourceWl, sourceApp, sourceVer, sourceSvcName, o)
	dest, destFound := addNode(trafficMap, destSvcNs, destWl, destApp, destVer, destSvcName, o)

	addToDestServices(dest.Metadata, destSvcName)

	var edge *graph.Edge
	for _, e := range source.Edges {
		if dest.ID == e.Dest.ID && e.Metadata["protocol"] == "http" {
			edge = e
			break
		}
	}
	if nil == edge {
		edge = source.AddEdge(dest)
		edge.Metadata["protocol"] = "http"
	}

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

func populateTrafficMapTcp(trafficMap graph.TrafficMap, vector *model.Vector, o options.Options) {
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

		// TCP queries doesn't use destination_service_namespace for the unknown node.
		// Check if this is the case and use destination_workload_namespace
		if !destSvcNsOk {
			lDestSvcNs, destSvcNsOk = m["destination_workload_namespace"]
		}

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlOk || !destAppOk || !destVerOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
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

		val := float64(s.Value)

		if o.InjectServiceNodes {
			// don't inject a service node if the dest node is already a service node.  Also, we can't inject if destSvcName is not set.
			destSvcNameOk = destSvcName != "" && destSvcName != graph.UnknownService
			_, destNodeType := graph.Id(destSvcNs, destWl, destApp, destVer, destSvcName, o.VendorOptions.GraphType)
			if destSvcNameOk && destNodeType != graph.NodeTypeService {
				addTcpTraffic(trafficMap, val, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, "", "", "", destSvcName, o)
				addTcpTraffic(trafficMap, val, destSvcNs, "", "", "", destSvcName, destSvcNs, destWl, destApp, destVer, destSvcName, o)
			} else {
				addTcpTraffic(trafficMap, val, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, destWl, destApp, destVer, destSvcName, o)
			}
		} else {
			addTcpTraffic(trafficMap, val, sourceWlNs, sourceWl, sourceApp, sourceVer, "", destSvcNs, destWl, destApp, destVer, destSvcName, o)
		}
	}
}

func addTcpTraffic(trafficMap graph.TrafficMap, val float64, sourceWlNs, sourceWl, sourceApp, sourceVer, sourceSvcName, destSvcNs, destWl, destApp, destVer, destSvcName string, o options.Options) {

	source, sourceFound := addNode(trafficMap, sourceWlNs, sourceWl, sourceApp, sourceVer, sourceSvcName, o)
	dest, destFound := addNode(trafficMap, destSvcNs, destWl, destApp, destVer, destSvcName, o)

	addToDestServices(dest.Metadata, destSvcName)

	var edge *graph.Edge
	for _, e := range source.Edges {
		if dest.ID == e.Dest.ID && e.Metadata["procotol"] == "tcp" {
			edge = e
			break
		}
	}
	if nil == edge {
		edge = source.AddEdge(dest)
		edge.Metadata["protocol"] = "tcp"
	}

	// A workload may mistakenly have multiple app and or version label values.
	// This is a misconfiguration we need to handle. See Kiali-1309.
	if sourceFound {
		handleMisconfiguredLabels(source, sourceApp, sourceVer, val, o)
	}
	if destFound {
		handleMisconfiguredLabels(dest, destApp, destVer, val, o)
	}

	addToRate(edge.Metadata, "tcpSentRate", val)
	addToRate(source.Metadata, "tcpSentRateOut", val)
	addToRate(dest.Metadata, "tcpSentRate", val)
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

func addNode(trafficMap graph.TrafficMap, namespace, workload, app, version, service string, o options.Options) (*graph.Node, bool) {
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
// nodes and merging their edges.  We also need to avoid duplicate edges, it can
// happen when an terminal node of one namespace is a root node of another:
//   ns1 graph: unknown -> ns1:A -> ns2:B
//   ns2 graph:   ns1:A -> ns2:B -> ns2:C
func mergeTrafficMaps(trafficMap, nsTrafficMap graph.TrafficMap) {
	for nsId, nsNode := range nsTrafficMap {
		if node, isDup := trafficMap[nsId]; isDup {
			for _, nsEdge := range nsNode.Edges {
				isDupEdge := false
				for _, e := range node.Edges {
					if nsEdge.Dest.ID == e.Dest.ID && nsEdge.Metadata["protocol"] == e.Metadata["protocol"] {
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

// GraphNode is a REST http.HandlerFunc handling node-detail graph
// config generation.
func GraphNode(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	checkError(err)

	graphNode(w, r, client)
}

// graphNode provides a testing hook that can supply a mock client
func graphNode(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := options.NewOptions(r)
	switch o.Vendor {
	case "cytoscape":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%s] not supported", o.Vendor)))
	}
	if len(o.Namespaces) != 1 {
		checkError(errors.New(fmt.Sprintf("Node graph does not support the 'namespaces' query parameter or the 'all' namespace")))
	}

	namespace := o.Namespaces[0]
	n := graph.NewNode(namespace, o.NodeOptions.Workload, o.NodeOptions.App, o.NodeOptions.Version, o.NodeOptions.Service, o.GraphType)

	log.Debugf("Build graph for node [%v]", n)

	trafficMap := buildNodeTrafficMap(namespace, n, o, client)

	for _, a := range o.Appenders {
		switch a.(type) {
		case appender.UnusedNodeAppender:
			// not applicable to a node detail graph
			continue
		default:
			a.AppendGraph(trafficMap, namespace)
		}
	}

	// The appenders can add/remove/alter nodes. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the outsiders (i.e. nodes not in the requested namespaces)
	// - mark the traffic generators
	markOutsiders(trafficMap, o)
	markTrafficGenerators(trafficMap)

	generateGraph(trafficMap, w, o)
}

// buildNodeTrafficMap returns a map of all nodes requesting or requested by the target node (key=id).
func buildNodeTrafficMap(namespace string, n graph.Node, o options.Options, client *prometheus.Client) graph.TrafficMap {
	httpMetric := "istio_requests_total"

	// query prometheus for request traffic in two queries:
	// 1) query for incoming traffic
	var query string
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_workload_namespace="%s",destination_workload="%s",response_code=~"%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Workload,
			"[2345][0-9][0-9]",        // regex for valid response_codes
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if n.Version != "" && n.Version != graph.UnknownVersion {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_app="%s",destination_version="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				n.Version,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_app="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_service_name="%s",response_code=~"%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Service,
			"[2345][0-9][0-9]",        // regex for valid response_codes
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)
	default:
		checkError(errors.New(fmt.Sprintf("NodeType [%s] not supported", n.NodeType)))
	}
	inVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 2) query for outbound traffic
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_workload="%s",response_code=~"%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Workload,
			"[2345][0-9][0-9]",        // regex for valid response_codes
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if n.Version != "" && n.Version != graph.UnknownVersion {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s",source_version="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				n.Version,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		query = ""
	default:
		checkError(errors.New(fmt.Sprintf("NodeType [%s] not supported", n.NodeType)))
	}
	outVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	populateTrafficMapHttp(trafficMap, &inVector, o)
	populateTrafficMapHttp(trafficMap, &outVector, o)

	// istio component telemetry is only reported destination-side, so we must perform additional queries
	if o.IncludeIstio {
		istioNamespace := config.Get().IstioNamespace

		// 3) supplemental query for outbound traffic to the istio namespace
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_workload="%s",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.Workload,
				istioNamespace,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		case graph.NodeTypeApp:
			if n.Version != "" && n.Version != graph.UnknownVersion {
				query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_app="%s",source_version="%s",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
					httpMetric,
					namespace,
					n.App,
					n.Version,
					istioNamespace,
					"[2345][0-9][0-9]",        // regex for valid response_codes
					int(o.Duration.Seconds()), // range duration for the query
					groupBy)
			} else {
				query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_app="%s",destination_service_namespace="%s",response_code=~"%s"} [%vs])) by (%s)`,
					httpMetric,
					namespace,
					n.App,
					istioNamespace,
					"[2345][0-9][0-9]",        // regex for valid response_codes
					int(o.Duration.Seconds()), // range duration for the query
					groupBy)
			}
		case graph.NodeTypeService:
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_service_name="%s",response_code=~"%s"} [%vs])) by (%s)`,
				httpMetric,
				istioNamespace,
				n.Service,
				"[2345][0-9][0-9]",        // regex for valid response_codes
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		default:
			checkError(errors.New(fmt.Sprintf("NodeType [%s] not supported", n.NodeType)))
		}
		outIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMapHttp(trafficMap, &outIstioVector, o)
	}

	// Section for TCP services
	tcpMetric := "istio_tcp_sent_bytes_total"

	tcpGroupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_workload_namespace,destination_service_name,destination_workload,destination_app,destination_version"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Workload,
			int(o.Duration.Seconds()), // range duration for the query
			tcpGroupBy)
	case graph.NodeTypeApp:
		if n.Version != "" && n.Version != graph.UnknownVersion {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_app="%s",destination_version="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				n.Version,
				int(o.Duration.Seconds()), // range duration for the query
				tcpGroupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_app="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				int(o.Duration.Seconds()), // range duration for the query
				tcpGroupBy)
		}
	case graph.NodeTypeService:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Service,
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)
	default:
		checkError(errors.New(fmt.Sprintf("NodeType [%s] not supported", n.NodeType)))
	}
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// 2) query for outbound traffic
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Workload,
			int(o.Duration.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if n.Version != "" && n.Version != graph.UnknownVersion {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s",source_version="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				n.Version,
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				int(o.Duration.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		query = ""
	default:
		checkError(errors.New(fmt.Sprintf("NodeType [%s] not supported", n.NodeType)))
	}
	tcpOutVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	populateTrafficMapTcp(trafficMap, &tcpInVector, o)
	populateTrafficMapTcp(trafficMap, &tcpOutVector, o)

	return trafficMap
}

func generateGraph(trafficMap graph.TrafficMap, w http.ResponseWriter, o options.Options) {
	log.Debugf("Generating config for [%s] service graph...", o.Vendor)

	var vendorConfig interface{}
	switch o.Vendor {
	case "cytoscape":
		vendorConfig = cytoscape.NewConfig(trafficMap, o.VendorOptions)
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%s] not supported", o.Vendor)))
	}

	log.Debugf("Done generating config for [%s] service graph.", o.Vendor)
	RespondWithJSONIndent(w, http.StatusOK, vendorConfig)
}

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	if "" == query {
		return model.Vector{}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Debugf("Graph query:\n%s@time=%v (now=%v, %v)\n", query, queryTime.Format(graph.TF), time.Now().Format(graph.TF), queryTime.Unix())

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
