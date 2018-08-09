package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
)

type IstioAppender struct{}

// AppendGraph implements Appender
func (a IstioAppender) AppendGraph(trafficMap graph.TrafficMap, namespace string) {
	if len(trafficMap) == 0 {
		return
	}

	istioClient, err := kubernetes.NewClient()
	checkError(err)

	namespaceInfo := fetchNamespaceInfo(namespace, istioClient)

	addRouteBadges(trafficMap, namespace, namespaceInfo)
}

func fetchNamespaceInfo(namespace string, istioClient *kubernetes.IstioClient) *kubernetes.IstioDetails {
	istioDetails, err := istioClient.GetIstioDetails(namespace, "")
	checkError(err)

	return istioDetails
}

func addRouteBadges(trafficMap graph.TrafficMap, namespace string, istioDetails *kubernetes.IstioDetails) {
	applyCircuitBreakers(trafficMap, namespace, istioDetails)
	applyVirtualServices(trafficMap, namespace, istioDetails)
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, namespace string, istioDetails *kubernetes.IstioDetails) {
NODES:
	for _, n := range trafficMap {
		version := n.Version
		if version == graph.UnknownVersion {
			version = ""
		}

		if destServices, ok := n.Metadata["destServices"]; ok {
			for serviceName, _ := range destServices.(map[string]bool) {
				for _, destinationRule := range istioDetails.DestinationRules {
					if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespace, serviceName, version) {
						n.Metadata["hasCB"] = true
						continue NODES
					}
				}
			}
		}
	}
}

func applyVirtualServices(trafficMap graph.TrafficMap, namespace string, istioDetails *kubernetes.IstioDetails) {
NODES:
	for _, n := range trafficMap {
		if destServices, ok := n.Metadata["destServices"]; ok {
			for serviceName, _ := range destServices.(map[string]bool) {
				for _, virtualService := range istioDetails.VirtualServices {
					if kubernetes.CheckVirtualService(virtualService, namespace, serviceName) {
						n.Metadata["hasVS"] = true
						continue NODES
					}
				}
			}
		}
	}
}
