package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"

	"k8s.io/apimachinery/pkg/labels"
)

// DeadNodeAppender is responsible for removing from the graph any nodes for which
// there is no traffic reported and the related definitions are undefined (presumably
// removed from K8S). (kiali-621)
type DeadNodeAppender struct{}

// AppendGraph implements Appender
func (a DeadNodeAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	istioClient, err := kubernetes.NewClient()
	checkError(err)

	applyDeadNodes(trafficMap, istioClient)
}

func applyDeadNodes(trafficMap graph.TrafficMap, istioClient kubernetes.IstioClientInterface) {
	numRemoved := 0
	for id, n := range trafficMap {
		// a node with traffic is not dead, skip
		rate, hasRate := n.Metadata["rate"]
		rateOut, hasRateOut := n.Metadata["rateOut"]
		if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
			continue
		}
		// Remove if backing deployment is not defined, flag if there are no pods
		// Note that in the future a workload could feasibly be back by something
		// other than a deployment; we may need to query the workload name againts
		// various possibly entities.
		deployment, err := istioClient.GetDeployment(n.Namespace, n.Workload)
		if err != nil || deployment == nil {
			delete(trafficMap, id)
			numRemoved++
		} else {
			pods, err := istioClient.GetPods(n.Namespace, labels.Set(deployment.Spec.Selector.MatchLabels).String())
			if err != nil || pods == nil || len(pods.Items) == 0 {
				n.Metadata["isDead"] = true
			}
		}
	}

	// If we removed any nodes we need to remove any edges to them as well...
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
