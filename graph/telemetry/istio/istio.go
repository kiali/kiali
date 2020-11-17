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
// Supports two vendor-specific query parameters:
//   aggregate: Must be a valid metric attribute (default: request_operation)
//   responseTimeQuantile: Must be a valid quantile (default: 0.95)
//
import (
	"context"
	"fmt"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/graph/telemetry/istio/util"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// BuildNamespacesTrafficMap is required by the graph/TelemtryVendor interface
func BuildNamespacesTrafficMap(o graph.TelemetryOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) graph.TrafficMap {
	log.Tracef("Build [%s] graph for [%d] namespaces [%v]", o.GraphType, len(o.Namespaces), o.Namespaces)

	appenders := appender.ParseAppenders(o)
	trafficMap := graph.NewTrafficMap()

	for _, namespace := range o.Namespaces {
		log.Tracef("Build traffic map for namespace [%v]", namespace)
		namespaceTrafficMap := buildNamespaceTrafficMap(namespace.Name, o, client)
		namespaceInfo := graph.NewAppenderNamespaceInfo(namespace.Name)
		for _, a := range appenders {
			appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
			a.AppendGraph(namespaceTrafficMap, globalInfo, namespaceInfo)
			appenderTimer.ObserveDuration()
		}
		telemetry.MergeTrafficMaps(trafficMap, namespace.Name, namespaceTrafficMap)
	}

	// The appenders can add/remove/alter nodes. After the manipulations are complete
	// we can make some final adjustments:
	// - mark the outsiders (i.e. nodes not in the requested namespaces)
	// - mark the insider traffic generators (i.e. inside the namespace and only outgoing edges)
	telemetry.MarkOutsideOrInaccessible(trafficMap, o)
	telemetry.MarkTrafficGenerators(trafficMap)

	if graph.GraphTypeService == o.GraphType {
		trafficMap = telemetry.ReduceToServiceGraph(trafficMap)
	}

	return trafficMap
}

// buildNamespaceTrafficMap returns a map of all namespace nodes (key=id).  All
// nodes either directly send and/or receive requests from a node in the namespace.
func buildNamespaceTrafficMap(namespace string, o graph.TelemetryOptions, client *prometheus.Client) graph.TrafficMap {
	// create map to aggregate traffic by protocol and response code
	trafficMap := graph.NewTrafficMap()

	requestsMetric := "istio_requests_total"
	duration := o.Namespaces[namespace].Duration

	// query prometheus for request traffic in three queries:
	// 1) query for traffic originating from "unknown" (i.e. the internet). Unknown sources have no istio sidecar so
	//    it is destination telemetry. Here we use destination_workload_namespace because destination telemetry
	//    always provides the workload namespace, and because destination_service_namespace is provided from the source,
	//    and for a request originating on a different cluster, will be set to the namespace where the service-entry is
	//    defined, on the other cluster.
	groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"
	query := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_workload_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	unkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &unkVector, o)

	// 2) query for external traffic, originating from a workload outside of the namespace.  Exclude any "unknown" source telemetry (an unusual corner
	//	  case resulting from pod lifecycle changes).  Here use destination_service_workload to capture failed requests never reaching a dest workload.
	reporter := "source"
	sourceWorkloadNamespaceQuery := fmt.Sprintf(`source_workload_namespace!="%s"`, namespace)
	query = fmt.Sprintf(`sum(rate(%s{reporter="%s",%s,source_workload!="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		reporter,
		sourceWorkloadNamespaceQuery,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	extVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &extVector, o)

	// 3) query for internal traffic, originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s"} [%vs])) by (%s)`,
		requestsMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	intVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &intVector, o)

	// Section for TCP services (note, there is no TCP Istio traffic)
	tcpMetric := "istio_tcp_sent_bytes_total"

	// 1) query for traffic originating from "unknown" (i.e. the internet)
	tcpGroupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags"
	query = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload="unknown",destination_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpUnkVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTCP(trafficMap, &tcpUnkVector, o)

	// 2) query for traffic originating from a workload outside of the namespace. Exclude any "unknown" source telemetry (an unusual corner case)
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace!="%s",source_workload!="unknown",destination_service_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpExtVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTCP(trafficMap, &tcpExtVector, o)

	// 3) query for traffic originating from a workload inside of the namespace
	query = fmt.Sprintf(`sum(rate(%s{reporter="source",source_workload_namespace="%s"} [%vs])) by (%s)`,
		tcpMetric,
		namespace,
		int(duration.Seconds()), // range duration for the query
		tcpGroupBy)
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTCP(trafficMap, &tcpInVector, o)

	return trafficMap
}

func populateTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, o graph.TelemetryOptions) {
	for _, s := range *vector {
		m := s.Metric
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_canonical_service"]
		lSourceVer, sourceVerOk := m["source_canonical_revision"]
		lDestCluster, destClusterOk := m["destination_cluster"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_canonical_service"]
		lDestVer, destVerOk := m["destination_canonical_revision"]
		lProtocol, protocolOk := m["request_protocol"]
		lCode, codeOk := m["response_code"]
		lGrpc, grpcOk := m["grpc_response_status"]
		lFlags, flagsOk := m["response_flags"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !protocolOk || !codeOk || !flagsOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvc := string(lDestSvc)
		protocol := string(lProtocol)
		code := string(lCode)
		flags := string(lFlags)

		if util.IsBadSourceTelemetry(lSourceCluster, sourceClusterOk, sourceWlNs, sourceWl, sourceApp) {
			continue
		}

		// handle clusters
		sourceCluster, destCluster := util.HandleClusters(lSourceCluster, sourceClusterOk, lDestCluster, destClusterOk)

		// set response code in a backward compatible way
		code = util.HandleResponseCode(protocol, code, grpcOk, string(lGrpc))

		// handle unusual destinations
		destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, _ := util.HandleDestination(sourceWlNs, sourceWl, string(lDestSvcNs), string(lDestSvc), string(lDestSvcName), string(lDestWlNs), string(lDestWl), string(lDestApp), string(lDestVer))

		if util.IsBadDestTelemetry(lDestCluster, destClusterOk, destSvc, destSvcName, destWl) {
			continue
		}

		// make code more readable by setting "host" because "destSvc" holds destination.service.host | request.host | "unknown"
		host := destSvc

		val := float64(s.Value)

		// don't inject a service node if destSvcName is not set or the dest node is already a service node.
		inject := false
		if o.InjectServiceNodes && graph.IsOK(destSvcName) {
			_, destNodeType := graph.Id(destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o.GraphType)
			inject = (graph.NodeTypeService != destNodeType)
		}
		if inject {
			addTraffic(trafficMap, val, protocol, code, flags, host, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, "", "", "", "", o)
			addTraffic(trafficMap, val, protocol, code, flags, host, destCluster, destSvcNs, destSvcName, "", "", "", destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)
		} else {
			addTraffic(trafficMap, val, protocol, code, flags, host, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)
		}
	}
}

func addTraffic(trafficMap graph.TrafficMap, val float64, protocol, code, flags, host, sourceCluster, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer string, o graph.TelemetryOptions) (source, dest *graph.Node) {
	source, sourceFound := addNode(trafficMap, sourceCluster, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, o)
	dest, destFound := addNode(trafficMap, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)

	addToDestServices(dest.Metadata, destCluster, destSvcNs, destSvcName)

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
	// TODO: remove this support when canonical fields are guaranteed (i.e. minimum Istio >= 1.5)
	if sourceFound {
		handleMisconfiguredLabels(source, sourceApp, sourceVer, val, o)
	}
	if destFound {
		handleMisconfiguredLabels(dest, destApp, destVer, val, o)
	}

	graph.AddToMetadata(protocol, val, code, flags, host, source.Metadata, dest.Metadata, edge.Metadata)

	return source, dest
}

func populateTrafficMapTCP(trafficMap graph.TrafficMap, vector *model.Vector, o graph.TelemetryOptions) {
	for _, s := range *vector {
		m := s.Metric
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_canonical_service"]
		lSourceVer, sourceVerOk := m["source_canonical_revision"]
		lDestCluster, destClusterOk := m["destination_cluster"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_canonical_service"]
		lDestVer, destVerOk := m["destination_canonical_revision"]
		lFlags, flagsOk := m["response_flags"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !flagsOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvc := string(lDestSvc)
		flags := string(lFlags)

		if util.IsBadSourceTelemetry(lSourceCluster, sourceClusterOk, sourceWlNs, sourceWl, sourceApp) {
			continue
		}

		// handle clusters
		sourceCluster, destCluster := util.HandleClusters(lSourceCluster, sourceClusterOk, lDestCluster, destClusterOk)

		// handle unusual destinations
		destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, _ := util.HandleDestination(sourceWlNs, sourceWl, string(lDestSvcNs), string(lDestSvc), string(lDestSvcName), string(lDestWlNs), string(lDestWl), string(lDestApp), string(lDestVer))

		if util.IsBadDestTelemetry(lDestCluster, destClusterOk, destSvc, destSvcName, destWl) {
			continue
		}

		// make code more readable by setting "host" because "destSvc" holds destination.service.host | "unknown"
		host := destSvc

		val := float64(s.Value)

		// don't inject a service node if destSvcName is not set or the dest node is already a service node.
		inject := false
		if o.InjectServiceNodes && graph.IsOK(destSvcName) {
			_, destNodeType := graph.Id(destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o.GraphType)
			inject = (graph.NodeTypeService != destNodeType)
		}
		if inject {
			addTCPTraffic(trafficMap, val, flags, host, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, "", "", "", "", o)
			addTCPTraffic(trafficMap, val, flags, host, destCluster, destSvcNs, destSvcName, "", "", "", destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)
		} else {
			addTCPTraffic(trafficMap, val, flags, host, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)
		}
	}
}

func addTCPTraffic(trafficMap graph.TrafficMap, val float64, flags, host, sourceCluster, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer string, o graph.TelemetryOptions) (source, dest *graph.Node) {
	source, sourceFound := addNode(trafficMap, sourceCluster, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, o)
	dest, destFound := addNode(trafficMap, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)

	addToDestServices(dest.Metadata, destCluster, destSvcNs, destSvcName)

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

	graph.AddToMetadata("tcp", val, "", flags, host, source.Metadata, dest.Metadata, edge.Metadata)

	return source, dest
}

func addToDestServices(md graph.Metadata, cluster, namespace, service string) {
	if !graph.IsOK(service) {
		return
	}
	destServices, ok := md[graph.DestServices]
	if !ok {
		destServices = graph.NewDestServicesMetadata()
		md[graph.DestServices] = destServices
	}
	destService := graph.ServiceName{Cluster: cluster, Namespace: namespace, Name: service}
	destServices.(graph.DestServicesMetadata)[destService.Key()] = destService
}

func handleMisconfiguredLabels(node *graph.Node, app, version string, rate float64, o graph.TelemetryOptions) {
	isVersionedAppGraph := o.GraphType == graph.GraphTypeVersionedApp
	isWorkloadNode := node.NodeType == graph.NodeTypeWorkload
	isVersionedAppNode := node.NodeType == graph.NodeTypeApp && isVersionedAppGraph
	if isWorkloadNode || isVersionedAppNode {
		labels := []string{}
		if node.App != app {
			labels = append(labels, "canonical_service")
		}
		if node.Version != version {
			labels = append(labels, "canonical_revision")
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

func addNode(trafficMap graph.TrafficMap, cluster, serviceNs, service, workloadNs, workload, app, version string, o graph.TelemetryOptions) (*graph.Node, bool) {
	id, nodeType := graph.Id(cluster, serviceNs, service, workloadNs, workload, app, version, o.GraphType)
	node, found := trafficMap[id]
	if !found {
		namespace := workloadNs
		if !graph.IsOK(namespace) {
			namespace = serviceNs
		}
		newNode := graph.NewNodeExplicit(id, cluster, namespace, workload, app, version, service, nodeType, o.GraphType)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}

// BuildNodeTrafficMap is required by the graph/TelemtryVendor interface
func BuildNodeTrafficMap(o graph.TelemetryOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) graph.TrafficMap {
	if o.NodeOptions.Aggregate != "" {
		return handleAggregateNodeTrafficMap(o, client, globalInfo)
	}

	n := graph.NewNode(o.NodeOptions.Cluster, o.NodeOptions.Namespace, o.NodeOptions.Service, o.NodeOptions.Namespace, o.NodeOptions.Workload, o.NodeOptions.App, o.NodeOptions.Version, o.GraphType)

	log.Tracef("Build graph for node [%+v]", n)

	appenders := appender.ParseAppenders(o)
	trafficMap := buildNodeTrafficMap(o.Cluster, o.NodeOptions.Namespace, n, o, client)

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
	telemetry.MarkOutsideOrInaccessible(trafficMap, o)
	telemetry.MarkTrafficGenerators(trafficMap)

	// Note that this is where we would call reduceToServiceGraph for graphTypeService but
	// the current decision is to not reduce the node graph to provide more detail.  This may be
	// confusing to users, we'll see...

	return trafficMap
}

// buildNodeTrafficMap returns a map of all nodes requesting or requested by the target node (key=id). Node graphs
// are from the perspective of the node, as such we use destination telemetry for incoming traffic and source telemetry
// for outgoing traffic.
func buildNodeTrafficMap(cluster, namespace string, n graph.Node, o graph.TelemetryOptions, client *prometheus.Client) graph.TrafficMap {
	httpMetric := "istio_requests_total"
	interval := o.Namespaces[namespace].Duration

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()

	// only narrow by cluster if it is set on the target node
	var sourceCluster, destCluster string
	if cluster != graph.Unknown {
		sourceCluster = fmt.Sprintf(",source_cluster=%s", cluster)
		destCluster = fmt.Sprintf(",destination_cluster=%s", cluster)
	}
	// query prometheus for request traffic in two queries:
	// 1) query for incoming traffic
	var query string
	groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination"%s,destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s)`,
			httpMetric,
			destCluster,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination"%s,destination_service_namespace="%s",destination_canonical_service="%s",destination_canonical_revision="%s"} [%vs])) by (%s)`,
				httpMetric,
				destCluster,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="destination"%s,destination_service_namespace="%s",destination_canonical_service="%s"} [%vs])) by (%s)`,
				httpMetric,
				destCluster,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		}
	case graph.NodeTypeService:
		// for service requests we want source reporting to capture source-reported errors.  But unknown only generates destination telemetry.  So
		// perform a special query just to capture [successful] request telemetry from unknown.
		query = fmt.Sprintf(`sum(rate(%s{reporter="destination"%s,source_workload="unknown",destination_workload_namespace="%s",destination_service_name=~"%s|%s\\..+\\.global"} [%vs])) by (%s)`,
			httpMetric,
			sourceCluster,
			namespace,
			n.Service,
			n.Service,
			int(interval.Seconds()), // range duration for the query
			groupBy)
		vector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
		populateTrafficMap(trafficMap, &vector, o)

		query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,destination_service_namespace="%s",destination_service_name=~"%s|%s\\..+\\.global"} [%vs])) by (%s)`,
			httpMetric,
			destCluster,
			namespace,
			n.Service,
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
		query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s)`,
			httpMetric,
			sourceCluster,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			groupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_canonical_service="%s",source_canonical_revision="%s"} [%vs])) by (%s)`,
				httpMetric,
				sourceCluster,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				groupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_canonical_service="%s"} [%vs])) by (%s)`,
				httpMetric,
				sourceCluster,
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

	// Section for TCP services, note there is no TCP Istio traffic (although not typical but it is possible an appcould be deployed to istio's ns)
	tcpMetric := "istio_tcp_sent_bytes_total"

	tcpGroupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags"
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			destCluster,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,destination_service_namespace="%s",destination_canonical_service="%s",destination_canonical_revision="%s"} [%vs])) by (%s)`,
				tcpMetric,
				destCluster,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,destination_service_namespace="%s",destination_canonical_service="%s"} [%vs])) by (%s)`,
				tcpMetric,
				destCluster,
				namespace,
				n.App,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		}
	case graph.NodeTypeService:
		// TODO: Do we need to handle requests from unknown in a special way (like in HTTP above)? Not sure how tcp is reported from unknown.
		query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,destination_service_namespace="%s",destination_service_name="%s"} [%vs])) by (%s)`,
			tcpMetric,
			destCluster,
			namespace,
			n.Service,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	default:
		graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
	}
	tcpInVector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMapTCP(trafficMap, &tcpInVector, o)

	// 2) query for outbound traffic
	switch n.NodeType {
	case graph.NodeTypeWorkload:
		query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s)`,
			tcpMetric,
			sourceCluster,
			namespace,
			n.Workload,
			int(interval.Seconds()), // range duration for the query
			tcpGroupBy)
	case graph.NodeTypeApp:
		if graph.IsOK(n.Version) {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_canonical_service="%s",source_canonical_revision="%s"} [%vs])) by (%s)`,
				tcpMetric,
				sourceCluster,
				namespace,
				n.App,
				n.Version,
				int(interval.Seconds()), // range duration for the query
				tcpGroupBy)
		} else {
			query = fmt.Sprintf(`sum(rate(%s{reporter="source"%s,source_workload_namespace="%s",source_canonical_service="%s"} [%vs])) by (%s)`,
				tcpMetric,
				sourceCluster,
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
	populateTrafficMapTCP(trafficMap, &tcpOutVector, o)

	return trafficMap
}

func handleAggregateNodeTrafficMap(o graph.TelemetryOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) graph.TrafficMap {
	n := graph.NewAggregateNode(o.NodeOptions.Cluster, o.NodeOptions.Namespace, o.NodeOptions.Aggregate, o.NodeOptions.AggregateValue, o.NodeOptions.Service, o.NodeOptions.App)

	log.Tracef("Build graph for aggregate node [%+v]", n)

	if !o.Appenders.All {
		o.Appenders.AppenderNames = append(o.Appenders.AppenderNames, appender.AggregateNodeAppenderName)
	}
	appenders := appender.ParseAppenders(o)
	trafficMap := buildAggregateNodeTrafficMap(o.NodeOptions.Namespace, n, o, client)

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
	telemetry.MarkOutsideOrInaccessible(trafficMap, o)
	telemetry.MarkTrafficGenerators(trafficMap)

	return trafficMap
}

// buildAggregateNodeTrafficMap returns a map of all incoming and outgoing traffic from the perspective of the aggregate. Aggregates
// are always generated for complete requests and therefore via destination telemetry.
func buildAggregateNodeTrafficMap(namespace string, n graph.Node, o graph.TelemetryOptions, client *prometheus.Client) graph.TrafficMap {
	interval := o.Namespaces[namespace].Duration

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()

	// It takes only one prometheus query to get everything involving the target operation
	serviceFragment := ""
	if n.Service != "" {
		serviceFragment = fmt.Sprintf(`,destination_service_name="%s"`, n.Service)
	}
	groupBy := "source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"
	httpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",%s="%s"%s}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		n.Metadata[graph.Aggregate],
		n.Metadata[graph.AggregateValue],
		serviceFragment,
		int(interval.Seconds()), // range duration for the query
		groupBy)
	/* It's not clear that request classification makes sense for TCP metrics. Because it costs us queries I'm
	   removing the support for now, we can add it back if someone presents a valid use case.
	tcpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s",%s="%s"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		n.Metadata[graph.Aggregate],
		n.Metadata[graph.AggregateValue],
		int(interval.Seconds()), // range duration for the query
		groupBy)
	query := fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	*/
	query := httpQuery
	vector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())
	populateTrafficMap(trafficMap, &vector, o)

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
