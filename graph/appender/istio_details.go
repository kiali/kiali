package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
)

const IstioAppenderName = "istio"

// IstioAppender is responsible for badging nodes with special Istio significance:
// - CircuitBreaker: n.Metadata["hasCB"] = true
// - VirtualService: n.Metadata["hasVS"] = true
// Name: istio
type IstioAppender struct{}

// Name implements Appender
func (a IstioAppender) Name() string {
	return IstioAppenderName
}

// AppendGraph implements Appender
func (a IstioAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	if globalInfo.IstioClient == nil {
		var err error
		globalInfo.IstioClient, err = kubernetes.NewClient()
		checkError(err)
	}

	istioDetails := fetchIstioDetails(namespaceInfo.Namespace, globalInfo.IstioClient)

	addRouteBadges(trafficMap, namespaceInfo.Namespace, istioDetails)
}

func fetchIstioDetails(namespace string, istioClient *kubernetes.IstioClient) *kubernetes.IstioDetails {
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
		// Skip the check if this node is outside the requested namespace, we limit badging to the requested namespaces
		if n.Namespace != namespace {
			continue
		}

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
		if n.Namespace != namespace {
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
