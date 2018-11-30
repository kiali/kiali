package appender

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
)

const DeadNodeAppenderName = "deadNode"

// DeadNodeAppender is responsible for removing from the graph unwanted nodes:
// - nodes for which there is no traffic reported and the related schema is missing
//   (presumably removed from K8S). (kiali-621)
// - service nodes that are not service entries (kiali-1526) and for which there is no incoming
//   error traffic and no outgoing edges (kiali-1326).
// Name: deadNode
type DeadNodeAppender struct{}

// Name implements Appender
func (a DeadNodeAppender) Name() string {
	return DeadNodeAppenderName
}

// AppendGraph implements Appender
func (a DeadNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	var err error
	if globalInfo.Business == nil {
		globalInfo.Business, err = business.Get()
		checkError(err)
	}
	if namespaceInfo.WorkloadList == nil {
		workloadList, err := globalInfo.Business.Workload.GetWorkloadList(namespaceInfo.Namespace)
		checkError(err)
		namespaceInfo.WorkloadList = &workloadList
	}

	a.applyDeadNodes(trafficMap, globalInfo, namespaceInfo)
}

func (a DeadNodeAppender) applyDeadNodes(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	numRemoved := 0
	for id, n := range trafficMap {
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			continue
		case graph.NodeTypeService:
			// a service node with outgoing edges is never considered dead (or egress)
			if len(n.Edges) > 0 {
				continue
			}

			// A service node that is a service entry is never considered dead
			if _, ok := n.Metadata["isServiceEntry"]; ok {
				continue
			}

			// a service node with no incoming error traffic and no outgoing edges, is dead.
			// Incoming non-error traffic can not raise the dead because it is caused by an
			// edge case (pod life-cycle change) that we don't want to see.
			rate4xx, hasRate4xx := n.Metadata["rate4xx"]
			rate5xx, hasRate5xx := n.Metadata["rate5xx"]
			if (!hasRate4xx || rate4xx.(float64) == 0) && (!hasRate5xx || rate5xx.(float64) == 0) {
				delete(trafficMap, id)
				numRemoved++
			}
		default:
			// a node with HTTP traffic is not dead, skip
			rate, hasRate := n.Metadata["rate"]
			rateOut, hasRateOut := n.Metadata["rateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node with TCP Sent traffic is not dead, skip
			rate, hasRate = n.Metadata["tcpSentRate"]
			rateOut, hasRateOut = n.Metadata["tcpSentRateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node w/o a valid workload is a versionless app node and can't be dead
			if n.Workload == "" || n.Workload == graph.UnknownWorkload {
				continue
			}

			// Remove if backing workload is not defined, flag if there are no pods
			if workload, found := getWorkload(n.Workload, namespaceInfo.WorkloadList); !found {
				delete(trafficMap, id)
				numRemoved++
			} else {
				if workload.PodCount == 0 {
					n.Metadata["isDead"] = true
				}
			}
		}
	}

	// If we removed any nodes we need to remove any edges to them as well...
	if numRemoved == 0 {
		return
	}

	for _, s := range trafficMap {
		goodEdges := []*graph.Edge{}
		for _, e := range s.Edges {
			if _, found := trafficMap[e.Dest.ID]; found {
				goodEdges = append(goodEdges, e)
			}
		}
		s.Edges = goodEdges
	}
}
