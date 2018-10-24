package appender

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
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

	if globalInfo.Business == nil {
		var err error
		globalInfo.Business, err = business.Get()
		checkError(err)
	}

	addBadging(trafficMap, globalInfo, namespaceInfo)
}

func addBadging(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	// Currently no other appenders use DestinationRules or VirtualServices, so they are not cached in NamespaceInfo
	istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
		IncludeDestinationRules: true,
		IncludeVirtualServices:  true,
		Namespace:               namespaceInfo.Namespace,
	})
	checkError(err)

	applyCircuitBreakers(trafficMap, namespaceInfo.Namespace, istioCfg)
	applyVirtualServices(trafficMap, namespaceInfo.Namespace, istioCfg)
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, namespace string, istioCfg models.IstioConfigList) {
NODES:
	for _, n := range trafficMap {
		// Skip the check if this node is outside the requested namespace, we limit badging to the requested namespaces
		if n.Namespace != namespace {
			continue
		}

		// Note, Because DestinationRules are applied to services we limit CB badges to service nodes and app nodes.
		// Whether we should add to workload nodes is debatable, we could add it later if needed.
		versionOk := n.Version != "" && n.Version != graph.UnknownVersion
		switch {
		case n.NodeType == graph.NodeTypeService:
			for _, destinationRule := range istioCfg.DestinationRules {
				if destinationRule.HasCircuitBreaker(namespace, n.Service, "") {
					n.Metadata["hasCB"] = true
					continue NODES
				}
			}
		case !versionOk && (n.NodeType == graph.NodeTypeApp):
			if destServices, ok := n.Metadata["destServices"]; ok {
				for serviceName, _ := range destServices.(map[string]bool) {
					for _, destinationRule := range istioCfg.DestinationRules {
						if destinationRule.HasCircuitBreaker(namespace, serviceName, "") {
							n.Metadata["hasCB"] = true
							continue NODES
						}
					}
				}
			}
		case versionOk:
			if destServices, ok := n.Metadata["destServices"]; ok {
				for serviceName, _ := range destServices.(map[string]bool) {
					for _, destinationRule := range istioCfg.DestinationRules {
						if destinationRule.HasCircuitBreaker(namespace, serviceName, n.Version) {
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

func applyVirtualServices(trafficMap graph.TrafficMap, namespace string, istioCfg models.IstioConfigList) {
NODES:
	for _, n := range trafficMap {
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		if n.Namespace != namespace {
			continue
		}
		for _, virtualService := range istioCfg.VirtualServices {
			if virtualService.IsVirtualService(namespace, n.Service) {
				n.Metadata["hasVS"] = true
				continue NODES
			}
		}
	}
}
