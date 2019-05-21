// Package istio provides the Istio implementation of graph/TelemetryProvider.
package istio

// Istio.go is responsible for generating TrafficMaps using Istio telemetry.  It implements the
// TelemetryVendor interface.
//
// The algorithm is two-pass:
//   First Pass: Query Prometheus (istio-requests-total metric) to retrieve the source-destination
//               dependencies. Build a traffic map to provide a full representation of nodes and edges.
//
//   Second Pass: Apply any requested appenders to alter or append to the graph.
//
//
// Supports two vendor-specific query parameters:
//   includeIstio:   Include istio-system (infra) services (default: false)
//   responseTimeQuantile: Must be a valid quantile (default: 0.95)
//
import (
	"context"
	"fmt"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// BuildNamespacesTrafficMap is required by the graph/TelemtryVendor interface
func BuildNamespacesTrafficMap(o graph.TelemetryOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) graph.TrafficMap {
	log.Tracef("Build [%s] graph for [%v] namespaces [%s]", o.GraphType, len(o.Namespaces), o.Namespaces)

	appenders := appender.ParseAppenders(o)
	trafficMap := graph.NewTrafficMap()

	for _, namespace := range o.Namespaces {
		log.Tracef("Build traffic map for namespace [%s]", namespace)
		namespaceTrafficMap := buildNamespaceTrafficMap(namespace.Name, o, client)
		namespaceInfo := graph.NewAppenderNamespaceInfo(namespace.Name)
		for _, a := range appenders {
			appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
			a.AppendGraph(namespaceTrafficMap, globalInfo, namespaceInfo)
			appenderTimer.ObserveDuration()
		}
		mergeTrafficMaps(trafficMap, namespace.Name, namespaceTrafficMap)
	}

	// The appenders can add/remove/alter nodes. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the outsiders (i.e. nodes not in the requested namespaces)
	// - mark the insider traffic generators (i.e. inside the namespace and only outgoing edges)
	markOutsideOrInaccessible(trafficMap, o)
	markTrafficGenerators(trafficMap)

	if graph.GraphTypeService == o.GraphType {
		trafficMap = reduceToServiceGraph(trafficMap)
	}

	return trafficMap
}

// mergeTrafficMaps ensures that we only have unique nodes by removing duplicate
// nodes and merging their edges.  When removing a duplicate prefer an instance
// from the namespace being merged-in because it is guaranteed to have all appender
// information applied (i.e. not an outsider). We also need to avoid duplicate edges,
// it can happen when a terminal node of one namespace is a root node of another:
//   ns1 graph: unknown -> ns1:A -> ns2:B
//   ns2 graph:   ns1:A -> ns2:B -> ns2:C
func mergeTrafficMaps(trafficMap graph.TrafficMap, ns string, nsTrafficMap graph.TrafficMap) {
	for nsId, nsNode := range nsTrafficMap {
		if node, isDup := trafficMap[nsId]; isDup {
			if nsNode.Namespace == ns {
				// prefer nsNode (see above comment), so do a swap
				trafficMap[nsId] = nsNode
				temp := node
				node = nsNode
				nsNode = temp
			}
			for _, nsEdge := range nsNode.Edges {
				isDupEdge := false
				for _, e := range node.Edges {
					if nsEdge.Dest.ID == e.Dest.ID && nsEdge.Metadata[graph.ProtocolKey] == e.Metadata[graph.ProtocolKey] {
						isDupEdge = true
						break
					}
				}
				if !isDupEdge {
					node.Edges = append(node.Edges, nsEdge)
					// add traffic for the new edge
					graph.AddOutgoingEdgeToMetadata(node.Metadata, nsEdge.Metadata)
				}
			}
		} else {
			trafficMap[nsId] = nsNode
		}
	}
}

func markOutsideOrInaccessible(trafficMap graph.TrafficMap, o graph.TelemetryOptions) {
	for _, n := range trafficMap {
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			n.Metadata[graph.IsInaccessible] = true
		case graph.NodeTypeService:
			if _, ok := n.Metadata[graph.IsServiceEntry]; ok {
				n.Metadata[graph.IsInaccessible] = true
			} else if n.Namespace == graph.Unknown && n.Service == graph.Unknown {
				n.Metadata[graph.IsInaccessible] = true
			} else {
				if isOutside(n, o.Namespaces) {
					n.Metadata[graph.IsOutside] = true
				}
			}
		default:
			if isOutside(n, o.Namespaces) {
				n.Metadata[graph.IsOutside] = true
			}
		}
		if isOutsider, ok := n.Metadata[graph.IsOutside]; ok && isOutsider.(bool) {
			if _, ok2 := n.Metadata[graph.IsInaccessible]; !ok2 {
				if isInaccessible(n, o.AccessibleNamespaces) {
					n.Metadata[graph.IsInaccessible] = true
				}
			}
		}
	}
}

func isOutside(n *graph.Node, namespaces map[string]graph.NamespaceInfo) bool {
	if n.Namespace == graph.Unknown {
		return false
	}
	for _, ns := range namespaces {
		if n.Namespace == ns.Name {
			return false
		}
	}
	return true
}

func isInaccessible(n *graph.Node, accessibleNamespaces map[string]time.Time) bool {
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
			n.Metadata[graph.IsRoot] = true
		}
	}
}

// reduceToServicGraph compresses a [service-injected workload] graph by removing
// the workload nodes such that, with exception of non-service root nodes, the resulting
// graph has edges only from and to service nodes.
func reduceToServiceGraph(trafficMap graph.TrafficMap) graph.TrafficMap {
	reducedTrafficMap := graph.NewTrafficMap()

	for id, n := range trafficMap {
		if n.NodeType != graph.NodeTypeService {
			// if node isRoot then keep it to better understand traffic flow.
			if val, ok := n.Metadata[graph.IsRoot]; ok && val.(bool) {
				// Remove any edge to a non-service node.  The service graph only shows non-service root
				// nodes, all other nodes are service nodes.  The use case is direct workload-to-workload
				// traffic, which is unusual but possible.  This can lead to nodes with outgoing traffic
				// not represented by an outgoing edge, but that is the nature of the graph type.
				serviceEdges := []*graph.Edge{}
				for _, e := range n.Edges {
					if e.Dest.NodeType == graph.NodeTypeService {
						serviceEdges = append(serviceEdges, e)
					} else {
						log.Tracef("Service graph ignoring non-service root destination [%s]", e.Dest.Workload)
					}
				}
				n.Edges = serviceEdges
				reducedTrafficMap[id] = n
			}
			continue
		}

		// handle service node, add to reduced traffic map and generate new edges
		reducedTrafficMap[id] = n
		workloadEdges := n.Edges
		n.Edges = []*graph.Edge{}
		for _, workloadEdge := range workloadEdges {
			workload := workloadEdge.Dest
			checkNodeType(graph.NodeTypeWorkload, workload)
			for _, serviceEdge := range workload.Edges {
				// As above, ignore edges to non-service destinations
				if serviceEdge.Dest.NodeType != graph.NodeTypeService {
					log.Tracef("Service graph ignoring non-service destination [%s]", serviceEdge.Dest.Workload)
					continue
				}
				childService := serviceEdge.Dest
				var edge *graph.Edge
				for _, e := range n.Edges {
					if childService.ID == e.Dest.ID && serviceEdge.Metadata[graph.ProtocolKey] == e.Metadata[graph.ProtocolKey] {
						edge = e
						break
					}
				}
				if nil == edge {
					n.Edges = append(n.Edges, serviceEdge)
				} else {
					addServiceGraphTraffic(edge, serviceEdge)
				}
			}
		}
	}

	return reducedTrafficMap
}

func addServiceGraphTraffic(toEdge, fromEdge *graph.Edge) {
	graph.AddServiceGraphTraffic(toEdge, fromEdge)

	// handle any appender-based edge data (nothing currently)
	// note: We used to average response times of the aggregated edges but realized that
	// we can't average quantiles (kiali-2297).
}

func checkNodeType(expected string, n *graph.Node) {
	if expected != n.NodeType {
		graph.Error(fmt.Sprintf("Expected nodeType [%s] for node [%+v]", expected, n))
	}
}

// buildNamespaceTrafficMap returns a map of all namespace nodes (key=id).  All
// nodes either directly send and/or receive requests from a node in the namespace.
func buildNamespaceTrafficMap(namespace string, o graph.TelemetryOptions, client *prometheus.Client) graph.TrafficMap {
	// create map to aggregate traffic by protocol and response code
	trafficMap := graph.NewTrafficMap()

	requestsMetric := "istio_requests_total"
	duration := o.Namespaces[namespace].Duration

	// query prometheus for request traffic in three queries:
	// 1) query for traffic originating from "unknown" (i.e. the internet).
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags"
	query := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	unkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &unkVector, o)

	// 2) query for traffic originating from a workload outside of the namespace.  Exclude any "unknown" source telemetry (an unusual corner case)
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace!="%s",source_workload!="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the externally originating request traffic time-series
	extVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &extVector, o)

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)

	// fetch the internally originating request traffic time-series
	intVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &intVector, o)

	// istio component telemetry is only reported destination-side, so we must perform additional queries
	if appender.IncludeIstio(o) {
		istioNamespace := config.Get().IstioNamespace

		// 4) if the target namespace is istioNamespace re-query for traffic originating from outside (other than unknown, covered in query #1)
		if namespace == istioNamespace {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload!="unknown",source_workload_namespace!="%s",destination_service_namespace="%s"} [%vs])) by (%s)`,
				requestsMetric,
				namespace,
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy)

			// fetch the externally originating request traffic time-series
			extIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
			populateTrafficMap(trafficMap, &extIstioVector, o)
		}

		// 5) supplemental query for traffic originating from a workload inside of the namespace with istioSystem destination
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",destination_service_namespace="%s"} [%vs])) by (%s)`,
			requestsMetric,
			namespace,
			istioNamespace,
			int(duration.Seconds()), // range duration for the query
			groupBy)

		// fetch the internally originating request traffic time-series
		intIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMap(trafficMap, &intIstioVector, o)
	}

	// Section for TCP services
	tcpMetric := "istio_tcp_sent_bytes_total"

	// 1) query for traffic originating from "unknown" (i.e. the internet)
	tcpGroupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags"
	query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpUnkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTcp(trafficMap, &tcpUnkVector, o)

	// 2) query for traffic originating from a workload outside of the namespace. Exclude any "unknown" source telemetry (an unusual corner case)
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace!="%s",source_workload!="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpExtVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTcp(trafficMap, &tcpExtVector, o)

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTcp(trafficMap, &tcpInVector, o)

	return trafficMap
}

func populateTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, o graph.TelemetryOptions) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_app"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_app"]
		lDestVer, destVerOk := m["destination_version"]
		lProtocol, protocolOk := m["request_protocol"]
		lCode, codeOk := m["response_code"]
		lFlags, flagsOk := m["response_flags"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !protocolOk || !codeOk || !flagsOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvc := string(lDestSvc)
		destWlNs := string(lDestWlNs)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)
		protocol := string(lProtocol)
		code := string(lCode)
		flags := string(lFlags)

		val := float64(s.Value)

		if o.InjectServiceNodes {
			// don't inject a service node if the dest node is already a service node.  Also, we can't inject if destSvcName is not set.
			destSvcOk = graph.IsOK(destSvc)
			_, destNodeType := graph.Id(destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o.GraphType)
			if destSvcOk && destNodeType != graph.NodeTypeService {
				addTraffic(trafficMap, val, protocol, code, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, "", "", "", "", o)
				addTraffic(trafficMap, val, protocol, code, flags, destSvcNs, destSvc, "", "", "", destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
			} else {
				addTraffic(trafficMap, val, protocol, code, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
			}
		} else {
			addTraffic(trafficMap, val, protocol, code, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
		}
	}
}

func addTraffic(trafficMap graph.TrafficMap, val float64, protocol, code, flags, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer string, o graph.TelemetryOptions) (source, dest *graph.Node) {
	source, sourceFound := addNode(trafficMap, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, o)
	dest, destFound := addNode(trafficMap, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)

	addToDestServices(dest.Metadata, destSvcNs, destSvc)

	var edge *graph.Edge
	for _, e := range source.Edges {
		if dest.ID == e.Dest.ID && e.Metadata[graph.ProtocolKey] == protocol {
			edge = e
			break
		}
	}
	if nil == edge {
		edge = source.AddEdge(dest)
		edge.Metadata[graph.ProtocolKey] = protocol
	}

	// A workload may mistakenly have multiple app and or version label values.
	// This is a misconfiguration we need to handle. See Kiali-1309.
	if sourceFound {
		handleMisconfiguredLabels(source, sourceApp, sourceVer, val, o)
	}
	if destFound {
		handleMisconfiguredLabels(dest, destApp, destVer, val, o)
	}

	graph.AddToMetadata(protocol, val, code, flags, source.Metadata, dest.Metadata, edge.Metadata)

	return source, dest
}

func populateTrafficMapTcp(trafficMap graph.TrafficMap, vector *model.Vector, o graph.TelemetryOptions) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_app"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_app"]
		lDestVer, destVerOk := m["destination_version"]
		lFlags, flagsOk := m["response_flags"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !flagsOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvc := string(lDestSvc)
		destWlNs := string(lDestWlNs)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)
		flags := string(lFlags)

		val := float64(s.Value)

		if o.InjectServiceNodes {
			// don't inject a service node if the dest node is already a service node.  Also, we can't inject if destSvcName is not set.
			destSvcOk = graph.IsOK(destSvc)
			_, destNodeType := graph.Id(destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o.GraphType)
			if destSvcOk && destNodeType != graph.NodeTypeService {
				addTcpTraffic(trafficMap, val, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, "", "", "", "", o)
				addTcpTraffic(trafficMap, val, flags, destSvcNs, destSvc, "", "", "", destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
			} else {
				addTcpTraffic(trafficMap, val, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
			}
		} else {
			addTcpTraffic(trafficMap, val, flags, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)
		}
	}
}

func addTcpTraffic(trafficMap graph.TrafficMap, val float64, flags, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer string, o graph.TelemetryOptions) (source, dest *graph.Node) {
	source, sourceFound := addNode(trafficMap, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, o)
	dest, destFound := addNode(trafficMap, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, o)

	addToDestServices(dest.Metadata, destSvcNs, destSvc)

	var edge *graph.Edge
	for _, e := range source.Edges {
		if dest.ID == e.Dest.ID && e.Metadata[graph.ProtocolKey] == "tcp" {
			edge = e
			break
		}
	}
	if nil == edge {
		edge = source.AddEdge(dest)
		edge.Metadata[graph.ProtocolKey] = "tcp"
	}

	// A workload may mistakenly have multiple app and or version label values.
	// This is a misconfiguration we need to handle. See Kiali-1309.
	if sourceFound {
		handleMisconfiguredLabels(source, sourceApp, sourceVer, val, o)
	}
	if destFound {
		handleMisconfiguredLabels(dest, destApp, destVer, val, o)
	}

	graph.AddToMetadata("tcp", val, "", flags, source.Metadata, dest.Metadata, edge.Metadata)

	return source, dest
}

func addToDestServices(md graph.Metadata, namespace, service string) {
	if !graph.IsOK(service) {
		return
	}
	destServices, ok := md[graph.DestServices]
	if !ok {
		destServices = make(map[string]graph.Service)
		md[graph.DestServices] = destServices
	}
	destService := graph.Service{Namespace: namespace, Name: service}
	destServices.(map[string]graph.Service)[destService.Key()] = destService
}

func handleMisconfiguredLabels(node *graph.Node, app, version string, rate float64, o graph.TelemetryOptions) {
	isVersionedAppGraph := o.GraphType == graph.GraphTypeVersionedApp
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
			node.Metadata[graph.IsMisconfigured] = fmt.Sprintf("labels=%v", labels)
			if rate > 0.0 {
				node.App = app
				node.Version = version
			}
		}
	}
}

func addNode(trafficMap graph.TrafficMap, serviceNs, service, workloadNs, workload, app, version string, o graph.TelemetryOptions) (*graph.Node, bool) {
	id, nodeType := graph.Id(serviceNs, service, workloadNs, workload, app, version, o.GraphType)
	node, found := trafficMap[id]
	if !found {
		namespace := workloadNs
		if !graph.IsOK(namespace) {
			namespace = serviceNs
		}
		newNode := graph.NewNodeExplicit(id, namespace, workload, app, version, service, nodeType, o.GraphType)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}

// BuildNodeTrafficMap is required by the graph/TelemtryVendor interface
func BuildNodeTrafficMap(o graph.TelemetryOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) graph.TrafficMap {
	n := graph.NewNode(o.NodeOptions.Namespace, o.NodeOptions.Service, o.NodeOptions.Namespace, o.NodeOptions.Workload, o.NodeOptions.App, o.NodeOptions.Version, o.GraphType)

	log.Tracef("Build graph for node [%+v]", n)

	appenders := appender.ParseAppenders(o)
	trafficMap := buildNodeTrafficMap(o.NodeOptions.Namespace, n, o, client)

	namespaceInfo := graph.NewAppenderNamespaceInfo(o.NodeOptions.Namespace)

	for _, a := range appenders {
		appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
		a.AppendGraph(trafficMap, globalInfo, namespaceInfo)
		appenderTimer.ObserveDuration()
	}

	// The appenders can add/remove/alter nodes. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the outsiders (i.e. nodes not in the requested namespaces)
	// - mark the traffic generators
	markOutsideOrInaccessible(trafficMap, o)
	markTrafficGenerators(trafficMap)

	// Note that this is where we would call reduceToServiceGraph for graphTypeService but
	// the current decision is to not reduce the node graph to provide more detail.  This may be
	// confusing to users, we'll see...

	return trafficMap
}

// buildNodeTrafficMap returns a map of all nodes requesting or requested by the target node (key=id).
func buildNodeTrafficMap(namespace string, n graph.Node, o graph.TelemetryOptions, client *prometheus.Client) graph.TrafficMap {
	httpMetric := "istio_requests_total"
	interval := o.Namespaces[namespace].Duration

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()

	// query prometheus for request traffic in two queries:
	// 1) query for incoming traffic
	var query string
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_app="%s",destination_version="%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_app="%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		// for service requests we want source reporting to capture source-reported errors.  But unknown only generates destination telemetry.  So
		// perform a special query just to capture [successful] request telemetry from unknown.
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Service,
			int(interval.Seconds()), // range duration for the query
			groupBy)
		vector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMap(trafficMap, &vector, o)

		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Service,
			int(interval.Seconds()), // range duration for the query
			groupBy)
	default:
		graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
	}
	inVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &inVector, o)

	// 2) query for outbound traffic
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s)`,
			httpMetric,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s",source_version="%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		query = ""
	default:
		graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
	}
	outVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &outVector, o)

	// istio component telemetry is only reported destination-side, so we must perform additional queries

	if appender.IncludeIstio(o) {
		istioNamespace := config.Get().IstioNamespace

		// 3) supplemental query for outbound traffic to the istio namespace
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_workload="%s",destination_service_namespace="%s"} [%vs])) by (%s)`,
				httpMetric,
				namespace,
				n.Workload,
				istioNamespace,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		case graph.NodeTypeApp:
			if graph.IsOK(n.Version) {
				query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_app="%s",source_version="%s",destination_service_namespace="%s"} [%vs])) by (%s)`,
					httpMetric,
					namespace,
					n.App,
					n.Version,
					istioNamespace,
					int(interval.Seconds()), // range duration for the query
					groupBy)
			} else {
				query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%s",source_app="%s",destination_service_namespace="%s"} [%vs])) by (%s)`,
					httpMetric,
					namespace,
					n.App,
					istioNamespace,
					int(interval.Seconds()), // range duration for the query
					groupBy)
			}
		case graph.NodeTypeService:
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
				httpMetric,
				istioNamespace,
				n.Service,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		default:
			graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
		}
		outIstioVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMap(trafficMap, &outIstioVector, o)
	}

	// Section for TCP services
	tcpMetric := "istio_tcp_sent_bytes_total"

	tcpGroupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_app="%s",destination_version="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_app="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		}
	case graph.NodeTypeService:
		// TODO: Do we need to handle requests from unknown in a special way (like in HTTP above)? Not sure how tcp is reported from unknown.
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Service,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	default:
		graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
	}
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTcp(trafficMap, &tcpInVector, o)

	// 2) query for outbound traffic
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s",source_version="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s",source_app="%s"} [%vs])) by (%s)`,
				tcpMetric,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		}
	case graph.NodeTypeService:
		query = ""
	default:
		graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
	}
	tcpOutVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTcp(trafficMap, &tcpOutVector, o)

	return trafficMap
}

func promQuery(query string, queryTime time.Time, api prom_v1.API) model.Vector {
	if query == "" {
		return model.Vector{}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Tracef("Graph query:\n%s@time=%v (now=%v, %v)\n", query, queryTime.Format(graph.TF), time.Now().Format(graph.TF), queryTime.Unix())

	promtimer := internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Graph-Generation")
	value, err := api.Query(ctx, query, queryTime)
	graph.CheckError(err)
	promtimer.ObserveDuration() // notice we only collect metrics for successful prom queries

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		graph.Error(fmt.Sprintf("No handling for type %v!\n", t))
	}

	return nil
}
