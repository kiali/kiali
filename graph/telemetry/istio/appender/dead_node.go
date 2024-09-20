package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const DeadNodeAppenderName = "deadNode"

// DeadNodeAppender is responsible for removing from the graph unwanted nodes:
//   - nodes for which there is no traffic reported and a backing workload that can't be found
//     (presumably removed from K8S). (kiali-621)
//   - this includes "unknown"
//   - service nodes that are not service entries (kiali-1526) or egress handlers, and for which
//     there is no incoming traffic or outgoing edge
//
// Name: deadNode
type DeadNodeAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
}

// Name implements Appender
func (a DeadNodeAppender) Name() string {
	return DeadNodeAppenderName
}

// IsFinalizer implements Appender
func (a DeadNodeAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a DeadNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	// Apply dead node removal iteratively until no dead nodes are found.  Removal of dead nodes may
	// alter the graph such that new nodes qualify for dead-ness by being orphaned, lack required
	// outgoing edges, etc.. so we repeat as needed.
	// Should never have to execute more times than the number of nodes in the map, so limit to maxTries
	// to avoid any sort of infinite loop
	maxTries := len(trafficMap)
	applyDeadNodes := true
	for applyDeadNodes && maxTries > 0 {
		applyDeadNodes = a.applyDeadNodes(trafficMap, globalInfo, namespaceInfo) > 0
		maxTries--
	}
	if applyDeadNodes {
		log.Warningf("DeadNodeAppender infinite loop detection! MaxTries=[%v]", maxTries)
	}
}

func (a DeadNodeAppender) applyDeadNodes(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) (numRemoved int) {
	for id, n := range trafficMap {
		isDead := true

		// a node with traffic is not dead, skip
	DefaultCase:
		for _, p := range graph.Protocols {
			for _, r := range p.NodeRates {
				if r.IsIn || r.IsOut {
					if rate, hasRate := n.Metadata[r.Name]; hasRate && rate.(float64) > 0 {
						isDead = false
						break DefaultCase
					}
				}
			}
		}
		if !isDead {
			continue
		}

		switch n.NodeType {
		case graph.NodeTypeAggregate:
			// an aggregate node is never dead
			continue
		case graph.NodeTypeService:
			// a service node with outgoing edges is never considered dead
			if len(n.Edges) > 0 {
				continue
			}

			// A service node that is a service entry is never considered dead
			if _, ok := n.Metadata[graph.IsServiceEntry]; ok {
				continue
			}

			// A service node that is an Istio egress cluster is never considered dead
			if _, ok := n.Metadata[graph.IsEgressCluster]; ok {
				continue
			}

			if isDead {
				delete(trafficMap, id)
				numRemoved++
			}
		default:
			// There are some node types that are never associated with backing workloads (such as versionless app nodes).
			// Nodes of those types are never dead because their workload clearly can't be missing (they don't have workloads).
			// - note: unknown is not saved by this rule (kiali-2078) - i.e. unknown nodes can be declared dead
			if n.NodeType != graph.NodeTypeUnknown && !graph.IsOK(n.Workload) {
				continue
			}

			// If the potential workload is not unknown, but is inaccessible, we can't actually check for its existence, so we
			// need to assume it is valid
			if n.NodeType != graph.NodeTypeUnknown && !a.nodeOK(n) {
				continue
			}

			// Remove if backing workload is not defined (always for "unknown"), flag if there are no pods
			if workload, found := getWorkload(n.Cluster, namespaceInfo.Namespace, n.Workload, globalInfo); !found {
				delete(trafficMap, id)
				numRemoved++
			} else {
				if workload.PodCount == 0 {
					n.Metadata[graph.IsDead] = true
				}
			}
		}
	}

	// If we removed any nodes we need to remove any edges to them as well...
	if numRemoved > 0 {
		for _, n := range trafficMap {
			goodEdges := []*graph.Edge{}
			for _, e := range n.Edges {
				if _, found := trafficMap[e.Dest.ID]; found {
					goodEdges = append(goodEdges, e)
				}
			}
			n.Edges = goodEdges
		}
	}

	return numRemoved
}

// nodeOK returns true if we have access to its workload info
func (a *DeadNodeAppender) nodeOK(node *graph.Node) bool {
	key := graph.GetClusterSensitiveKey(node.Cluster, node.Namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
}
