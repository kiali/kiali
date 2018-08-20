package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"

	"k8s.io/apimachinery/pkg/labels"
)

// DeadNodeAppender is responsible for removing from the graph unwanted nodes:
// - nodes for which there is no traffic reported and the related schema is missing
//   (presumably removed from K8S). (kiali-621)
// - service nodes for which there is no incoming error traffic and no outgoing
//   edges (kiali-1326)
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
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			continue
		case graph.NodeTypeService:
			// a service node with no incoming error traffic and no outgoing edges, is dead.
			// Incoming non-error traffic can not raise the dead because it is caused by an
			// edge case (pod life-cycle change) that we don't want to see.
			rate4xx, hasRate4xx := n.Metadata["rate4xx"]
			rate5xx, hasRate5xx := n.Metadata["rate5xx"]
			numOutEdges := len(n.Edges)
			if numOutEdges == 0 && (!hasRate4xx || rate4xx.(float64) == 0) && (!hasRate5xx || rate5xx.(float64) == 0) {
				delete(trafficMap, id)
				numRemoved++
			}
		default:
			// a node with HTTP traffic is not dead, skip
			rate, hasRate := n.Metadata["rate"]
			rateOut, hasRateOut := n.Metadata["rateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node with TCP Sent traffic is not dead, skip
			rate, hasRate = n.Metadata["tcpSentRate"]
			rateOut, hasRateOut = n.Metadata["tcpSentRateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node w/o a valid workload is a versionless app node and can't be dead
			if n.Workload == "" || n.Workload == graph.UnknownWorkload {
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
