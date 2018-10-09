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
		versionOk := n.Version != "" && n.Version != graph.UnknownVersion
		switch {
		case n.NodeType == graph.NodeTypeService:
			for _, destinationRule := range istioDetails.DestinationRules {
				if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespace, n.Service, "") {
					n.Metadata["hasCB"] = true
					continue NODES
				}
			}
		case !versionOk && (n.NodeType == graph.NodeTypeApp):
			if destServices, ok := n.Metadata["destServices"]; ok {
				for serviceName, _ := range destServices.(map[string]bool) {
					for _, destinationRule := range istioDetails.DestinationRules {
						if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespace, serviceName, "") {
							n.Metadata["hasCB"] = true
							continue NODES
						}
					}
				}
			}
		case versionOk:
			if destServices, ok := n.Metadata["destServices"]; ok {
				for serviceName, _ := range destServices.(map[string]bool) {
					for _, destinationRule := range istioDetails.DestinationRules {
						if kubernetes.CheckDestinationRuleCircuitBreaker(destinationRule, namespace, serviceName, n.Version) {
							n.Metadata["hasCB"] = true
							continue NODES
						}
					}
				}
			}
		default:
			continue
		}
	}
}

func applyVirtualServices(trafficMap graph.TrafficMap, namespace string, istioDetails *kubernetes.IstioDetails) {
NODES:
	for _, n := range trafficMap {
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		for _, virtualService := range istioDetails.VirtualServices {
			if kubernetes.CheckVirtualService(virtualService, namespace, n.Service) {
				n.Metadata["hasVS"] = true
				continue NODES
			}
		}
	}
}
