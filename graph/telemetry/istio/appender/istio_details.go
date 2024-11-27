package appender

import (
	"context"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/labels"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const IstioAppenderName = "istio"

// IstioAppender is responsible for badging nodes with special Istio significance:
// - CircuitBreaker: n.Metadata[HasCB] = true
// - Ingress Gateways: n.Metadata[IsIngressGateway] = Map of GatewayName => hosts
// - VirtualService: n.Metadata[HasVS] = Map of VirtualServiceName => hosts
// Name: istio
type IstioAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
}

// Name implements Appender
func (a IstioAppender) Name() string {
	return IstioAppenderName
}

// IsFinalizer implements Appender
func (a IstioAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a IstioAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	serviceLists := getServiceLists(trafficMap, namespaceInfo.Namespace, globalInfo)

	addBadging(trafficMap, globalInfo, namespaceInfo)
	addLabels(trafficMap, globalInfo, serviceLists)
	a.decorateGateways(trafficMap, globalInfo, namespaceInfo)
}

func addBadging(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	clusters := getTrafficClusters(trafficMap, namespaceInfo.Namespace, globalInfo)
	destinationRuleLists := map[string]models.IstioConfigList{}
	virtualServiceLists := map[string]models.IstioConfigList{}

	for _, cluster := range clusters {
		// Currently no other appenders use DestinationRules or VirtualServices, so they are not cached in AppenderNamespaceInfo
		destinationRuleList, err := globalInfo.Business.IstioConfig.GetIstioConfigListForNamespace(context.TODO(), cluster, namespaceInfo.Namespace, business.IstioConfigCriteria{
			IncludeDestinationRules: true,
		})
		graph.CheckError(err)
		destinationRuleLists[cluster] = *destinationRuleList

		virtualServiceList, err := globalInfo.Business.IstioConfig.GetIstioConfigList(context.TODO(), cluster, business.IstioConfigCriteria{
			IncludeVirtualServices: true,
		})
		graph.CheckError(err)
		virtualServiceLists[cluster] = *virtualServiceList
	}

	applyCircuitBreakers(trafficMap, namespaceInfo.Namespace, destinationRuleLists)
	applyVirtualServices(trafficMap, namespaceInfo.Namespace, virtualServiceLists)
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, namespace string, destinationRuleLists map[string]models.IstioConfigList) {
NODES:
	for _, n := range trafficMap {
		// Skip the check if this node is outside the requested namespace, we limit badging to the requested namespaces
		if n.Namespace != namespace {
			continue
		}

		// Note, Because DestinationRules are applied to services we limit CB badges to service nodes and app nodes.
		// Whether we should add to workload nodes is debatable, we could add it later if needed.
		versionOk := graph.IsOK(n.Version)
		switch {
		case n.NodeType == graph.NodeTypeService:
			for _, destinationRule := range destinationRuleLists[n.Cluster].DestinationRules {
				if models.HasDRCircuitBreaker(destinationRule, namespace, n.Service, "") {
					n.Metadata[graph.HasCB] = true
					continue NODES
				}
			}
		case !versionOk && (n.NodeType == graph.NodeTypeApp):
			if destServices, ok := n.Metadata[graph.DestServices]; ok {
				for _, ds := range destServices.(graph.DestServicesMetadata) {
					for _, destinationRule := range destinationRuleLists[n.Cluster].DestinationRules {
						if models.HasDRCircuitBreaker(destinationRule, ds.Namespace, ds.Name, "") {
							n.Metadata[graph.HasCB] = true
							continue NODES
						}
					}
				}
			}
		case versionOk:
			if destServices, ok := n.Metadata[graph.DestServices]; ok {
				for _, ds := range destServices.(graph.DestServicesMetadata) {
					for _, destinationRule := range destinationRuleLists[n.Cluster].DestinationRules {
						if models.HasDRCircuitBreaker(destinationRule, ds.Namespace, ds.Name, n.Version) {
							n.Metadata[graph.HasCB] = true
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

func applyVirtualServices(trafficMap graph.TrafficMap, namespace string, virtualServiceLists map[string]models.IstioConfigList) {
NODES:
	for _, n := range trafficMap {
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		for _, virtualService := range virtualServiceLists[n.Cluster].VirtualServices {
			if models.IsVSValidHost(virtualService, n.Namespace, n.Service) {
				var vsMetadata graph.VirtualServicesMetadata
				var vsOk bool
				if vsMetadata, vsOk = n.Metadata[graph.HasVS].(graph.VirtualServicesMetadata); !vsOk {
					vsMetadata = make(graph.VirtualServicesMetadata)
					n.Metadata[graph.HasVS] = vsMetadata
				}

				if len(virtualService.Spec.Hosts) != 0 {
					vsMetadata[virtualService.Name] = virtualService.Spec.Hosts
				}

				if models.HasVSRequestRouting(virtualService) {
					n.Metadata[graph.HasRequestRouting] = true
				}

				if models.HasVSRequestTimeout(virtualService) {
					n.Metadata[graph.HasRequestTimeout] = true
				}

				if models.HasVSFaultInjection(virtualService) {
					n.Metadata[graph.HasFaultInjection] = true
				}

				if models.HasVSTrafficShifting(virtualService) {
					n.Metadata[graph.HasTrafficShifting] = true
				}

				if models.HasVSTCPTrafficShifting(virtualService) {
					n.Metadata[graph.HasTCPTrafficShifting] = true
				}

				if models.HasVSMirroring(virtualService) {
					n.Metadata[graph.HasMirroring] = true
				}

				if kubernetes.IsAutogenerated(virtualService.Name) {
					n.Metadata[graph.IsK8sGatewayAPI] = true
				}

				continue NODES
			}
		}
	}
}

// addLabels is a chance to add any missing label info to nodes when the telemetry does not provide enough information.
// For example, service injection has this problem.
func addLabels(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, serviceLists map[string]*models.ServiceList) {
	// build map for quick lookup
	svcMap := map[graph.ClusterSensitiveKey]models.ServiceOverview{}
	for cluster, serviceList := range serviceLists {
		for _, sd := range serviceList.Services {
			svcMap[graph.GetClusterSensitiveKey(cluster, sd.Name)] = sd
		}
	}

	appLabelName := config.Get().IstioLabels.AppLabelName
	for _, n := range trafficMap {
		if serviceList, ok := serviceLists[n.Cluster]; ok {
			// make sure service nodes have the defined app label so it can be used for app grouping in the UI.
			if n.NodeType == graph.NodeTypeService && n.Namespace == serviceList.Namespace && n.App == "" {
				// For service nodes that are a service entries, use the `hosts` property of the SE to find
				// a matching Kubernetes Svc for adding missing labels
				if _, ok := n.Metadata[graph.IsServiceEntry]; ok {
					seInfo := n.Metadata[graph.IsServiceEntry].(*graph.SEInfo)
					for _, host := range seInfo.Hosts {
						var hostToTest string

						hostSplitted := strings.Split(host, ".")
						if len(hostSplitted) == 3 && hostSplitted[2] == config.IstioMultiClusterHostSuffix {
							hostToTest = host
						} else {
							hostToTest = hostSplitted[0]
						}

						if svc, found := svcMap[graph.GetClusterSensitiveKey(n.Cluster, hostToTest)]; found {
							if app, ok := svc.Labels[appLabelName]; ok {
								n.App = app
							}
							continue
						}
					}
					continue
				}
				// A service node that is an Istio egress cluster will not have a service definition
				if _, ok := n.Metadata[graph.IsEgressCluster]; ok {
					continue
				}

				if svc, found := svcMap[graph.GetClusterSensitiveKey(n.Cluster, n.Service)]; !found {
					log.Debugf("Service not found, may not apply app label correctly for [%s:%s]", n.Namespace, n.Service)
					continue
				} else if app, ok := svc.Labels[appLabelName]; ok {
					n.App = app
				}
			}
		}
	}
}

func decorateMatchingGateways(cluster string, gwCrd *networking_v1.Gateway, gatewayNodeMapping map[*models.WorkloadListItem][]*graph.Node, nodeMetadataKey graph.MetadataKey) {
	gwSelector := labels.Set(gwCrd.Spec.Selector).AsSelector()
	for gw, nodes := range gatewayNodeMapping {
		if gw.Cluster != cluster {
			continue
		}

		if gwSelector.Matches(labels.Set(gw.Labels)) {
			// If we are here, the GatewayCrd selects the Gateway workload.
			// So, all node graphs associated with the GW workload should be listening
			// requests for the hostnames listed in the GatewayCRD.

			// Let's extract the hostnames and add them to the node metadata.
			for _, node := range nodes {
				gwServers := gwCrd.Spec.Servers
				var hostnames []string

				for _, gwServer := range gwServers {
					gwHosts := gwServer.Hosts
					hostnames = append(hostnames, gwHosts...)
				}

				// Metadata format: { gatewayName => array of hostnames }
				node.Metadata[nodeMetadataKey].(graph.GatewaysMetadata)[gwCrd.Name] = hostnames
			}
		}
	}
}

func decorateMatchingAPIGateways(cluster string, gwCrd *k8s_networking_v1.Gateway, gatewayNodeMapping map[*models.WorkloadListItem][]*graph.Node, nodeMetadataKey graph.MetadataKey) {
	gwSelector := labels.Set(gwCrd.Labels).AsSelector()
	for gw, nodes := range gatewayNodeMapping {
		if gw.Cluster != cluster {
			continue
		}

		if gwSelector.Matches(labels.Set(gw.Labels)) {
			// If we are here, the GatewayCrd selects the GatewayAPI workload.
			// So, all node graphs associated with the GW API workload should be listening
			// requests for the hostnames listed in the GatewayAPI CRD.

			// Let's extract the hostnames and add them to the node metadata.
			for _, node := range nodes {
				gwListeners := gwCrd.Spec.Listeners
				var hostnames []string

				for _, gwListener := range gwListeners {
					if gwListener.Hostname != nil {
						hostnames = append(hostnames, string(*gwListener.Hostname))
					}
				}

				// Metadata format: { gatewayName => array of hostnames }
				node.Metadata[nodeMetadataKey].(graph.GatewaysMetadata)[gwCrd.Name] = hostnames
			}
		}
	}
}

func resolveGatewayNodeMapping(gatewayWorkloads map[string][]models.WorkloadListItem, nodeMetadataKey graph.MetadataKey, trafficMap graph.TrafficMap) map[*models.WorkloadListItem][]*graph.Node {
	istioAppLabelName := config.Get().IstioLabels.AppLabelName

	gatewayNodeMapping := make(map[*models.WorkloadListItem][]*graph.Node)
	for key, gwWorkloadsList := range gatewayWorkloads {
		split := strings.Split(key, ":")
		gwCluster := split[0]
		gwNs := split[1]
		for _, gw := range gwWorkloadsList {
			for _, node := range trafficMap {
				if _, ok := node.Metadata[nodeMetadataKey]; !ok {
					if (node.NodeType == graph.NodeTypeApp || node.NodeType == graph.NodeTypeWorkload) && node.App == gw.Labels[istioAppLabelName] && node.Cluster == gwCluster && node.Namespace == gwNs {
						node.Metadata[nodeMetadataKey] = graph.GatewaysMetadata{}
						gatewayNodeMapping[&gw] = append(gatewayNodeMapping[&gw], node)
					}
				}
			}
		}
	}

	return gatewayNodeMapping
}

func (a IstioAppender) decorateGateways(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	// Get ingress-gateways deployments in the namespace. Then, find if the graph is showing any of them. If so, flag the GW nodes.
	ingressWorkloads := a.getIngressGatewayWorkloads(globalInfo)
	ingressNodeMapping := resolveGatewayNodeMapping(ingressWorkloads, graph.IsIngressGateway, trafficMap)

	// Get egress-gateways deployments in the namespace. (Same logic as in the previous chunk of code)
	egressWorkloads := a.getEgressGatewayWorkloads(globalInfo)
	egressNodeMapping := resolveGatewayNodeMapping(egressWorkloads, graph.IsEgressGateway, trafficMap)

	// Get Gateway API workloads (ingress)
	gatewayAPIWorkloads := a.getGatewayAPIWorkloads(globalInfo)
	gatewayAPINodeMapping := resolveGatewayNodeMapping(gatewayAPIWorkloads, graph.IsGatewayAPI, trafficMap)

	// If there is any ingress or egress gateway node in the processing namespace, find Gateway CRDs and
	// match them against gateways in the graph.
	if len(ingressNodeMapping) != 0 || len(egressNodeMapping) != 0 {
		gatewaysCrds := a.getIstioGatewayResources(globalInfo)

		for accessibleNamespaceKey, gwCrds := range gatewaysCrds {
			cluster := strings.Split(accessibleNamespaceKey, ":")[0]
			for _, gwCrd := range gwCrds {
				decorateMatchingGateways(cluster, gwCrd, ingressNodeMapping, graph.IsIngressGateway)
				decorateMatchingGateways(cluster, gwCrd, egressNodeMapping, graph.IsEgressGateway)
			}
		}
	}
	// If there is any GatewayAPI node in the processing namespace, find GatewayAPI CRDs and
	// match them against gateways in the graph.
	if len(gatewayAPINodeMapping) != 0 {
		gatewaysCrds := a.getGatewayAPIResources(globalInfo)

		for accessibleNamespaceKey, gwCrds := range gatewaysCrds {
			cluster := strings.Split(accessibleNamespaceKey, ":")[0]
			for _, gwCrd := range gwCrds {
				decorateMatchingAPIGateways(cluster, gwCrd, gatewayAPINodeMapping, graph.IsGatewayAPI)
			}
		}
	}
}

func (a IstioAppender) getEgressGatewayWorkloads(globalInfo *graph.GlobalInfo) map[string][]models.WorkloadListItem {
	return a.getIstioComponentWorkloads("EgressGateways", globalInfo)
}

func (a IstioAppender) getIngressGatewayWorkloads(globalInfo *graph.GlobalInfo) map[string][]models.WorkloadListItem {
	return a.getIstioComponentWorkloads("IngressGateways", globalInfo)
}

func (a IstioAppender) getIstioComponentWorkloads(component string, globalInfo *graph.GlobalInfo) map[string][]models.WorkloadListItem {
	componentWorkloads := make(map[string][]models.WorkloadListItem)
	for key, an := range a.AccessibleNamespaces {
		criteria := business.WorkloadCriteria{Cluster: an.Cluster, Namespace: an.Name, IncludeIstioResources: false, IncludeHealth: false}
		wList, err := globalInfo.Business.Workload.GetWorkloadList(context.TODO(), criteria)
		graph.CheckError(err)

		// Find Istio component deployments
		for _, workload := range wList.Workloads {
			if workload.WorkloadGVK == kubernetes.Deployments {
				if labelValue, ok := workload.Labels["operator.istio.io/component"]; ok && labelValue == component {
					componentWorkloads[key] = append(componentWorkloads[key], workload)
				}
			}
		}
	}

	return componentWorkloads
}

func (a IstioAppender) getGatewayAPIWorkloads(globalInfo *graph.GlobalInfo) map[string][]models.WorkloadListItem {
	managedWorkloads := make(map[string][]models.WorkloadListItem)
	for key, an := range a.AccessibleNamespaces {
		criteria := business.WorkloadCriteria{Cluster: an.Cluster, Namespace: an.Name, IncludeIstioResources: false, IncludeHealth: false}
		wList, err := globalInfo.Business.Workload.GetWorkloadList(context.TODO(), criteria)
		graph.CheckError(err)

		// Find Istio managed Gateway API deployments
		for _, workload := range wList.Workloads {
			if workload.WorkloadGVK == kubernetes.Deployments {
				if _, ok := workload.Labels["istio.io/gateway-name"]; ok {
					managedWorkloads[key] = append(managedWorkloads[key], workload)
				}
			}
		}
	}

	return managedWorkloads
}

func (a IstioAppender) getIstioGatewayResources(globalInfo *graph.GlobalInfo) map[string][]*networking_v1.Gateway {
	retVal := map[string][]*networking_v1.Gateway{}
	for key, an := range a.AccessibleNamespaces {
		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigListForNamespace(context.TODO(), an.Cluster, an.Name, business.IstioConfigCriteria{
			IncludeGateways: true,
		})
		graph.CheckError(err)

		retVal[key] = append(retVal[key], istioCfg.Gateways...)
	}

	return retVal
}

func (a IstioAppender) getGatewayAPIResources(globalInfo *graph.GlobalInfo) map[string][]*k8s_networking_v1.Gateway {
	retVal := map[string][]*k8s_networking_v1.Gateway{}
	for key, an := range a.AccessibleNamespaces {
		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigListForNamespace(context.TODO(), an.Cluster, an.Name, business.IstioConfigCriteria{
			IncludeK8sGateways: true,
		})
		graph.CheckError(err)

		retVal[key] = append(retVal[key], istioCfg.K8sGateways...)
	}

	return retVal
}
