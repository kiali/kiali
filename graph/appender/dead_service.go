package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// DeadServiceAppender is responsible for removing from the graph any service nodes for which
// the service is undefined (presumably removed from K8S) and for which there is
// no traffic reported. (kiali-621)
type DeadServiceAppender struct{}

// AppendGraph implements Appender
func (a DeadServiceAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	istioClient, err := kubernetes.NewClient()
	checkError(err)

	applyDeadServices(trafficMap, istioClient)
}

func applyDeadServices(trafficMap graph.TrafficMap, istioClient kubernetes.IstioClientInterface) {
	numRemoved := 0
	for id, s := range trafficMap {
		// a service with traffic is not dead, skip
		rateIn, hasRateIn := s.Metadata["rateIn"]
		rateOut, hasRateOut := s.Metadata["rateOut"]
		if (hasRateIn && rateIn.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
			continue
		}
		// remove if there is no backing service, flag if there are no pods
		istioService, err := istioClient.GetService(s.Namespace, s.ServiceName)
		if err != nil || istioService == nil {
			log.Debugf("Removing dead service: %s (%s)", s.Name, s.Version)
			delete(trafficMap, id)
			numRemoved++
		} else {
			servicePods, err := istioClient.GetServicePods(s.Namespace, s.ServiceName, s.Version)
			if err != nil || servicePods == nil || len(servicePods.Items) == 0 {
				s.Metadata["isDead"] = true
			}
		}
	}

	// If we removed any services we need to remove any edges to them as well...
	if numRemoved == 0 {
		return
	}

	for _, s := range trafficMap {
		goodEdges := []*graph.Edge{}
		for _, e := range s.Edges {
			if _, found := trafficMap[e.Dest.ID]; found {
				goodEdges = append(goodEdges, e)
			}
		}
		s.Edges = goodEdges
	}
}
