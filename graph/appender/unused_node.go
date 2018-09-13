package appender

import (
	"k8s.io/api/apps/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type UnusedNodeAppender struct {
	GraphType string
}

// AppendGraph implements Appender
func (a UnusedNodeAppender) AppendGraph(trafficMap graph.TrafficMap, namespace string) {
	istioClient, err := kubernetes.NewClient()
	checkError(err)

	deployments, err := istioClient.GetDeployments(namespace, "")
	checkError(err)

	a.addUnusedNodes(trafficMap, namespace, deployments)
}

func (a UnusedNodeAppender) addUnusedNodes(trafficMap graph.TrafficMap, namespace string, deployments *v1beta1.DeploymentList) {
	unusedTrafficMap := a.buildUnusedTrafficMap(trafficMap, namespace, deployments)

	// If trafficMap is empty just populate it with the unused nodes and return
	if len(trafficMap) == 0 {
		for k, v := range unusedTrafficMap {
			trafficMap[k] = v
		}
		return
	}

	// Integrate the unused nodes into the existing traffic map
	for _, v := range unusedTrafficMap {
		addUnusedNodeToTrafficMap(trafficMap, v)
	}
}

func (a UnusedNodeAppender) buildUnusedTrafficMap(trafficMap graph.TrafficMap, namespace string, deployments *v1beta1.DeploymentList) graph.TrafficMap {
	unusedTrafficMap := graph.NewTrafficMap()
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName
	for _, d := range deployments.Items {
		labels := d.GetLabels()
		app := graph.UnknownApp
		version := graph.UnknownVersion
		if v, ok := labels[appLabel]; ok {
			app = v
		}
		if v, ok := labels[versionLabel]; ok {
			version = v
		}
		id, nodeType := graph.Id(namespace, d.Name, app, version, "", a.GraphType)
		if _, found := trafficMap[id]; !found {
			if _, found = unusedTrafficMap[id]; !found {
				log.Debugf("Adding unused node for deployment [%s] with labels [%v]", d.Name, labels)
				node := graph.NewNodeExplicit(id, namespace, d.Name, app, version, "", nodeType, a.GraphType)
				node.Metadata = map[string]interface{}{"rate": 0.0, "rateOut": 0.0, "isUnused": true}
				unusedTrafficMap[id] = &node
			}
		}
	}
	return unusedTrafficMap
}

func addUnusedNodeToTrafficMap(trafficMap graph.TrafficMap, unusedNode *graph.Node) {
	// add unused node to traffic map
	trafficMap[unusedNode.ID] = unusedNode

	// Add a "sibling" edge to any node with an edge to the same app
	for _, n := range trafficMap {
		findAndAddSibling(n, unusedNode)
	}
}

func findAndAddSibling(parent, unusedNode *graph.Node) {
	if unusedNode.App == graph.UnknownApp {
		return
	}

	found := false
	for _, edge := range parent.Edges {
		if found = edge.Dest.App == unusedNode.App; found {
			break
		}
	}
	if found {
		parent.AddEdge(unusedNode)
	}
}
