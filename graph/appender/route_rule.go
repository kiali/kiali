package appender

import (
	"strings"

	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

type RouteRuleAppender struct{}

func (a RouteRuleAppender) AppendGraph(trees *[]tree.ServiceNode, namespaceName string) {
	istioClient, err := kubernetes.NewClient()
	checkError(err)

	for _, tree := range *trees {
		applyRouteRules(&tree, namespaceName, istioClient)
	}
}

func applyRouteRules(n *tree.ServiceNode, namespaceName string, istioClient *kubernetes.IstioClient) {
	// determine if there is a route rule on this node
	routeRules, err := istioClient.GetRouteRules(namespaceName, strings.Split(n.Name, ".")[0])
	if err == nil {
		if routeRules != nil {
			rrs := make(models.RouteRules, 0)
			rrs.Parse(routeRules)
		Found:
			for _, rr := range rrs {
				if routeMaps, ok := rr.Route.([]interface{}); ok {
					for _, routeMap := range routeMaps {
						if rm, ok2 := routeMap.(map[string]interface{}); ok2 {
							if labels, ok3 := rm["labels"].(map[string]interface{}); ok3 {
								if labels["version"] == n.Version {
									n.Metadata["hasRouteRule"] = "true"
									break Found // no need to keep going, we know it has at least one RouteRule
								}
							}
						}
					}
				}
			}
		}
	} else {
		log.Warningf("Cannot determine if service [%v:%v] has route rules: %v", namespaceName, n.Name, err)
		n.Metadata["hasRouteRule"] = "unknown"
	}

	for _, child := range n.Children {
		applyRouteRules(child, namespaceName, istioClient)
	}
}
