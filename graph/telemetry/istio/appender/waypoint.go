package appender

import (
	"context"
	"strings"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const WaypointAppenderName = "hideWaypoint"
const WaypointSuffix = "-istio-waypoint"

type WaypointAppender struct {
	GraphType string
}

// Name implements Appender
func (a WaypointAppender) Name() string {
	return WaypointAppenderName
}

// IsFinalizer implements Appender
func (a WaypointAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a WaypointAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	log.Trace("Running hide waypoint entry appender")
	a.removeWaypointEntries(trafficMap, globalInfo, namespaceInfo)
}

func (a WaypointAppender) removeWaypointEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {

	for _, n := range trafficMap {

		// It could be a waypoint proxy
		if strings.HasSuffix(n.Workload, WaypointSuffix) {
			workload, err := globalInfo.Business.Workload.GetWorkload(context.Background(), business.WorkloadCriteria{
				Cluster:      n.Cluster,
				Namespace:    n.Namespace,
				WorkloadName: n.Workload})
			if err != nil {
				log.Errorf("Error getting workload %s: %s", n.Workload, err.Error())
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
