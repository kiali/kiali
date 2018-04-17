package appender

import (
	"strings"

	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

type CircuitBreakerAppender struct{}

func (a CircuitBreakerAppender) AppendGraph(trees *[]tree.ServiceNode, namespaceName string) {
	istioClient, err := kubernetes.NewClient()
	checkError(err)

	for _, tree := range *trees {
		applyCircuitBreakers(&tree, namespaceName, istioClient)
	}
}

func applyCircuitBreakers(n *tree.ServiceNode, namespaceName string, istioClient *kubernetes.IstioClient) {
	// determine if there is a circuit breaker on this node
	istioDetails, err := istioClient.GetIstioDetails(namespaceName, strings.Split(n.Name, ".")[0])
	if err == nil {
		if istioDetails.DestinationPolicies != nil {
			dps := make(models.DestinationPolicies, 0)
			dps.Parse(istioDetails.DestinationPolicies)
			for _, dp := range dps {
				if dp.CircuitBreaker != nil {
					if d, ok := dp.Destination.(map[string]interface{}); ok {
						if d["labels"].(map[string]interface{})["version"] == n.Version {
							n.Metadata["hasCircuitBreaker"] = "true"
							break // no need to keep going, we know it has at least one CB policy
						}
					}
				}
			}
		}
	} else {
		log.Warningf("Cannot determine if service [%v:%v] has circuit breakers: %v", namespaceName, n.Name, err)
		n.Metadata["hasCircuitBreaker"] = "unknown"
	}

	for _, child := range n.Children {
		applyCircuitBreakers(child, namespaceName, istioClient)
	}
}
