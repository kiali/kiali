// Package istio provides the Istio implementation of graph/TelemetryProvider.
package istio

// Istio.go is responsible for generating TrafficMaps using Istio telemetry.  It implements the
// TelemetryVendor interface.
//
// The algorithm:
//   Step 1) For each namespace:
//     a) Query Prometheus (istio-requests-total metric) to retrieve the source-destination
//        dependencies. Build a traffic map to provide a full representation of nodes and edges.
//
//     b) Apply any requested appenders to alter or append-to the namespace traffic-map.
//
//     c) Merge the namespace traffic-map into the final traffic-map
//
//   Step 2) For the global traffic map
//     a) Apply standard and requested finalizers to alter or append-to the final traffic-map
//
//     b) Convert the final traffic-map to the requested vendor configiration (i.e. Cytoscape) and return
//
// Supports three vendor-specific query parameters:
//   aggregate: Must be a valid metric attribute (default: request_operation)
//   responseTime: Must be one of: avg | 50 | 95 | 99
//   throughputType: request | response (default: response)
//
import (
	"context"
	"crypto/md5"
	"fmt"
	"regexp"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/graph/telemetry/istio/util"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util/sliceutil"
)

const (
	tsHash    graph.MetadataKey = "tsHash"
	tsHashMap graph.MetadataKey = "tsHashMap"
)

var grpcMetric = regexp.MustCompile(`istio_.*_messages`)

// BuildNamespacesTrafficMap is required by the graph/TelemetryVendor interface
func BuildNamespacesTrafficMap(ctx context.Context, o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) graph.TrafficMap {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildNamespacesTrafficMap",
		observability.Attribute("package", "istio"),
	)
	defer end()

	log.Tracef("Build [%s] graph for [%d] namespaces [%v]", o.GraphType, len(o.Namespaces), o.Namespaces)

	appenders, finalizers := appender.ParseAppenders(o)
	trafficMap := graph.NewTrafficMap()

	// To handle ambient telemetry we need to know about the configured waypoints. We typically avoid mixing
	// config with telemetry because config is current and telemetry can be dated.  But for the moment
	// it's unavoidable, as we need to do our best to identify source or dest waypoint workloads.  If in
	// the future we can make that determination via the telem, we should change to that approach.
	if sliceutil.Some(finalizers, func(f graph.Appender) bool {
		return f.Name() == appender.AmbientAppenderName
	}) {
		waypoints := globalInfo.Business.Workload.GetWaypoints(ctx)
		globalInfo.Vendor[appender.AmbientWaypoints] = waypoints
	}

	for _, namespace := range o.Namespaces {
		log.Tracef("Build traffic map for namespace [%v]", namespace)
		namespaceTrafficMap := buildNamespaceTrafficMap(ctx, namespace.Name, o, globalInfo)

		// The appenders can add/remove/alter nodes for the namespace
		namespaceInfo := graph.NewAppenderNamespaceInfo(namespace.Name)
		for _, a := range appenders {
			var appenderEnd observability.EndFunc
			_, appenderEnd = observability.StartSpan(ctx, "Appender "+a.Name(),
				observability.Attribute("package", "istio"),
				observability.Attribute("namespace", namespace.Name),
			)
			appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
			a.AppendGraph(namespaceTrafficMap, globalInfo, namespaceInfo)
			appenderTimer.ObserveDuration()
			appenderEnd()
		}

		// Merge this namespace into the final TrafficMap
		telemetry.MergeTrafficMaps(trafficMap, namespace.Name, namespaceTrafficMap)
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(trafficMap, globalInfo, nil)
	}

	if graph.GraphTypeService == o.GraphType {
		trafficMap = telemetry.ReduceToServiceGraph(trafficMap)
	}

	return trafficMap
}

// buildNamespaceTrafficMap returns a map of all namespace nodes (key=id).  All
// nodes either directly send and/or receive requests from a node in the namespace.
func buildNamespaceTrafficMap(ctx context.Context, namespace string, o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) graph.TrafficMap {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "buildNamespaceTrafficMap",
		observability.Attribute("package", "istio"),
		observability.Attribute("namespace", namespace),
	)
	defer end()

	// create map to aggregate traffic by protocol and response code
	trafficMap := graph.NewTrafficMap()
	duration := o.Namespaces[namespace].Duration
	idleCondition := "> 0"
	if o.IncludeIdleEdges {
		idleCondition = ""
	}
	promApi := globalInfo.PromClient.API()

	// HTTP/GRPC request traffic
	if o.Rates.Http == graph.RateRequests || o.Rates.Grpc == graph.RateRequests {
		metric := "istio_requests_total"
		groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"

		// 0) Incoming: query source telemetry to capture unserviced namespace services' incoming traffic (failed requests that never reach a dest)
		query := fmt.Sprintf(`sum(rate(%s{%s,source_workload_namespace!="%s",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.%s\\..+$"} [%vs])) by (%s) %s`,
			metric,
			util.GetReporter("source", o.Rates),
			namespace,
			namespace,
			int(duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		incomingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
		populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

		// 1) Incoming: query destination telemetry to capture namespace services' incoming traffic
		query = fmt.Sprintf(`sum(rate(%s{%s,destination_workload_namespace="%s"} [%vs])) by (%s) %s`,
			metric,
			util.GetReporter("destination", o.Rates),
			namespace,
			int(duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		incomingVector = promQuery(query, time.Unix(o.QueryTime, 0), promApi)
		populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

		// 2) Outgoing: query source telemetry to capture namespace workloads' outgoing traffic
		query = fmt.Sprintf(`sum(rate(%s{%s,source_workload_namespace="%s"} [%vs])) by (%s) %s`,
			metric,
			util.GetReporter("source", o.Rates),
			namespace,
			int(duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		outgoingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
		populateTrafficMap(trafficMap, &outgoingVector, metric, o, globalInfo)
	}

	// GRPC Message traffic
	if o.Rates.Grpc != graph.RateNone && o.Rates.Grpc != graph.RateRequests {
		var metrics []string
		groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision"

		switch o.Rates.Grpc {
		case graph.RateReceived:
			metrics = []string{"istio_response_messages_total"}
		case graph.RateSent:
			metrics = []string{"istio_request_messages_total"}
		case graph.RateTotal:
			metrics = []string{"istio_request_messages_total", "istio_response_messages_total"}
		default:
			metrics = []string{}
		}

		for _, metric := range metrics {
			// 0) Incoming: query source telemetry to capture unserviced namespace services' incoming traffic
			query := fmt.Sprintf(`sum(rate(%s{%s,source_workload_namespace!="%s",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.%s\\..+$"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("source", o.Rates),
				namespace,
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			incomingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 1) Incoming: query destination telemetry to capture namespace services' incoming traffic	query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s"} [%vs])) by (%s) %s`,
			query = fmt.Sprintf(`sum(rate(%s{%s,destination_workload_namespace="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("destination", o.Rates),
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			incomingVector = promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 2) Outgoing: query source telemetry to capture namespace workloads' outgoing traffic
			query = fmt.Sprintf(`sum(rate(%s{%s,source_workload_namespace="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("source", o.Rates),
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			outgoingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &outgoingVector, metric, o, globalInfo)
		}
	}

	// TCP Byte traffic
	if o.Rates.Tcp != graph.RateNone {
		var metrics []string
		groupBy := "app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags"

		// L4 telemetry is backwards, see https://github.com/istio/istio/issues/32399
		switch o.Rates.Tcp {
		case graph.RateReceived:
			metrics = []string{"istio_tcp_sent_bytes_total"}
		case graph.RateSent:
			metrics = []string{"istio_tcp_received_bytes_total"}
		case graph.RateTotal:
			metrics = []string{"istio_tcp_received_bytes_total", "istio_tcp_sent_bytes_total"}
		default:
			metrics = []string{}
		}

		for _, metric := range metrics {
			// 0) Incoming: query source telemetry to capture unserviced namespace services' incoming traffic
			query := fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace!="%s",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.%s\\..+$"} [%vs])) by (%s) %s`,
				metric,
				util.GetApp(o.Rates),
				util.GetReporter("source", o.Rates),
				namespace,
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			incomingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 1) Incoming: query destination telemetry to capture namespace services' incoming traffic	query = fmt.Sprintf(`sum(rate(%s{reporter="destination",destination_service_namespace="%s"} [%vs])) by (%s) %s`,
			query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_workload_namespace="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetApp(o.Rates),
				util.GetReporter("destination", o.Rates),
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			incomingVector = promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 2) Outgoing: query source telemetry to capture namespace workloads' outgoing traffic
			query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetApp(o.Rates),
				util.GetReporter("source", o.Rates),
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			outgoingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &outgoingVector, metric, o, globalInfo)
		}
	}

	return trafficMap
}

func populateTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, metric string, o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) {
	isRequests := true
	protocol := ""
	switch {
	case grpcMetric.MatchString(metric):
		isRequests = false
		protocol = graph.GRPC.Name
	case strings.HasPrefix(metric, "istio_tcp"):
		isRequests = false
		protocol = graph.TCP.Name
	}
	skipRequestsGrpc := isRequests && o.Rates.Grpc != graph.RateRequests
	skipRequestsHttp := isRequests && o.Rates.Http != graph.RateRequests

	for _, s := range *vector {
		val := float64(s.Value)

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

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvc := string(lDestSvc)

		flags := ""
		if isRequests || protocol == graph.TCP.Name {
			lFlags, flagsOk := m["response_flags"]
			if !flagsOk {
				log.Warningf("Skipping %s, missing expected TS label [flags]", m.String())
				continue
			}
			flags = string(lFlags)
		}
		ztunnel := false
		if protocol == graph.TCP.Name {
			if lApp, appOk := m["app"]; appOk {
				ztunnel = string(lApp) == "ztunnel"
			}
		}

		// handle clusters
		sourceCluster, destCluster := util.HandleClusters(lSourceCluster, sourceClusterOk, lDestCluster, destClusterOk)

		if util.IsBadSourceTelemetry(sourceCluster, sourceClusterOk, sourceWlNs, sourceWl, sourceApp) {
			continue
		}

		// handle unusual destinations
		destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, _ := util.HandleDestination(sourceCluster, sourceWlNs, sourceWl, destCluster, string(lDestSvcNs), string(lDestSvc), string(lDestSvcName), string(lDestWlNs), string(lDestWl), string(lDestApp), string(lDestVer))

		if util.IsBadDestTelemetry(destCluster, destClusterOk, destSvcNs, destSvc, destSvcName, destWl) {
			continue
		}

		var code string
		if isRequests {
			lProtocol, protocolOk := m["request_protocol"]
			lCode, codeOk := m["response_code"]
			lGrpc, grpcOk := m["grpc_response_status"]

			if !protocolOk || !codeOk {
				log.Warningf("Skipping %s, missing expected HTTP/GRPC TS labels", m.String())
				continue
			}

			protocol = string(lProtocol)
			if skipRequestsGrpc && protocol == graph.GRPC.Name || skipRequestsHttp && protocol == graph.HTTP.Name {
				continue
			}

			// set response code in a backward compatible way
			code = util.HandleResponseCode(protocol, string(lCode), grpcOk, string(lGrpc))
		}

		// make code more readable by setting "host" because "destSvc" holds destination.service.host | request.host | "unknown"
		host := destSvc

		// don't inject a service node if any of:
		// - destSvcName is not set
		// - destSvcName is PassthroughCluster (see https://github.com/kiali/kiali/issues/4488)
		// - dest node is already a service node
		// - source or dest workload is an ambient waypoint
		var inject bool
		sourceIsWaypoint, destIsWaypoint := hasWaypoint(ztunnel, sourceCluster, sourceWlNs, sourceWl, destCluster, destWlNs, destWl, globalInfo)
		if o.InjectServiceNodes && graph.IsOK(destSvcName) && destSvcName != graph.PassthroughCluster {
			_, destNodeType, err := graph.Id(destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o.GraphType)
			if err != nil {
				log.Warningf("Skipping %s, %s", m.String(), err)
				continue
			}
			inject = (graph.NodeTypeService != destNodeType) && !sourceIsWaypoint && !destIsWaypoint
		}
		addTraffic(trafficMap, metric, inject, val, protocol, code, flags, host, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, sourceIsWaypoint, destIsWaypoint, o)
	}
}

func addTraffic(trafficMap graph.TrafficMap, metric string, inject bool, val float64, protocol, code, flags, host, sourceCluster, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer string, sourceIsWaypoint, destIsWaypoint bool, o graph.TelemetryOptions) {
	// waypoints are not apps, force it to be a workload regardless of graph type
	if sourceIsWaypoint {
		sourceApp = ""
	}
	source, _, err := addNode(trafficMap, sourceCluster, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, o)
	if err != nil {
		log.Warningf("Skipping addTraffic (source), %s", err)
		return
	}
	if destIsWaypoint {
		destApp = ""
	}
	dest, _, err := addNode(trafficMap, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, o)
	if err != nil {
		log.Warningf("Skipping addTraffic (dest), %s", err)
		return
	}

	if sourceIsWaypoint {
		source.Metadata[graph.IsWaypoint] = true
	}
	if destIsWaypoint {
		dest.Metadata[graph.IsWaypoint] = true
	}

	// Istio can generate duplicate metrics by reporting from both the source and destination proxies. To avoid
	// processing the same information twice we keep track of the time series applied to a particular edge. The
	// edgeTSHash incorporates information about the time series' source, destination and metric information,
	// and uses that unique TS has to protect against applying the same intomation twice.
	edgeTSHash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s", metric, source.Metadata[tsHash], dest.Metadata[tsHash], code, flags, host))))

	if inject {
		injectedService, _, err := addNode(trafficMap, destCluster, destSvcNs, destSvcName, "", "", "", "", o)
		if err != nil {
			log.Warningf("Skipping addTraffic (inject), %s", err)
			return
		}
		injectedService.Metadata[graph.IsInjected] = true
		if addEdgeTraffic(val, protocol, code, flags, host, source, injectedService, edgeTSHash) {
			addToDestServices(injectedService.Metadata, destCluster, destSvcNs, destSvcName)

			addEdgeTraffic(val, protocol, code, flags, host, injectedService, dest, edgeTSHash)
			addToDestServices(dest.Metadata, destCluster, destSvcNs, destSvcName)
		}
	} else {
		if addEdgeTraffic(val, protocol, code, flags, host, source, dest, edgeTSHash) {
			addToDestServices(dest.Metadata, destCluster, destSvcNs, destSvcName)
		}
	}
}

// addEdgeTraffic uses edgeTSHash that the metric information has not been applied to the edge. Returns true
// if the the metric information is applied, false if it determined to be a duplicate.
func addEdgeTraffic(val float64, protocol, code, flags, host string, source, dest *graph.Node, edgeTSHash string) bool {
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
		edge.Metadata[tsHashMap] = make(map[string]bool)
	}

	if _, ok := edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash]; !ok {
		edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash] = true
		graph.AddToMetadata(protocol, val, code, flags, host, source.Metadata, dest.Metadata, edge.Metadata)
		return true
	}

	return false
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

func addNode(trafficMap graph.TrafficMap, cluster, serviceNs, service, workloadNs, workload, app, version string, o graph.TelemetryOptions) (*graph.Node, bool, error) {
	id, nodeType, err := graph.Id(cluster, serviceNs, service, workloadNs, workload, app, version, o.GraphType)
	if err != nil {
		return nil, false, err
	}
	node, found := trafficMap[id]
	if !found {
		namespace := workloadNs
		if !graph.IsOK(namespace) {
			namespace = serviceNs
		}
		newNode := graph.NewNodeExplicit(id, cluster, namespace, workload, app, version, service, nodeType, o.GraphType)
		node = newNode
		trafficMap[id] = node
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version)
	return node, found, nil
}

func timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s", cluster, serviceNs, service, workloadNs, workload, app, version))))
}

// BuildNodeTrafficMap is required by the graph/TelemtryVendor interface
func BuildNodeTrafficMap(o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) (graph.TrafficMap, error) {
	if o.NodeOptions.Aggregate != "" {
		return handleAggregateNodeTrafficMap(o, globalInfo), nil
	}

	n, err := graph.NewNode(o.NodeOptions.Cluster, o.NodeOptions.Namespace, o.NodeOptions.Service, o.NodeOptions.Namespace, o.NodeOptions.Workload, o.NodeOptions.App, o.NodeOptions.Version, o.GraphType)
	if err != nil {
		log.Warningf("Skipping NodeTrafficMap (bad node), %s", err)
		return nil, err
	}

	log.Tracef("Build graph for node [%+v]", n)

	appenders, finalizers := appender.ParseAppenders(o)

	// To handle ambient telemetry we need to know about the configured waypoints. We typically avoid mixing
	// config with telemetry because config is current and telemetry can be dated.  But for the moment
	// it's unavoidable, as we need to do our best to identify source or dest waypoint workloads.  If in
	// the future we can make that determination via the telem, we should change to that approach.
	if sliceutil.Some(finalizers, func(f graph.Appender) bool {
		return f.Name() == appender.AmbientAppenderName
	}) {
		waypoints := globalInfo.Business.Workload.GetWaypoints(context.Background())
		globalInfo.Vendor[appender.AmbientWaypoints] = waypoints
	}

	trafficMap := buildNodeTrafficMap(o.Cluster, o.NodeOptions.Namespace, n, o, globalInfo)

	namespaceInfo := graph.NewAppenderNamespaceInfo(o.NodeOptions.Namespace)

	for _, a := range appenders {
		appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
		a.AppendGraph(trafficMap, globalInfo, namespaceInfo)
		appenderTimer.ObserveDuration()
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(trafficMap, globalInfo, nil)
	}

	// Note that this is where we would call reduceToServiceGraph for graphTypeService but
	// the current decision is to not reduce the node graph to provide more detail.  This may be
	// confusing to users, we'll see...

	return trafficMap, nil
}

// buildNodeTrafficMap returns a map of all nodes requesting or requested by the target node (key=id). Node graphs
// are from the perspective of the node, as such we use destination telemetry for incoming traffic and source telemetry
// for outgoing traffic.
func buildNodeTrafficMap(cluster, namespace string, n *graph.Node, o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) graph.TrafficMap {
	// create map to aggregate traffic by protocol and response code
	trafficMap := graph.NewTrafficMap()
	duration := o.Namespaces[namespace].Duration
	idleCondition := "> 0"
	if o.IncludeIdleEdges {
		idleCondition = ""
	}
	promApi := globalInfo.PromClient.API()

	// only narrow by cluster if it is set on the target node
	var sourceCluster, destCluster string
	if cluster != graph.Unknown {
		sourceCluster = fmt.Sprintf(`,source_cluster="%s"`, cluster)
		destCluster = fmt.Sprintf(`,destination_cluster="%s"`, cluster)
	}

	// HTTP/GRPC Traffic
	if o.Rates.Http == graph.RateRequests || o.Rates.Grpc == graph.RateRequests {
		metric := "istio_requests_total"
		groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"

		// query prometheus for request traffic in two queries:
		// 1) query for incoming traffic
		var query string
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("destination", o.Rates),
				destCluster,
				namespace,
				n.Workload,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
		case graph.NodeTypeApp:
			if graph.IsOK(n.Version) {
				query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_canonical_service="%s",destination_canonical_revision="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("destination", o.Rates),
					destCluster,
					namespace,
					n.App,
					n.Version,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			} else {
				query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_canonical_service="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("destination", o.Rates),
					destCluster,
					namespace,
					n.App,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			}
		case graph.NodeTypeService:
			// Service nodes require two queries for incoming
			// 1.a) query source telemetry for requests to the service that could not be serviced
			query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_workload="unknown",destination_service=~"^%s\\.%s\\..*$"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("source", o.Rates),
				destCluster,
				n.Service,
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			vector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &vector, metric, o, globalInfo)

			// 1.b) query dest telemetry for requests to the service, serviced by service workloads
			query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_service=~"^%s\\.%s\\..*$"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("destination", o.Rates),
				destCluster,
				namespace,
				n.Service,
				namespace,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
		default:
			graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
		}
		inVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
		populateTrafficMap(trafficMap, &inVector, metric, o, globalInfo)

		// 2) query for outbound traffic
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s) %s`,
				metric,
				util.GetReporter("source", o.Rates),
				sourceCluster,
				namespace,
				n.Workload,
				int(duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
		case graph.NodeTypeApp:
			if graph.IsOK(n.Version) {
				query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_canonical_service="%s",source_canonical_revision="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("source", o.Rates),
					sourceCluster,
					namespace,
					n.App,
					n.Version,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			} else {
				query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_canonical_service="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("source", o.Rates),
					sourceCluster,
					namespace,
					n.App,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			}
		case graph.NodeTypeService:
			query = ""
		default:
			graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
		}
		outVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
		populateTrafficMap(trafficMap, &outVector, metric, o, globalInfo)
	}

	// gRPC message traffic
	if o.Rates.Grpc != graph.RateNone && o.Rates.Grpc != graph.RateRequests {
		var metrics []string
		groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision"

		switch o.Rates.Grpc {
		case graph.RateReceived:
			metrics = []string{"istio_response_messages_total"}
		case graph.RateSent:
			metrics = []string{"istio_request_messages_total"}
		case graph.RateTotal:
			metrics = []string{"istio_request_messages_total", "istio_response_messages_total"}
		default:
			metrics = []string{}
		}

		for _, metric := range metrics {
			var query string

			switch n.NodeType {
			case graph.NodeTypeWorkload:
				query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("destination", o.Rates),
					destCluster,
					namespace,
					n.Workload,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			case graph.NodeTypeApp:
				if graph.IsOK(n.Version) {
					query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_canonical_service="%s",destination_canonical_revision="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetReporter("destination", o.Rates),
						destCluster,
						namespace,
						n.App,
						n.Version,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				} else {
					query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_canonical_service="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetReporter("destination", o.Rates),
						destCluster,
						namespace,
						n.App,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				}
			case graph.NodeTypeService:
				// TODO: Do we need to handle requests from unknown in a special way (like in HTTP above)? Not sure how gRPC-messages is reported from unknown.
				query = fmt.Sprintf(`sum(rate(%s{%s%s,destination_service_namespace="%s",destination_service=~"^%s\\.%s\\..*$"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("destination", o.Rates),
					destCluster,
					namespace,
					n.Service,
					namespace,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			default:
				graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
			}
			incomingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 2) query for outbound traffic
			switch n.NodeType {
			case graph.NodeTypeWorkload:
				query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetReporter("source", o.Rates),
					sourceCluster,
					namespace,
					n.Workload,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			case graph.NodeTypeApp:
				if graph.IsOK(n.Version) {
					query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_canonical_service="%s",source_canonical_revision="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetReporter("source", o.Rates),
						sourceCluster,
						namespace,
						n.App,
						n.Version,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				} else {
					query = fmt.Sprintf(`sum(rate(%s{%s%s,source_workload_namespace="%s",source_canonical_service="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetReporter("source", o.Rates),
						sourceCluster,
						namespace,
						n.App,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				}
			case graph.NodeTypeService:
				query = ""
			default:
				graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
			}
			outgoingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &outgoingVector, metric, o, globalInfo)
		}
	}

	// TCP byte traffic
	if o.Rates.Tcp != graph.RateNone {
		var metrics []string
		groupBy := "app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags"

		inboundReporter := `reporter="destination"`
		outboutReporter := `reporter="source"`
		if waypoints, ok := globalInfo.Vendor[appender.AmbientWaypoints]; ok {
			isAWaypoint := sliceutil.Some(waypoints.(models.Workloads), func(wp *models.Workload) bool {
				return isWaypoint(wp, n.Cluster, n.Namespace, n.Workload)
			})
			if isAWaypoint {
				inboundReporter = util.GetReporter("source", o.Rates)
				outboutReporter = util.GetReporter("destination", o.Rates)
			}
		}
		// L4 telemetry is backwards, see https://github.com/istio/istio/issues/32399
		switch o.Rates.Tcp {
		case graph.RateReceived:
			metrics = []string{"istio_tcp_sent_bytes_total"}
		case graph.RateSent:
			metrics = []string{"istio_tcp_received_bytes_total"}
		case graph.RateTotal:
			metrics = []string{"istio_tcp_received_bytes_total", "istio_tcp_sent_bytes_total"}
		default:
			metrics = []string{}
		}

		for _, metric := range metrics {
			var query string

			switch n.NodeType {
			case graph.NodeTypeWorkload:
				query = fmt.Sprintf(`sum(rate(%s{%s%s%s,destination_workload_namespace="%s",destination_workload="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetApp(o.Rates),
					inboundReporter,
					destCluster,
					namespace,
					n.Workload,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			case graph.NodeTypeApp:
				if graph.IsOK(n.Version) {
					query = fmt.Sprintf(`sum(rate(%s{%s%s%s,destination_service_namespace="%s",destination_canonical_service="%s",destination_canonical_revision="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetApp(o.Rates),
						inboundReporter,
						destCluster,
						namespace,
						n.App,
						n.Version,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				} else {
					query = fmt.Sprintf(`sum(rate(%s{%s%s%s,destination_service_namespace="%s",destination_canonical_service="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetApp(o.Rates),
						inboundReporter,
						destCluster,
						namespace,
						n.App,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				}
			case graph.NodeTypeService:
				// TODO: Do we need to handle requests from unknown in a special way (like in HTTP above)? Not sure how tcp is reported from unknown.
				query = fmt.Sprintf(`sum(rate(%s{%s%s%s,destination_service_namespace="%s",destination_service=~"^%s\\.%s\\..*$"} [%vs])) by (%s) %s`,
					metric,
					util.GetApp(o.Rates),
					inboundReporter,
					destCluster,
					namespace,
					n.Service,
					namespace,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			default:
				graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
			}
			incomingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &incomingVector, metric, o, globalInfo)

			// 2) query for outbound traffic
			switch n.NodeType {
			case graph.NodeTypeWorkload:
				query = fmt.Sprintf(`sum(rate(%s{%s%s%s,source_workload_namespace="%s",source_workload="%s"} [%vs])) by (%s) %s`,
					metric,
					util.GetApp(o.Rates),
					outboutReporter,
					sourceCluster,
					namespace,
					n.Workload,
					int(duration.Seconds()), // range duration for the query
					groupBy,
					idleCondition)
			case graph.NodeTypeApp:
				if graph.IsOK(n.Version) {
					query = fmt.Sprintf(`sum(rate(%s{%s%s%s,source_workload_namespace="%s",source_canonical_service="%s",source_canonical_revision="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetApp(o.Rates),
						outboutReporter,
						sourceCluster,
						namespace,
						n.App,
						n.Version,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				} else {
					query = fmt.Sprintf(`sum(rate(%s{%s%s%s,source_workload_namespace="%s",source_canonical_service="%s"} [%vs])) by (%s) %s`,
						metric,
						util.GetApp(o.Rates),
						outboutReporter,
						sourceCluster,
						namespace,
						n.App,
						int(duration.Seconds()), // range duration for the query
						groupBy,
						idleCondition)
				}
			case graph.NodeTypeService:
				query = ""
			default:
				graph.Error(fmt.Sprintf("NodeType [%s] not supported", n.NodeType))
			}
			outgoingVector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
			populateTrafficMap(trafficMap, &outgoingVector, metric, o, globalInfo)
		}
	}

	return trafficMap
}

func handleAggregateNodeTrafficMap(o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) graph.TrafficMap {
	n := graph.NewAggregateNode(o.NodeOptions.Cluster, o.NodeOptions.Namespace, o.NodeOptions.Aggregate, o.NodeOptions.AggregateValue, o.NodeOptions.Service, o.NodeOptions.App)

	log.Tracef("Build graph for aggregate node [%+v]", n)

	if !o.Appenders.All {
		o.Appenders.AppenderNames = append(o.Appenders.AppenderNames, appender.AggregateNodeAppenderName)
	}
	appenders, finalizers := appender.ParseAppenders(o)
	trafficMap := buildAggregateNodeTrafficMap(o.NodeOptions.Namespace, n, o, globalInfo)

	namespaceInfo := graph.NewAppenderNamespaceInfo(o.NodeOptions.Namespace)

	for _, a := range appenders {
		appenderTimer := internalmetrics.GetGraphAppenderTimePrometheusTimer(a.Name())
		a.AppendGraph(trafficMap, globalInfo, namespaceInfo)
		appenderTimer.ObserveDuration()
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(trafficMap, globalInfo, nil)
	}

	return trafficMap
}

// buildAggregateNodeTrafficMap returns a map of all incoming and outgoing traffic from the perspective of the aggregate. Aggregates
// are always generated for serviced requests and therefore via destination telemetry.
func buildAggregateNodeTrafficMap(namespace string, n graph.Node, o graph.TelemetryOptions, globalInfo *graph.GlobalInfo) graph.TrafficMap {
	interval := o.Namespaces[namespace].Duration

	// create map to aggregate traffic by response code
	trafficMap := graph.NewTrafficMap()
	promApi := globalInfo.PromClient.API()

	// It takes only one prometheus query to get everything involving the target operation
	serviceFragment := ""
	if n.Service != "" {
		serviceFragment = fmt.Sprintf(`,destination_service_name="%s"`, n.Service)
	}
	metric := "istio_requests_total"
	groupBy := "source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags"
	httpQuery := fmt.Sprintf(`sum(rate(%s{%s,destination_service_namespace="%s",%s="%s"%s}[%vs])) by (%s) > 0`,
		metric,
		util.GetReporter("destination", o.Rates),
		namespace,
		n.Metadata[graph.Aggregate],
		n.Metadata[graph.AggregateValue],
		serviceFragment,
		int(interval.Seconds()), // range duration for the query
		groupBy)
	/* It's not clear that request classification makes sense for TCP metrics. Because it costs us queries I'm
	   removing the support for now, we can add it back if someone presents a valid use case. (same for gRCP message metrics)
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
	vector := promQuery(query, time.Unix(o.QueryTime, 0), promApi)
	populateTrafficMap(trafficMap, &vector, metric, o, globalInfo)

	return trafficMap
}

// TODO: Can this be combined with graph.telemetry.istio.appender.promQuery?
func promQuery(query string, queryTime time.Time, api prom_v1.API) model.Vector {
	if query == "" {
		return model.Vector{}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// add scope if necessary
	query = util.AddQueryScope(query)

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Tracef("Graph query:\n%s@time=%v (now=%v, %v)\n", query, queryTime.Format(graph.TF), time.Now().Format(graph.TF), queryTime.Unix())

	promtimer := internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Graph-Generation")
	value, warnings, err := api.Query(ctx, query, queryTime)

	if len(warnings) > 0 {
		log.Warningf("promQuery. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	graph.CheckUnavailable(err)
	promtimer.ObserveDuration() // notice we only collect metrics for successful prom queries

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		graph.Error(fmt.Sprintf("No handling for type %v!\n", t))
	}

	return nil
}

// hasWaypoint returns true if the source or dest workload is determined to be a waypoint workload.  Note that this logic can
// go away if and when https://github.com/istio/ztunnel/issues/1128 is implemented, and then we can make this determination
// directly from the telemetry
func hasWaypoint(ztunnel bool, sourceCluster, sourceWlNs, srcWl, destCluster, destWlNs, destWl string, globalInfo *graph.GlobalInfo) (sourceIsWaypoint bool, destIsWaypoint bool) {
	if !ztunnel {
		return false, false
	}

	if waypoints, ok := globalInfo.Vendor[appender.AmbientWaypoints]; ok {
		sourceIsWaypoint = sliceutil.Some(waypoints.(models.Workloads), func(wp *models.Workload) bool {
			return isWaypoint(wp, sourceCluster, sourceWlNs, srcWl)
		})
		if !sourceIsWaypoint {
			destIsWaypoint = sliceutil.Some(waypoints.(models.Workloads), func(wp *models.Workload) bool {
				return isWaypoint(wp, destCluster, destWlNs, destWl)
			})
		}
	}
	return sourceIsWaypoint, destIsWaypoint
}

// isWaypoint returns true if the ns, name and cluster of a workload matches with one of the waypoints in the list
// We need the waypoint list
// NOTE: Skip cluster comparaison if cluster is unknown
func isWaypoint(w *models.Workload, cluster, namespace, name string) bool {
	return w.WorkloadListItem.Name == name && w.WorkloadListItem.Namespace == namespace && (cluster == "unknown" || w.Cluster == cluster)
}
