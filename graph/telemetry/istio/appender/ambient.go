package appender

import (
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const AmbientAppenderName = "ambient"
const WaypointSuffix = "waypoint"

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

	a.handleWaypoints(trafficMap, globalInfo, !a.Waypoints)
}

func (a AmbientAppender) handleWaypoints(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, remove bool) {

	for name, n := range trafficMap {

		// It could be a waypoint proxy
		if strings.HasSuffix(name, WaypointSuffix) {
			var workloadName string
			if n.Workload != "" {
				workloadName = n.Workload
			} else {
				workloadName = n.App
			}
			workload, found := getWorkload(n.Cluster, n.Namespace, workloadName, globalInfo)
			if !found {
				log.Errorf("Error getting waypoint proxy: Workload %s was not found", n.Workload)
				continue
			}
			for k, l := range workload.Labels {
				if k == config.WaypointLabel && l == config.WaypointLabelValue {
					if remove {
						delete(trafficMap, n.ID)
						break
					} else {
						n.Metadata[graph.IsWaypoint] = true
						n.Metadata[graph.IsOutOfMesh] = false
						break
					}
				}
			}
		}

		if !a.ShowWaypoints {
			graphEdge := []*graph.Edge{}
			for _, edge := range n.Edges {
				if !strings.HasSuffix(edge.Dest.App, WaypointSuffix) && !strings.HasSuffix(edge.Source.App, WaypointSuffix) {
					graphEdge = append(graphEdge, edge)
				}
			}
			n.Edges = graphEdge
		}
	}
}
