package appender

import (
	"context"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
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

	a.handleWaypoints(trafficMap, globalInfo, namespaceInfo)
}

// handleWaypoints remove the node and the edges to waypoints when show waypoints is not specified
func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {

	workloadList := globalInfo.Business.Workload.GetWaypointsList(context.Background())

	// To identify the waypoint edges
	waypointList := make(map[string]map[string]string)

	for _, n := range trafficMap {
		// skip if the node is not in an accessible namespace, we can't do the checking
		if !a.nodeOK(n) {
			continue
		}

		// It could be a waypoint proxy
		var workloadName string
		if n.Workload != "" {
			workloadName = n.Workload
		} else {
			workloadName = n.App
		}
		if isWaypoint(&workloadList, n.Cluster, n.Namespace, workloadName) {
			if waypointList[n.Cluster] == nil {
				waypointList[n.Cluster] = make(map[string]string)
			}
			waypointList[n.Cluster][n.Namespace] = workloadName
			if !a.ShowWaypoints {
				delete(trafficMap, n.ID)
			} else {
				n.Metadata[graph.IsWaypoint] = true
				n.Metadata[graph.IsOutOfMesh] = false
			}
		}
	}
	for _, n := range trafficMap {
		graphEdge := []*graph.Edge{}
		for _, edge := range n.Edges {
			wp := waypointList[edge.Dest.Cluster][edge.Dest.Namespace]
			if wp != edge.Dest.App {
				// When we don't show waypoints
				// We hide one edge direction from the waypoints
				// To prevent infinite loops on highlight
				wpSource := waypointList[edge.Source.Cluster][edge.Source.Namespace]
				if a.ShowWaypoints || (!a.ShowWaypoints && wpSource != edge.Source.App) {
					graphEdge = append(graphEdge, edge)
				}
			}
		}
		n.Edges = graphEdge
	}
}

// nodeOK returns true if we have access to its workload info
func (a *AmbientAppender) nodeOK(node *graph.Node) bool {
	key := graph.GetClusterSensitiveKey(node.Cluster, node.Namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
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
