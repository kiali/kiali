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

	// **** JUST SKIP AND RETURN FOR NOW, WE'LL COME BACK TO THIS....
	// ***************************************************************
	if len(trafficMap) == 0 || true {
		return
	}

	log.Trace("Running ambient appender")

	a.handleWaypoints(trafficMap, globalInfo)
}

// handleWaypoint identifies waypoint proxies quickly by name, and then validates
// and then verifies by fetching the workload and checking labels.  It removes waypoint proxies
// when ShowWaypoints is false
// handleWaypoints flags or deletes waypoints, depending on the a.showWaypoints flag.  When showing waypoints we
// remove outgoing edges from the waypoints, to simplify the graph and avoid highlight-looping.
func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo) {

	// Fetch the waypoint workloads. This is cached information, so no need to hold this in AppenderGlobalInfo
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
				continue
			}

			// Find duplicates
			for _, edge := range n.Edges {
				if waypointNodes[edge.Dest.ID] {
					edge.Metadata[graph.Display] = "reverse"
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
