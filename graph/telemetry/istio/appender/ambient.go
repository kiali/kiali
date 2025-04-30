package appender

import (
	"github.com/kiali/kiali/graph"
	klog "github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/sliceutil"
)

const AmbientAppenderName = "ambient"

// AmbientAppender applies Ambient logic to the graph.
type AmbientAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
	ShowWaypoints        bool
	log                  klog.ContextLogger
}

// Name implements Appender
func (a AmbientAppender) Name() string {
	return AmbientAppenderName
}

// IsFinalizer implements Appender
func (a AmbientAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a AmbientAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	a.log.Trace("Running ambient appender")

	if len(trafficMap) == 0 {
		return
	}

	a.handleWaypoints(trafficMap)
}

// handleWaypoints
func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap) {

	waypointNodes := make(map[string]*graph.Node)
	potentialOrphans := make(map[string]bool)

	// Flag or Delete waypoint nodes in the TrafficMap
	for _, n := range trafficMap {
		if _, ok := n.Metadata[graph.IsWaypoint]; ok {
			waypointNodes[n.ID] = n
			if !a.ShowWaypoints {
				for _, edge := range n.Edges {
					potentialOrphans[edge.Dest.ID] = true
				}
				delete(trafficMap, n.ID)
			} else {
				n.Metadata[graph.IsOutOfMesh] = false
				for _, edge := range n.Edges {
					// edges "from" the waypoint will typically be hidden as part of a bi-directional edge
					edge.Metadata[graph.Waypoint] = &graph.WaypointEdgeInfo{
						Direction: graph.WaypointEdgeDirectionFrom,
					}
				}
			}
		}
	}

	if len(waypointNodes) == 0 {
		return
	}

	for _, n := range trafficMap {
		// If not showing waypoints then delete edges going to a waypoint
		if !a.ShowWaypoints {
			n.Edges = sliceutil.Filter(n.Edges, func(edge *graph.Edge) bool {
				return waypointNodes[edge.Dest.ID] == nil
			})
			if len(n.Edges) == 0 {
				potentialOrphans[n.ID] = true
			}
			continue
		}

		// Otherwise, when we have edges both to and from the waypoint, turn "to" edges into bi-directional edges
		for _, toEdge := range n.Edges {
			if waypoint, found := waypointNodes[toEdge.Dest.ID]; found {
				toWaypointEdgeData := graph.WaypointEdgeInfo{
					Direction: graph.WaypointEdgeDirectionTo,
				}
				for i, fromEdge := range waypoint.Edges {
					if fromEdge.Dest.ID == n.ID {
						toWaypointEdgeData.FromEdge = fromEdge
						waypoint.Edges = append(waypoint.Edges[:i], waypoint.Edges[i+1:]...)
					}
				}
				toEdge.Metadata[graph.Waypoint] = &toWaypointEdgeData
			}
		}
	}

	// after removing waypoints, remove any affected nodes that no longer have incoming or outgoing edges
	if a.ShowWaypoints {
		return
	}

	// don't delete any affected node that still has edges to it
	for _, n := range trafficMap {
		for _, e := range n.Edges {
			potentialOrphans[e.Dest.ID] = false
		}
	}
	// delete affected nodes with no incoming or outgoing edges
	for id, noIncomingEdges := range potentialOrphans {
		if noIncomingEdges && len(trafficMap[id].Edges) == 0 {
			delete(trafficMap, id)
		}
	}
}
