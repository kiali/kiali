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

	deletedWaypoints := make(map[string]bool)

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
			if !a.ShowWaypoints {
				deletedWaypoints[n.ID] = true
				delete(trafficMap, n.ID)
			} else {
				n.Metadata[graph.IsOutOfMesh] = false
				n.Metadata[graph.IsWaypoint] = true
				n.Edges = []*graph.Edge{}
			}
		}
	}

	if len(deletedWaypoints) > 0 {
		for _, n := range trafficMap {
			n.Edges = sliceutil.Filter(n.Edges, func(edge *graph.Edge) bool {
				return !deletedWaypoints[edge.Dest.ID]
			})
		}
	}
}

/* Currently not needed as it no longer protects against an invalid backend call.

// nodeOK returns true if we have access to its workload info
func (a *AmbientAppender) nodeOK(node *graph.Node) bool {
	key := graph.GetClusterSensitiveKey(node.Cluster, node.Namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
}
*/

// isWaypoint returns true if the ns, name and cluster of a workload matches with one of the waypoints in the list
func isWaypoint(waypointList *models.Workloads, cluster, namespace, app string) bool {
	for _, w := range *waypointList {
		if w.WorkloadListItem.Name == app && w.WorkloadListItem.Namespace == namespace && w.Cluster == cluster {
			return true
		}
	}
	return false
}
