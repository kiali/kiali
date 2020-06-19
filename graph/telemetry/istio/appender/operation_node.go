package appender

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/util"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	OperationNodeAppenderName = "operationNode"
)

// OperationNodeAppender is responsible for injecting request operation nodes into the graph to gain
// visibility into operation aggregates.
// Name: operation
type OperationNodeAppender struct {
	GraphType          string
	InjectServiceNodes bool
	Namespaces         map[string]graph.NamespaceInfo
	QueryTime          int64 // unix time in seconds
}

// Name implements Appender
func (a OperationNodeAppender) Name() string {
	return OperationNodeAppenderName
}

// AppendGraph implements Appender
func (a OperationNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	if globalInfo.PromClient == nil {
		var err error
		globalInfo.PromClient, err = prometheus.NewClient()
		graph.CheckError(err)
	}

	a.appendGraph(trafficMap, namespaceInfo.Namespace, globalInfo.PromClient)
}

func (a OperationNodeAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	log.Tracef("Resolving request operations for namespace = %v", namespace)
	duration := a.Namespaces[namespace].Duration

	// query prometheus for request_operation info in two queries (only dest telemetry reports op info):
	// 1) query for requests originating from a workload outside the namespace.
	groupBy := fmt.Sprintf("source_workload_namespace,source_workload,source_%s,source_%s,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_%s,destination_%s,request_protocol,response_code,grpc_response_status,response_flags,request_operation", appLabel, verLabel, appLabel, verLabel)
	httpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query := fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// 2) query for requests originating from a workload inside of the namespace
	httpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query = fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// create map to quickly look up securityPolicy
	// securityPolicyMap := make(map[string]PolicyRates)
	a.injectOperations(trafficMap, &outVector)
	a.injectOperations(trafficMap, &inVector)
}

func (a OperationNodeAppender) injectOperations(trafficMap graph.TrafficMap, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m[model.LabelName("source_"+appLabel)]
		lSourceVer, sourceVerOk := m[model.LabelName("source_"+verLabel)]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m[model.LabelName("destination_"+appLabel)]
		lDestVer, destVerOk := m[model.LabelName("destination_"+verLabel)]
		lCode, _ := m["response_code"]             // will be missing for TCP
		lGrpc, grpcOk := m["grpc_response_status"] // will be missing for non-GRPC
		lFlags, flagsOk := m["response_flags"]
		lProtocol, protocolOk := m["request_protocol"]
		lOperation, operationOk := m["request_operation"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !flagsOk || !operationOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destWlNs := string(lDestWlNs)
		destSvc := string(lDestSvc)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)
		code := string(lCode)
		protocol := string(lProtocol)
		flags := string(lFlags)
		operation := string(lOperation)

		if util.IsBadSourceTelemetry(sourceWlNs, sourceWl, sourceApp) {
			continue
		}

		if protocolOk {
			// set response code in a backward compatible way
			code = util.HandleResponseCode(protocol, code, grpcOk, string(lGrpc))
		} else {
			protocol = "tcp"
		}

		// handle multicluster requests
		destSvcNs, destSvcName := util.HandleMultiClusterRequest(sourceWlNs, sourceWl, string(lDestSvcNs), string(lDestSvcName))

		if util.IsBadDestTelemetry(destSvc, destSvcName, destWl) {
			continue
		}

		// make code more readable by setting "host" because "destSvc" holds destination.service.host | request.host | "unknown"
		host := destSvc

		val := float64(s.Value)

		// inject operation node between source and destination
		sourceID, _ := graph.Id(sourceWlNs, "", sourceWlNs, sourceWl, sourceApp, sourceVer, a.GraphType)
		sourceNode, sourceFound := trafficMap[sourceID]
		if !sourceFound {
			log.Warningf("Expected source [%s] node not found in traffic map. Skipping aggregate injection [%s]", sourceID, operation)
			continue
		}

		// if service nodes are injected show the service-related aggregation:
		//   - use the service node as the dest
		//   - replace the non-classified edge (fromsource to service) with the classified edges
		//     - note that if not every request has a classification match the traffic may be lower than actual, I
		//     - this this OK, and if the user cares they should define a "catch-all" classification match
		// else show the independent aggregation by using the workload/app node as the dest
		destID := ""
		var opNode *graph.Node
		if a.InjectServiceNodes {
			destID, _ = graph.Id(destSvcNs, destSvcName, "", "", "", "", a.GraphType) // service
			opNode, _ = addNode(trafficMap, destSvcNs, operation, destSvcName)
			opNode.App = destApp
		} else {
			destID, _ = graph.Id(destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, a.GraphType) // wl/app
			opNode, _ = addNode(trafficMap, destWlNs, operation, "")
		}
		destNode, destFound := trafficMap[destID]
		if !destFound {
			log.Warningf("Expected dest [%s] node not found in traffic map. Skipping aggregate injection [%s]", destID, operation)
			continue
		}

		if a.InjectServiceNodes {
			safeEdges := []*graph.Edge{}
			for _, e := range sourceNode.Edges {
				if e.Dest.ID != destID {
					safeEdges = append(safeEdges, e)
				}
			}
			sourceNode.Edges = safeEdges
		}

		addTraffic(val, protocol, code, flags, host, sourceNode, opNode)
		addTraffic(val, protocol, code, flags, host, opNode, destNode)
	}
}

func addTraffic(val float64, protocol, code, flags, host string, source, dest *graph.Node) {
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

	graph.AddToMetadata(protocol, val, code, flags, host, source.Metadata, dest.Metadata, edge.Metadata)
}

func addNode(trafficMap graph.TrafficMap, namespace, op, svcName string) (*graph.Node, bool) {
	id := graph.AggregateID(namespace, graph.AggregateTypeOp, op, svcName)
	node, found := trafficMap[id]
	if !found {
		newNode := graph.NewAggregateNodeExplicit(id, namespace, graph.AggregateTypeOp, op)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}
