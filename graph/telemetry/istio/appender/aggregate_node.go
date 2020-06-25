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
	AggregateNodeAppenderName = "aggregateNode"
)

// AggregateNodeAppender is responsible for injecting aggregate nodes into the graph to gain
// visibility into traffic aggregations for a user-specfied metric attribute.
type AggregateNodeAppender struct {
	Aggregate          string
	GraphType          string
	InjectServiceNodes bool
	Namespaces         map[string]graph.NamespaceInfo
	QueryTime          int64 // unix time in seconds
}

// Name implements Appender
func (a AggregateNodeAppender) Name() string {
	return AggregateNodeAppenderName
}

// AppendGraph implements Appender
func (a AggregateNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
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

func (a AggregateNodeAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	log.Tracef("Resolving request aggregates for namespace = %v", namespace)
	duration := a.Namespaces[namespace].Duration

	// query prometheus for aggregate info in two queries (assume aggregation is typically request classification, so use dest telemetry):
	//   note1: we want to only match the aggregate when it is set and not "unknown".  But in Prometheus a negative test on an unset label
	//      matches everything, so using %s!=unknown mneans we still have to filter out unset time-series below...
	//   note2: for now we will filter out aggregates with no traffic on the assumption that users probably don't want to
	//      see them and it will just increase the graph density.  To change that behavior remove the "> 0" conditions.
	// 1) query for requests originating from a workload outside the namespace.
	groupBy := fmt.Sprintf("source_workload_namespace,source_workload,source_%s,source_%s,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_%s,destination_%s,request_protocol,response_code,grpc_response_status,response_flags,%s", appLabel, verLabel, appLabel, verLabel, a.Aggregate)
	httpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",%s!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		namespace,
		a.Aggregate,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",%s!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		namespace,
		a.Aggregate,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query := fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	vector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)
	a.injectAggregates(trafficMap, &vector)

	// 2) query for requests originating from a workload inside of the namespace
	httpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",%s!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		a.Aggregate,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",%s!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		a.Aggregate,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query = fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	vector = promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)
	a.injectAggregates(trafficMap, &vector)
}

func (a AggregateNodeAppender) injectAggregates(trafficMap graph.TrafficMap, vector *model.Vector) {
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
		lAggregate, aggregateOk := m[model.LabelName(a.Aggregate)] // may be unset, see note above

		if !aggregateOk {
			continue
		}

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !flagsOk {
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
		aggregate := string(lAggregate)

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

		// inject aggregate node between source and destination
		sourceID, _ := graph.Id(sourceWlNs, "", sourceWlNs, sourceWl, sourceApp, sourceVer, a.GraphType)
		sourceNode, sourceFound := trafficMap[sourceID]
		if !sourceFound {
			log.Warningf("Expected source [%s] node not found in traffic map. Skipping aggregate injection [%s]", sourceID, aggregate)
			continue
		}

		// if service nodes are injected show the service-related aggregation:
		//   - use the service node as the dest
		//   - replace the non-classified edge (from source to service) with the classified edges
		//     - note that if not every request has a classification match the traffic may be lower than actual, I
		//       think this this OK, and if the user cares they should define a "catch-all" classification match
		// else show the independent aggregation by using the workload/app node as the dest
		destID := ""
		var aggrNode *graph.Node
		if a.InjectServiceNodes {
			destID, _ = graph.Id(destSvcNs, destSvcName, "", "", "", "", a.GraphType) // service
			aggrNode, _ = addNode(trafficMap, destSvcNs, a.Aggregate, aggregate, destSvcName)
			aggrNode.App = destApp
		} else {
			destID, _ = graph.Id(destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, a.GraphType) // wl/app
			aggrNode, _ = addNode(trafficMap, destWlNs, a.Aggregate, aggregate, "")
		}
		destNode, destFound := trafficMap[destID]
		if !destFound {
			log.Warningf("Expected dest [%s] node not found in traffic map. Skipping aggregate injection [%s]", destID, aggregate)
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

		addTraffic(val, protocol, code, flags, host, sourceNode, aggrNode)
		addTraffic(val, protocol, code, flags, host, aggrNode, destNode)
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

	// Only update traffic on the aggregate node and associated edges.  Remember that this is an appender and the
	// in/out traffic is already set for the non-aggregate nodes.
	var sourceMetadata graph.Metadata
	var destMetadata graph.Metadata
	if source.NodeType == graph.NodeTypeAggregate {
		sourceMetadata = source.Metadata
	} else {
		destMetadata = dest.Metadata
	}
	graph.AddToMetadata(protocol, val, code, flags, host, sourceMetadata, destMetadata, edge.Metadata)
}

func addNode(trafficMap graph.TrafficMap, namespace, aggregate, aggregateVal, svcName string) (*graph.Node, bool) {
	id := graph.AggregateID(namespace, aggregate, aggregateVal, svcName)
	node, found := trafficMap[id]
	if !found {
		newNode := graph.NewAggregateNodeExplicit(id, namespace, aggregate, aggregateVal)
		node = &newNode
		trafficMap[id] = node
	}
	return node, found
}
