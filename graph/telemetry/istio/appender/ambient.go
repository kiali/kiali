package appender

import (
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const AmbientAppenderName = "ambient"
const WaypointSuffix = "-istio-waypoint"

type AmbientAppender struct {
	Waypoints bool
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

	if !a.Waypoints {
		a.removeWaypointEntries(trafficMap, globalInfo, namespaceInfo)
	}
}

func (a AmbientAppender) removeWaypointEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {

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
					delete(trafficMap, n.ID)
					break
				}
			}
		}
	}
}
