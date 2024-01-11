package appender

import (
	"context"
	"strings"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const AmbientAppenderName = "ambient"
const WaypointSuffix = "-istio-waypoint"

// In case of need more graph customizations for Ambient
// The new parameter should be added here
const (
	WaypointParameterName = "hideWaypoint"
)

type AmbientAppender struct {
	AmbientParams map[string]bool
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

	log.Trace("Running hide waypoint entry appender")

	for param, enabled := range a.AmbientParams {
		if a.AmbientParams[param] == enabled {
			// In case of need more graph customizations for Ambient
			// The new parameter should be handled here
			switch param {
			case WaypointParameterName:
				a.removeWaypointEntries(trafficMap, globalInfo, namespaceInfo)
			default:
				log.Errorf("Invalid appender name: %s", param)
			}
		}
	}
}

func (a AmbientAppender) removeWaypointEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {

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
