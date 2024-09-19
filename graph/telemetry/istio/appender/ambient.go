package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/sliceutil"
)

const AmbientAppenderName = "ambient"
const WaypointFrom = "from"
const WaypointTo = "to"

// AmbientAppender applies Ambient logic to the graph.
type AmbientAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
	ShowWaypoints        bool
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
	log.Trace("Running ambient appender")

	if len(trafficMap) == 0 {
		return
	}

	// We may not actually need these now that things are flagged in the base graph gen
	/*
		waypoints, ok := globalInfo.Vendor[AmbientWaypoints]
		if !ok {
			return
		}
	*/

	a.handleWaypoints(trafficMap)
}

// handleWaypoints
func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap) {

	waypointNodes := make(map[string]*graph.Node)

	// Flag or Delete waypoint nodes in the TrafficMap
	for _, n := range trafficMap {
		if _, ok := n.Metadata[graph.IsWaypoint]; ok {
			waypointNodes[n.ID] = n
			if !a.ShowWaypoints {
				delete(trafficMap, n.ID)
			} else {
				n.Metadata[graph.IsOutOfMesh] = false
				for _, edge := range n.Edges {
					// Just hide so we have all the information
					edge.Metadata[graph.Waypoint] = WaypointFrom
				}
			}
		}
	}

	if len(waypointNodes) == 0 {
		return
	}

	for _, n := range trafficMap {
		// Delete edges
		if !a.ShowWaypoints {
			n.Edges = sliceutil.Filter(n.Edges, func(edge *graph.Edge) bool {
				return waypointNodes[edge.Dest.ID] == nil
			})
			continue
		}

		// Find duplicates
		for _, edge := range n.Edges {
			if waypointNodes[edge.Dest.ID] != nil {
				edge.Metadata[graph.Waypoint] = WaypointTo
				for _, waypointEdge := range waypointNodes[edge.Dest.ID].Edges {
					if waypointEdge.Dest.ID == n.ID {
						edge.Metadata[graph.WaypointFrom] = waypointEdge
					}
				}
			}
		}

	}
}
