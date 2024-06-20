package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const AmbientAppenderName = "ambient"
const WaypointSuffix = "waypoint"

// AmbientAppender adds all the Ambient logic to the graph
// handleWaypoint Identifies the waypoint proxies
// based on the name (Optmization) and verifies by getting the workload
// and then, checking the labels
// handleWaypoint removes the waypoint proxies when ShowWaypoint is false
type AmbientAppender struct {
	ShowWaypoints bool
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

func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo) {

	// To identify the waypoint edges
	waypoinList := []string{}

	for _, n := range trafficMap {
		// It could be a waypoint proxy
		var workloadName string
		if n.Workload != "" {
			workloadName = n.Workload
		} else {
			workloadName = n.App
		}
		workload, found := getWorkload(n.Cluster, n.Namespace, workloadName, globalInfo)
		if !found {
			log.Tracef("Error getting waypoint proxy: Workload %s was not found", n.Workload)
			continue
		}
		if config.IsWaypoint(workload.Labels) {
			waypoinList = append(waypoinList, workload.Name)
			if !a.ShowWaypoints {
				delete(trafficMap, n.ID)
				break
			} else {
				n.Metadata[graph.IsWaypoint] = true
				n.Metadata[graph.IsOutOfMesh] = false
				break
			}
		}
	}
	for _, n := range trafficMap {
		graphEdge := []*graph.Edge{}
		for _, edge := range n.Edges {
			if !contains(waypoinList, edge.Dest.App) {
				// When we don't show waypoints
				// We hide one edge direction from the waypoints
				// To prevent infinite loops on highlight
				if a.ShowWaypoints || (!a.ShowWaypoints && !contains(waypoinList, edge.Source.App)) {
					graphEdge = append(graphEdge, edge)
				}
			}
		}
		n.Edges = graphEdge
	}
}

func contains(slice []string, str string) bool {
	for _, v := range slice {
		if v == str {
			return true
		}
	}
	return false
}
