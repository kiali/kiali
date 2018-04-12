package handlers

import (
	"fmt"

	"k8s.io/api/apps/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/log"
)

func addUnusedNodes(trees *[]tree.ServiceNode, namespaceName string, deployments *v1beta1.DeploymentList) {
	staticNodeList := buildStaticNodeList(namespaceName, deployments)
	currentNodeSet := make(map[string]struct{})
	for _, tree := range *trees {
		buildNodeSet(&currentNodeSet, &tree)
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
			addNodeToTrees(trees, &staticNodeList[i])
		}
	}
}

func buildStaticNodeList(namespaceName string, deployments *v1beta1.DeploymentList) []tree.ServiceNode {
	nonTrafficList := make([]tree.ServiceNode, 0)
	appLabel := config.Get().ServiceFilterLabelName
	versionLabel := config.Get().VersionFilterLabelName
	identityDomain := config.Get().Products.Istio.IstioIdentityDomain
	for _, deployment := range deployments.Items {
		app, ok := deployment.GetObjectMeta().GetLabels()[appLabel]
		if !ok {
			log.Warningf("Deployment %s has not a proper app label [%s]", deployment.Name, appLabel)
			continue
		}
		version, ok := deployment.GetObjectMeta().GetLabels()[versionLabel]
		if !ok {
			log.Warningf("Deployment %s has not a proper version label [%s]", deployment.Name, versionLabel)
			continue
		}
		staticNode := tree.NewServiceNode(fmt.Sprintf("%s.%s.%s", app, namespaceName, identityDomain), version)
		staticNode.Metadata = map[string]interface{}{"rate": -1.0}
		nonTrafficList = append(nonTrafficList, staticNode)
	}
	return nonTrafficList
}

func buildNodeSet(nodeSet *map[string]struct{}, tree *tree.ServiceNode) {
	(*nodeSet)[tree.ID] = struct{}{}
	for _, child := range tree.Children {
		buildNodeSet(nodeSet, child)
	}
}

func buildDefaultTrees(trees *[]tree.ServiceNode, staticNodeList *[]tree.ServiceNode) {
	if len(*staticNodeList) == 0 {
		return
	}
	// A static picture of services without traffic will not infer the sources,
	// so we need an ephemeral representation of static services until we have traffic and this can properly fetched
	// from prometheus
	rootNode := tree.NewServiceNode(tree.UnknownService, tree.UnknownVersion)
	rootNode.Children = make([]*tree.ServiceNode, len(*staticNodeList))
	for i := 0; i < len(*staticNodeList); i++ {
		rootNode.Children[i] = &(*staticNodeList)[i]
	}
	*trees = append(*trees, rootNode)
}

func addNodeToTrees(trees *[]tree.ServiceNode, node *tree.ServiceNode) {
	// First we try to find a sibling and add the under under same parent
	added := false
	for i := 0; i < len(*trees); i++ {
		if !added {
			added = findAndAddSibling(&((*trees)[i]), node)
		} else {
			break
		}
	}
	// Second, if not founded, we create a unknown root to add them as parent
	if !added {
		addUnderUnknownTree(trees, node)
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

func addUnderUnknownTree(trees *[]tree.ServiceNode, node *tree.ServiceNode) {
	// Find and add as child under unknown
	added := false
	for i := 0; i < len(*trees); i++ {
		if (*trees)[i].Name == tree.UnknownService {
			(*trees)[i].Children = append((*trees)[i].Children, node)
			added = true
		}
	}
	// If not added, create a new "unknown" tree
	if !added {
		rootNode := tree.NewServiceNode(tree.UnknownService, tree.UnknownVersion)
		rootNode.Children = make([]*tree.ServiceNode, 1)
		rootNode.Children[0] = node
		*trees = append(*trees, rootNode)
	}
}
