package appender

import (
	"context"
	"strings"

	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/labels"

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
type IstioAppender struct{}

// Name implements Appender
func (a IstioAppender) Name() string {
	return IstioAppenderName
}

// IsFinalizer implements Appender
func (a IstioAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a IstioAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	serviceLists := map[string]*models.ServiceList{}
	for _, cluster := range globalInfo.Clusters {
		svcs, err := globalInfo.Business.Svc.GetServiceListForCluster(ctx, business.ServiceCriteria{Cluster: cluster.Name}, cluster.Name)
		graph.CheckError(err)

		serviceLists[cluster.Name] = svcs
	}

	addBadging(ctx, trafficMap, globalInfo)
	addLabels(ctx, trafficMap, globalInfo, serviceLists)
	for _, cluster := range globalInfo.Clusters {
		a.decorateGateways(ctx, cluster.Name, globalInfo)
	}
}

func addBadging(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo) {
	for _, cluster := range globalInfo.Clusters {
		// Currently no other appenders use DestinationRules or VirtualServices, so they are not cached in AppenderNamespaceInfo
		istioConfig, err := globalInfo.Business.IstioConfig.GetIstioConfigList(ctx, cluster.Name, business.IstioConfigCriteria{
			IncludeDestinationRules: true,
			IncludeVirtualServices:  true,
		})
		graph.CheckError(err)

		applyCircuitBreakers(trafficMap, istioConfig.DestinationRules)
		applyVirtualServices(trafficMap, istioConfig.VirtualServices, globalInfo.Conf)
	}
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, destinationRules []*networkingv1.DestinationRule) {
NODES:
	for _, n := range trafficMap {

		// Note, Because DestinationRules are applied to services we limit CB badges to service nodes and app nodes.
		// Whether we should add to workload nodes is debatable, we could add it later if needed.
		versionOk := graph.IsOK(n.Version)
		switch {
		case n.NodeType == graph.NodeTypeService:
			for _, destinationRule := range destinationRules {
				if models.HasDRCircuitBreaker(destinationRule, n.Namespace, n.Service, "") {
					n.Metadata[graph.HasCB] = true
					continue NODES
				}
			}
		case !versionOk && (n.NodeType == graph.NodeTypeApp):
			if destServices, ok := n.Metadata[graph.DestServices]; ok {
				for _, ds := range destServices.(graph.DestServicesMetadata) {
					for _, destinationRule := range destinationRules {
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
					for _, destinationRule := range destinationRules {
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

func applyVirtualServices(trafficMap graph.TrafficMap, virtualServices []*networkingv1.VirtualService, conf *config.Config) {
NODES:
	for _, n := range trafficMap {
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		for _, virtualService := range virtualServices {
			if models.IsVSValidHost(virtualService, n.Namespace, n.Service, conf) {
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

type serviceKey struct {
	Cluster   string
	Name      string
	Namespace string
}

// addLabels is a chance to add any missing label info to nodes when the telemetry does not provide enough information.
// For example, service injection has this problem.
func addLabels(ctx context.Context, trafficMap graph.TrafficMap, gi *graph.GlobalInfo, serviceLists map[string]*models.ServiceList) {
	// build map for quick lookup
	svcMap := map[serviceKey]models.ServiceOverview{}
	for cluster, serviceList := range serviceLists {
		for _, sd := range serviceList.Services {
			svcMap[serviceKey{Cluster: cluster, Namespace: sd.Namespace, Name: sd.Name}] = sd
		}
	}

	for _, n := range trafficMap {
		// make sure service nodes have the defined app label so it can be used for app grouping in the UI.
		if n.NodeType != graph.NodeTypeService || n.App != "" {
			continue
		}
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

				if svc, found := svcMap[serviceKey{Cluster: n.Cluster, Namespace: n.Namespace, Name: hostToTest}]; found {
					appLabelName, _ := gi.Conf.GetAppLabelName(svc.Labels)
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

		if svc, found := svcMap[serviceKey{Cluster: n.Cluster, Namespace: n.Namespace, Name: n.Service}]; !found {
			log.FromContext(ctx).Debug().Msgf("Service not found, may not apply app label correctly for [%s:%s]", n.Namespace, n.Service)
			continue
		} else {
			appLabelName, _ := gi.Conf.GetAppLabelName(svc.Labels)
			if app, ok := svc.Labels[appLabelName]; ok {
				n.App = app
			}
		}
	}
}

// decorateGateways gets all the Gateway CRDs and GatewayAPI CRDs for the given cluster and namespace and adds the hostnames to the node metadata.
func (a IstioAppender) decorateGateways(ctx context.Context, cluster string, globalInfo *graph.GlobalInfo) {
	l, err := globalInfo.Business.IstioConfig.GetIstioConfigList(ctx, cluster, business.IstioConfigCriteria{
		IncludeGateways:    true,
		IncludeK8sGateways: true,
	})
	graph.CheckError(err)

	for _, gw := range l.Gateways {
		selector := labels.Set(gw.Spec.Selector).AsSelector()
		wk, err := globalInfo.Business.Workload.GetAllWorkloads(ctx, cluster, selector.String())
		graph.CheckError(err)
		var hostnames []string
		for _, gwServer := range gw.Spec.Servers {
			gwHosts := gwServer.Hosts
			hostnames = append(hostnames, gwHosts...)
		}
		for _, w := range wk {
			node := globalInfo.WorkloadMap[graph.WorkloadNodeKey{Cluster: w.Cluster, Namespace: w.Namespace, Workload: w.Name}]
			if node != nil {
				// TODO: This doesn't work for the generic gateway chart.
				switch w.Labels["operator.istio.io/component"] {
				case "IngressGateways":
					node.Metadata[graph.IsIngressGateway] = graph.GatewaysMetadata{gw.Name: hostnames}
				case "EgressGateways":
					node.Metadata[graph.IsEgressGateway] = graph.GatewaysMetadata{gw.Name: hostnames}
				}
			}
		}
	}

	for _, gw := range l.K8sGateways {
		wl, err := globalInfo.Business.Workload.GetWorkloadList(ctx, business.WorkloadCriteria{
			Cluster:       cluster,
			LabelSelector: labels.Set(map[string]string{config.GatewayLabel: gw.Name}).String(),
		})
		graph.CheckError(err)
		if wlLen := len(wl.Workloads); wlLen == 0 {
			continue
		} else if wlLen > 1 {
			log.FromContext(ctx).Warn().Msgf("Multiple workloads found for GatewayAPI %s in namespace %s", gw.Name, gw.Namespace)
		}

		workload := wl.Workloads[0]
		node := globalInfo.WorkloadMap[graph.WorkloadNodeKey{Cluster: workload.Cluster, Namespace: workload.Namespace, Workload: workload.Name}]
		if node != nil {
			gwListeners := gw.Spec.Listeners
			var hostnames []string

			for _, gwListener := range gwListeners {
				if gwListener.Hostname != nil {
					hostnames = append(hostnames, string(*gwListener.Hostname))
				}
			}
			// Hostnames are not required. Adding * to be processed by the frontend (Indicates the kind of GW).
			if len(hostnames) == 0 {
				hostnames = append(hostnames, "*")
			}
			node.Metadata[graph.IsGatewayAPI] = graph.GatewaysMetadata{gw.Name: hostnames}
		}
	}
}
