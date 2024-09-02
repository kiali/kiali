package appender

import (
	"context"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
)

const AmbientAppenderName = "ambient"
const WaypointSuffix = "waypoint"

// AmbientAppender adds all the Ambient logic to the graph
// handleWaypoint Identifies the waypoint proxies
// based on the name (Optmization) and verifies by getting the workload
// and then, checking the labels
// handleWaypoint removes the waypoint proxies when ShowWaypoint is false
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
func (a AmbientAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	log.Trace("Running ambient appender")

	a.handleWaypoints(trafficMap, globalInfo)
}

// handleWaypoints flags or deletes waypoints, depending on the a.showWaypoints flag.  When showing waypoints we
// remove outgoing edges from the waypoints, to simplify the graph and avoid highlight-looping.
func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo) {

	// Fetch the waypoint workloads
	waypoints := globalInfo.Business.Workload.GetWaypoints(context.Background())
	waypointNodes := make(map[string]bool)

	// Flag or Delete waypoint nodes in the TrafficMap
	for _, n := range trafficMap {
		waypointName := n.Workload
		if waypointName == "" {
			waypointName = n.App
		}
		if waypointName == "" {
			waypointName = n.Service
		}
		if isWaypoint(&waypoints, n.Cluster, n.Namespace, waypointName) {

			waypointNodes[n.ID] = true
			if !a.ShowWaypoints {
				delete(trafficMap, n.ID)
			} else {
				n.Metadata[graph.IsOutOfMesh] = false
				n.Metadata[graph.IsWaypoint] = true
				// Hide one of the edges to the waypoint.
				// Later, mark the opposite edge as reverse
				for _, edge := range n.Edges {
					// Just hide so we have all the information
					edge.Metadata[graph.Display] = "hide"
				}
			}
		}
	}

	if len(waypointNodes) > 0 {
		for _, n := range trafficMap {
			// Delete edges
			if !a.ShowWaypoints {
				n.Edges = sliceutil.Filter(n.Edges, func(edge *graph.Edge) bool {
					return !waypointNodes[edge.Dest.ID]
				})
			}

			for i, edge := range n.Edges {
				// If show the waypoint, mark the edges to be drawn bidirectionally
				if a.ShowWaypoints {
					if waypointNodes[edge.Dest.ID] {
						edge.Metadata[graph.Display] = "reverse"
					}
				}
				// Find duplicate edges (TCP and HTTP)
				for j, comparedEdge := range n.Edges {
					if i != j && edge.Dest.ID == comparedEdge.Dest.ID && edge.Metadata[graph.Display] == nil {
						edge.Metadata[graph.Display] = "multiple"
						comparedEdge.Metadata[graph.Display] = "hide"
					}
				}
			}
		}
	}
}

// isWaypoint returns true if the ns, name and cluster of a workload matches with one of the waypoints in the list
func isWaypoint(waypointList *models.Workloads, cluster, namespace, app string) bool {
	for _, w := range *waypointList {
		if w.WorkloadListItem.Name == app && w.WorkloadListItem.Namespace == namespace && w.Cluster == cluster {
			return true
		}
	}
	return false
}
