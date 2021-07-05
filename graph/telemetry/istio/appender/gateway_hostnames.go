package appender

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const GatewayHostnamesAppenderName = "gwHosts"

type GatewayHostnamesAppender struct {
}

func (a GatewayHostnamesAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	// Get ingress-gateways deployments in the namespace. Then, find if the graph is showing any of them. If so, flag the GW nodes.
	ingressWorkloads := getIngressGatewaysWorkloads(globalInfo)
	ingressNodeMapping := make(map[*models.WorkloadListItem][]*graph.Node)
	istioAppLabelName := config.Get().IstioLabels.AppLabelName

	gatewayInNamespace := false
	if ingressWorkloadsList, ok := ingressWorkloads[namespaceInfo.Namespace]; ok {
		for _, gw := range ingressWorkloadsList {
			for _, node := range trafficMap {
				if node.App == gw.Labels[istioAppLabelName] && node.Namespace == namespaceInfo.Namespace {
					node.Metadata[graph.IsIngressGw] = true
					ingressNodeMapping[&gw] = append(ingressNodeMapping[&gw], node)
					gatewayInNamespace = true
				}
			}
		}
	}

	// If there is any ingress gateway node in the processing namespace, find Gateway CRDs and
	// match them against gateways in the graph.
	if gatewayInNamespace {
		gatewaysCrds := getIstioGatewayResources(globalInfo)

		for _, gwCrd := range gatewaysCrds {
			gwSelector := labels.Set(gwCrd.Spec.Selector).AsSelector()
			for gw, nodes := range ingressNodeMapping {
				if gwSelector.Matches(labels.Set(gw.Labels)) {

					// If we are here, the GatewayCrd selects the Gateway workload.
					// So, all node graphs associated with the GW workload should be listening
					// requests for the hostnames listed in the GatewayCRD.

					// Let's extract the hostnames and add them to the node metadata.
					for _, node := range nodes {
						gwServers := gwCrd.Spec.Servers.([]interface{})
						var hostnames []string

						for _, gwServer := range gwServers {
							gwServerMap := gwServer.(map[string]interface{})
							gwHosts := gwServerMap["hosts"].([]interface{})
							for _, gwHost := range gwHosts {
								hostnames = append(hostnames, gwHost.(string))
							}
						}

						// Metadata format: { gatewayName => array of hostnames }
						node.Metadata[graph.Gateways] = graph.GatewaysMetadata{
							gwCrd.Metadata.Name: hostnames,
						}
					}
				}
			}
		}
	}
}

func (GatewayHostnamesAppender) Name() string {
	return GatewayHostnamesAppenderName
}

func getIngressGatewaysWorkloads(globalInfo *graph.AppenderGlobalInfo) map[string][]models.WorkloadListItem {
	nsList, nsErr := globalInfo.Business.Namespace.GetNamespaces()
	graph.CheckError(nsErr)

	ingressWorkloads := make(map[string][]models.WorkloadListItem)
	for _, namespace := range nsList {
		wList, err := globalInfo.Business.Workload.GetWorkloadList(namespace.Name)
		graph.CheckError(err)

		// Find Ingress Gateway deployments
		for _, workload := range wList.Workloads {
			if workload.Type == "Deployment" {
				if labelValue, ok := workload.Labels["operator.istio.io/component"]; ok && labelValue == "IngressGateways" {
					ingressWorkloads[namespace.Name] = append(ingressWorkloads[namespace.Name], workload)
				}
			}
		}
	}

	return ingressWorkloads
}

func getIstioGatewayResources(globalInfo *graph.AppenderGlobalInfo) models.Gateways {
	nsList, nsErr := globalInfo.Business.Namespace.GetNamespaces()
	graph.CheckError(nsErr)

	retVal := models.Gateways{}
	for _, namespace := range nsList {
		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
			IncludeGateways: true,
			Namespace:       namespace.Name,
		})
		graph.CheckError(err)

		retVal = append(retVal, istioCfg.Gateways...)
	}

	return retVal
}
