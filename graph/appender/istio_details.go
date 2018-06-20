package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
)

type IstioAppender struct{}

// AppendGraph implements Appender
func (a IstioAppender) AppendGraph(trafficMap graph.TrafficMap, namespaceName string) {
	if len(trafficMap) == 0 {
		return
	}

	istioClient, err := kubernetes.NewClient()
	checkError(err)

	namespaceInfo := fetchNamespaceInfo(namespaceName, istioClient)

	addRouteBadges(trafficMap, namespaceName, namespaceInfo)
}

func fetchNamespaceInfo(namespaceName string, istioClient *kubernetes.IstioClient) *kubernetes.IstioDetails {
	istioDetails, err := istioClient.GetIstioDetails(namespaceName, "")
	checkError(err)

	return istioDetails
}

func addRouteBadges(trafficMap graph.TrafficMap, namespaceName string, istioDetails *kubernetes.IstioDetails) {
	applyCircuitBreakers(trafficMap, namespaceName, istioDetails)
	applyRouteRules(trafficMap, namespaceName, istioDetails)
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, namespaceName string, istioDetails *kubernetes.IstioDetails) {
	for _, s := range trafficMap {
		found := false
		for _, destinationPolicy := range istioDetails.DestinationPolicies {
			if kubernetes.CheckDestinationPolicyCircuitBreaker(destinationPolicy, namespaceName, s.ServiceName, s.Version) {
				s.Metadata["hasCB"] = true
				found = true
				break
			}
		}

		// If we have found a CircuitBreaker from destinationPolicies we don't continue searching
		if !found {
			for _, destinationRule := range istioDetails.DestinationRules {
				if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespaceName, s.ServiceName, s.Version) {
					s.Metadata["hasCB"] = true
					break
				}
			}
		}
	}
}

func applyRouteRules(trafficMap graph.TrafficMap, namespaceName string, istioDetails *kubernetes.IstioDetails) {
	for _, s := range trafficMap {
		found := false
		for _, routeRule := range istioDetails.RouteRules {
			if kubernetes.CheckRouteRule(routeRule, namespaceName, s.ServiceName, s.Version) {
				s.Metadata["hasRR"] = true
				found = true
				break
			}
		}

		// If we have found a RouteRule we don't continue searching
		if !found {
			subsets := kubernetes.GetDestinationRulesSubsets(istioDetails.DestinationRules, s.ServiceName, s.Version)
			for _, virtualService := range istioDetails.VirtualServices {
				if kubernetes.CheckVirtualService(virtualService, namespaceName, s.ServiceName, subsets) {
					s.Metadata["hasRR"] = true
					break
				}
			}
		}
	}
}
