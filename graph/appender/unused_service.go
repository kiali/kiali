package appender

import (
	"fmt"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
)

type UnusedServiceAppender struct {
}

// AppendGraph implements Appender
func (a UnusedServiceAppender) AppendGraph(trafficMap graph.TrafficMap, namespaceName string) {
	istioClient, err := kubernetes.NewClient()
	checkError(err)

	cfg := config.Get()
	labels := cfg.ServiceFilterLabelName + "," + cfg.VersionFilterLabelName
	pods, err := istioClient.GetPods(namespaceName, labels)
	checkError(err)

	addUnusedNodes(trafficMap, namespaceName, pods)
}

func addUnusedNodes(trafficMap graph.TrafficMap, namespaceName string, pods *v1.PodList) {
	staticNodeList := buildStaticNodeList(namespaceName, pods)
	currentNodeSet := make(map[string]struct{})
	buildNodeSet(&currentNodeSet, trafficMap)

	// Empty trafficMap, no traffic in whole namespace, so we create a default trafficMap with the static info
	if len(currentNodeSet) == 0 {
		buildDefaultTrafficMap(trafficMap, &staticNodeList)
		return
	}

	// There is traffic in the namespace, so we need to check if we have nodes without traffic
	for i := 0; i < len(staticNodeList); i++ {
		// Node found in the static list but with no traffic, it should be added to the trafficMap
		if _, ok := currentNodeSet[staticNodeList[i].ID]; !ok {
			addNodeToTrafficMap(trafficMap, staticNodeList[i])
		}
	}
}

func buildStaticNodeList(namespaceName string, pods *v1.PodList) []*graph.Node {
	nonTrafficList := make([]*graph.Node, 0)
	resolvedServices := make(map[string]bool)
	appLabel := config.Get().ServiceFilterLabelName
	versionLabel := config.Get().VersionFilterLabelName
	identityDomain := config.Get().ExternalServices.Istio.IstioIdentityDomain
	// FIX this...
	for _, pod := range pods.Items {
		app := pod.GetObjectMeta().GetLabels()[appLabel]
		version := pod.GetObjectMeta().GetLabels()[versionLabel]
		srvId := fmt.Sprintf("%s.%s.%s.%s", app, namespaceName, identityDomain, version)
		if _, ok := resolvedServices[srvId]; !ok {
			// TODO Fix this node creation after we know exactly what we are creating...
			// staticNode := graph.NewNode(namespaceName, app, app, version)
			// staticNode.Metadata = map[string]interface{}{"rate": 0.0, "rateOut": 0.0, "isUnused": true}
			//nonTrafficList = append(nonTrafficList, &staticNode)
			//resolvedServices[srvId] = true
		}
	}
	return nonTrafficList
}

func buildNodeSet(nodeSet *map[string]struct{}, trafficMap graph.TrafficMap) {
	for id, _ := range trafficMap {
		(*nodeSet)[id] = struct{}{}
	}
}

func buildDefaultTrafficMap(trafficMap graph.TrafficMap, staticNodeList *[]*graph.Node) {
	if len(*staticNodeList) == 0 {
		return
	}
	for i := 0; i < len(*staticNodeList); i++ {
		s := (*staticNodeList)[i]
		trafficMap[s.ID] = s
	}
}

func addNodeToTrafficMap(trafficMap graph.TrafficMap, node *graph.Node) {
	// Add a "sibling" edge to any service with an edge to a service of the same name (presumably different version)
	for _, s := range trafficMap {
		findAndAddSibling(s, node)
	}

	// add service to traffic map
	trafficMap[node.ID] = node
}

func findAndAddSibling(parent, node *graph.Node) {
	found := -1
	// TODO FIX s.ServiceName, s.Name --> s.App to compile
	for i := 0; i < len(parent.Edges); i++ {
		if parent.Edges[i].Dest.App == node.App {
			found = i
			break
		}
	}
	if found > -1 {
		parent.AddEdge(node)
	}
}
