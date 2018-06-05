package appender

import (
	"fmt"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/kubernetes"
)

type UnusedServiceAppender struct {
}

// AppendGraph implements Appender
func (a UnusedServiceAppender) AppendGraph(trees *[]*tree.ServiceNode, namespaceName string) {
	istioClient, err := kubernetes.NewClient()
	checkError(err)

	cfg := config.Get()
	labels := cfg.ServiceFilterLabelName + "," + cfg.VersionFilterLabelName
	pods, err := istioClient.GetPods(namespaceName, labels)
	checkError(err)

	addUnusedNodes(trees, namespaceName, pods)
}

func addUnusedNodes(trees *[]*tree.ServiceNode, namespaceName string, pods *v1.PodList) {
	staticNodeList := buildStaticNodeList(namespaceName, pods)
	currentNodeSet := make(map[string]struct{})
	for _, tree := range *trees {
		buildNodeSet(&currentNodeSet, tree)
	}

	// Empty trees, no traffic in whole namespace, so we create a default tree with the static info
	if len(currentNodeSet) == 0 {
		buildDefaultTrees(trees, &staticNodeList)
		return
	}

	// There is traffic in the namespace, so we need to check if we have nodes without traffic
	for i := 0; i < len(staticNodeList); i++ {
		// Node found in the static list but with no traffic, it should be added to the trees
		if _, ok := currentNodeSet[staticNodeList[i].ID]; !ok {
			addNodeToTrees(trees, staticNodeList[i])
		}
	}
}

func buildStaticNodeList(namespaceName string, pods *v1.PodList) []*tree.ServiceNode {
	nonTrafficList := make([]*tree.ServiceNode, 0)
	resolvedServices := make(map[string]bool)
	appLabel := config.Get().ServiceFilterLabelName
	versionLabel := config.Get().VersionFilterLabelName
	identityDomain := config.Get().ExternalServices.Istio.IstioIdentityDomain
	for _, pod := range pods.Items {
		app := pod.GetObjectMeta().GetLabels()[appLabel]
		version := pod.GetObjectMeta().GetLabels()[versionLabel]
		srvId := fmt.Sprintf("%s.%s.%s.%s", app, namespaceName, identityDomain, version)
		if _, ok := resolvedServices[srvId]; !ok {
			staticNode := tree.NewServiceNode(fmt.Sprintf("%s.%s.%s", app, namespaceName, identityDomain), version)
			staticNode.Metadata = map[string]interface{}{"rate": 0.0, "isUnused": "true"}
			nonTrafficList = append(nonTrafficList, &staticNode)
			resolvedServices[srvId] = true
		}
	}
	return nonTrafficList
}

func buildNodeSet(nodeSet *map[string]struct{}, tree *tree.ServiceNode) {
	(*nodeSet)[tree.ID] = struct{}{}
	for _, child := range tree.Children {
		buildNodeSet(nodeSet, child)
	}
}

func buildDefaultTrees(trees *[]*tree.ServiceNode, staticNodeList *[]*tree.ServiceNode) {
	if len(*staticNodeList) == 0 {
		return
	}
	for i := 0; i < len(*staticNodeList); i++ {
		*trees = append(*trees, (*staticNodeList)[i])
	}
}

func addNodeToTrees(trees *[]*tree.ServiceNode, node *tree.ServiceNode) {
	// First we try to find a sibling and add the under under same parent
	added := false
	for i := 0; i < len(*trees); i++ {
		if !added {
			added = findAndAddSibling((*trees)[i], node)
		} else {
			break
		}
	}
	// Second, if not founded, we add them as root tree level
	if !added {
		*trees = append(*trees, node)
	}
}

func findAndAddSibling(tree *tree.ServiceNode, node *tree.ServiceNode) bool {
	added := false
	found := -1
	for i := 0; i < len(tree.Children); i++ {
		if tree.Children[i].Name == node.Name {
			found = i
			break
		}
	}
	if found > -1 {
		node.Parent = tree.Children[found].Parent
		if sourceSvc, ok := tree.Children[found].Metadata["source_svc"]; ok {
			node.Metadata["source_svc"] = sourceSvc
		}
		if sourceVer, ok := tree.Children[found].Metadata["source_ver"]; ok {
			node.Metadata["source_ver"] = sourceVer
		}
		tree.Children = append(tree.Children, node)
		added = true
	}
	// If not added, iterate on children
	if !added {
		for i := 0; i < len(tree.Children); i++ {
			added = findAndAddSibling(tree.Children[i], node)
			if added {
				break
			}

		}
	}
	return added
}
