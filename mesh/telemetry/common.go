// Package telemtry contains telemetry provider implementations as well as common code that can be
// shared by each telemetry vendor.  Istio vendor is the canonical impl.
package telemetry

import (
	"fmt"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

// MergeTrafficMaps typically combines two namespace traffic maps. It ensures that we only
// have unique nodes by removing duplicate nodes and merging their edges.  When removing a
// duplicate prefer an instance from the namespace being merged-in because it is guaranteed
// to have all appender information applied (i.e. not an outsider). We also need to avoid duplicate
// edges, it can happen when a terminal node of one namespace is a root node of another:
// - ns1 graph: unknown -> ns1:A -> ns2:B
// - ns2 graph:   ns1:A -> ns2:B -> ns2:C
func MergeTrafficMaps(trafficMap graph.TrafficMap, ns string, nsTrafficMap graph.TrafficMap) {
	for nsID, nsNode := range nsTrafficMap {
		if node, isDup := trafficMap[nsID]; isDup {
			if nsNode.Namespace == ns {
				// prefer nsNode (see above comment), so do a swap
				trafficMap[nsID] = nsNode
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
			trafficMap[nsID] = nsNode
		}
	}
}

// ReduceToServiceGraph compresses a [service-injected workload] graph by removing
// the workload nodes such that, with exception of non-service root nodes, the resulting
// graph has edges only from and to service nodes.  It is typically the last thing called
// prior to returning the service graph.
func ReduceToServiceGraph(trafficMap graph.TrafficMap) graph.TrafficMap {
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
				// if there are no outgoing edges to a service then ignore the node
				if len(serviceEdges) == 0 {
					log.Tracef("Service graph ignoring non-service root [%s]", n.Workload)
					continue
				}
				// reset the outgoing traffic and add the surviving edge metadata
				graph.ResetOutgoingMetadata(n.Metadata)
				for _, edgeToService := range serviceEdges {
					graph.AddOutgoingEdgeToMetadata(n.Metadata, edgeToService.Metadata)
				}
				n.Edges = serviceEdges
				reducedTrafficMap[id] = n
			}
			continue
		}

		// now, handle a service node, add to reduced traffic map, generate new edges, and reset outgoing
		// traffic to just that traffic to other services.
		reducedTrafficMap[id] = n

		// reset outgoing traffic for the service node.   Terminating traffic is lost but that is the nature
		// of the graph, which aims to show service-to-service interaction.
		graph.ResetOutgoingMetadata(n.Metadata)

		// eliminate the edges to workload nodes, resetting their outgoing edges to the source service
		workloadEdges := n.Edges
		n.Edges = []*graph.Edge{} // reset source service edges
		for _, edgeToWorkload := range workloadEdges {
			destWorkload := edgeToWorkload.Dest
			checkNodeType(graph.NodeTypeWorkload, destWorkload)
			for _, edgeToService := range destWorkload.Edges {
				// As above, ignore edges to non-service destinations
				if edgeToService.Dest.NodeType != graph.NodeTypeService {
					log.Tracef("Service graph ignoring non-service destination [%s:%s]", edgeToService.Dest.NodeType, edgeToService.Dest.Workload)
					continue
				}
				destService := edgeToService.Dest
				var edge *graph.Edge
				for _, e := range n.Edges {
					if destService.ID == e.Dest.ID && edgeToService.Metadata[graph.ProtocolKey] == e.Metadata[graph.ProtocolKey] {
						edge = e
						break
					}
				}
				if nil == edge {
					edgeToService.Source = n
					n.Edges = append(n.Edges, edgeToService)
					graph.AddOutgoingEdgeToMetadata(n.Metadata, edgeToService.Metadata)
				} else {
					addServiceGraphTraffic(edge, edgeToService)
				}
			}
		}
	}

	return reducedTrafficMap
}

func addServiceGraphTraffic(toEdge, fromEdge *graph.Edge) {
	graph.AddOutgoingEdgeToMetadata(toEdge.Source.Metadata, fromEdge.Metadata)
	graph.AggregateEdgeTraffic(fromEdge, toEdge)

	// handle any appender-based edge data (nothing currently)
	// note: We used to average response times of the aggregated edges but realized that
	// we can't average quantiles (kiali-2297).
}

func checkNodeType(expected string, n *graph.Node) {
	if expected != n.NodeType {
		graph.Error(fmt.Sprintf("Expected nodeType [%s] for node [%+v]", expected, n))
	}
}
