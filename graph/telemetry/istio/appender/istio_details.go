package appender

import (
	"context"
	"strings"

	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
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
func (a IstioAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	if globalInfo.Vendor.WorkloadMap == nil {
		globalInfo.Vendor.WorkloadMap = make(map[graph.NodeKey]*graph.Node)
		populateWorkloadMap(ctx, globalInfo.Business, globalInfo, trafficMap)
	}

	// Fetch cluster-wide service lists once per cluster for use by addLabels.
	for _, cluster := range globalInfo.Clusters {
		if _, ok := globalInfo.Vendor.ClusterServiceLists[cluster.Name]; !ok {
			svcs, err := globalInfo.Business.Svc.GetServiceListForCluster(ctx,
				business.ServiceCriteria{Cluster: cluster.Name, IncludeOnlyDefinitions: true, IncludeHealth: false},
				cluster.Name,
			)
			graph.CheckError(err)
			globalInfo.Vendor.ClusterServiceLists[cluster.Name] = svcs
		}
	}

	// Fetch all needed Istio config (DRs, VSes, Gateways) in a single call per cluster
	// to avoid redundant GetIstioConfigList and GetClusterNamespaces calls.
	for _, cluster := range globalInfo.Clusters {
		istioConfig, err := globalInfo.Business.IstioConfig.GetIstioConfigList(ctx, cluster.Name, business.IstioConfigCriteria{
			IncludeDestinationRules: true,
			IncludeGateways:         true,
			IncludeK8sGateways:      true,
			IncludeVirtualServices:  true,
		})
		graph.CheckError(err)

		identityDomain := globalInfo.Business.Svc.ResolveIdentityDomain(ctx, cluster.Name)

		applyCircuitBreakers(trafficMap, istioConfig.DestinationRules, identityDomain)
		applyVirtualServices(trafficMap, istioConfig.VirtualServices, identityDomain)
		decorateGateways(ctx, cluster.Name, globalInfo, istioConfig.Gateways, istioConfig.K8sGateways)
	}

	addLabels(ctx, trafficMap, globalInfo, globalInfo.Vendor.ClusterServiceLists)
}

// cbSubsetInfo holds pre-computed circuit breaker info for a single DR subset.
type cbSubsetInfo struct {
	// version is the version label value from subset.Labels (via GetVersionLabelName).
	// Empty means the subset has no version label -- it does NOT match versioned queries
	// (where the caller knows the specific version). It only matches unversioned queries
	// (where the caller passes version="").
	version string
}

// drEntry holds pre-computed circuit breaker info for a single DestinationRule.
type drEntry struct {
	cbSubsets []cbSubsetInfo
	dr        *networkingv1.DestinationRule
	hasCB     bool // true if top-level TrafficPolicy has CB
}

// drKey is the canonical index key for DR/VS host lookup.
func drKey(namespace, serviceName string) string {
	return namespace + "/" + serviceName
}

// buildDRIndex pre-indexes DestinationRules by their normalized target host for O(1) lookup.
func buildDRIndex(destinationRules []*networkingv1.DestinationRule) map[string][]*drEntry {
	conf := config.Get()
	idx := make(map[string][]*drEntry, len(destinationRules))

	for _, dr := range destinationRules {
		entry := &drEntry{
			dr:    dr,
			hasCB: models.IsCB(dr.Spec.TrafficPolicy),
		}

		for _, subset := range dr.Spec.Subsets {
			if subset == nil {
				continue
			}
			if models.IsCB(subset.TrafficPolicy) {
				info := cbSubsetInfo{}
				if verLabelName, found := conf.GetVersionLabelName(subset.Labels); found {
					if v, ok := subset.Labels[verLabelName]; ok {
						info.version = v
					}
				}
				entry.cbSubsets = append(entry.cbSubsets, info)
			}
		}

		if !entry.hasCB && len(entry.cbSubsets) == 0 {
			continue
		}

		ns, svc := kubernetes.NormalizeHost(dr.Spec.Host, dr.Namespace)
		key := drKey(ns, svc)
		idx[key] = append(idx[key], entry)
	}

	return idx
}

// drMatchesCB checks whether a pre-indexed drEntry matches a CB query for the given
// namespace, service, version, and identityDomain. It uses FilterByHost to confirm
// the match (narrow-then-confirm pattern).
func drMatchesCB(entry *drEntry, namespace, serviceName, version, identityDomain string) bool {
	if !kubernetes.FilterByHost(entry.dr.Spec.Host, entry.dr.Namespace, serviceName, namespace, identityDomain) {
		return false
	}

	if entry.hasCB {
		return true
	}

	if version == "" {
		return len(entry.cbSubsets) > 0
	}

	for _, sub := range entry.cbSubsets {
		if sub.version == version {
			return true
		}
	}
	return false
}

func applyCircuitBreakers(trafficMap graph.TrafficMap, destinationRules []*networkingv1.DestinationRule, identityDomain string) {
	idx := buildDRIndex(destinationRules)

NODES:
	for _, n := range trafficMap {
		if outside, ok := n.Metadata[graph.IsOutside].(bool); ok && outside {
			continue
		}

		versionOk := graph.IsOK(n.Version)
		switch {
		case n.NodeType == graph.NodeTypeService:
			key := drKey(n.Namespace, n.Service)
			for _, entry := range idx[key] {
				if drMatchesCB(entry, n.Namespace, n.Service, "", identityDomain) {
					n.Metadata[graph.HasCB] = true
					continue NODES
				}
			}
		case !versionOk && (n.NodeType == graph.NodeTypeApp):
			if destServices, ok := n.Metadata[graph.DestServices]; ok {
				for _, ds := range destServices.(graph.DestServicesMetadata) {
					key := drKey(ds.Namespace, ds.Name)
					for _, entry := range idx[key] {
						if drMatchesCB(entry, ds.Namespace, ds.Name, "", identityDomain) {
							n.Metadata[graph.HasCB] = true
							continue NODES
						}
					}
				}
			}
		case versionOk:
			if destServices, ok := n.Metadata[graph.DestServices]; ok {
				for _, ds := range destServices.(graph.DestServicesMetadata) {
					key := drKey(ds.Namespace, ds.Name)
					for _, entry := range idx[key] {
						if drMatchesCB(entry, ds.Namespace, ds.Name, n.Version, identityDomain) {
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

// vsEntry holds pre-computed feature flags for a single VirtualService.
type vsEntry struct {
	hasFaultInjection  bool
	hasMirroring       bool
	hasRequestRouting  bool
	hasRequestTimeout  bool
	hasTCPShifting     bool
	hasTrafficShifting bool
	isK8sGatewayAPI    bool
	vs                 *networkingv1.VirtualService
}

// buildVSIndex pre-indexes VirtualServices by the normalized hosts of their route
// destinations. A single VS may appear under multiple keys. The slice for each key
// preserves the original VS list order from GetIstioConfigList.
func buildVSIndex(virtualServices []*networkingv1.VirtualService) map[string][]*vsEntry {
	idx := make(map[string][]*vsEntry, len(virtualServices))

	for _, vs := range virtualServices {
		entry := &vsEntry{
			hasFaultInjection:  models.HasVSFaultInjection(vs),
			hasMirroring:       models.HasVSMirroring(vs),
			hasRequestRouting:  models.HasVSRequestRouting(vs),
			hasRequestTimeout:  models.HasVSRequestTimeout(vs),
			hasTCPShifting:     models.HasVSTCPTrafficShifting(vs),
			hasTrafficShifting: models.HasVSTrafficShifting(vs),
			isK8sGatewayAPI:    kubernetes.IsAutogenerated(vs.Name),
			vs:                 vs,
		}

		seen := make(map[string]bool)
		addHost := func(host string) {
			ns, svc := kubernetes.NormalizeHost(host, vs.Namespace)
			key := drKey(ns, svc)
			if !seen[key] {
				seen[key] = true
				idx[key] = append(idx[key], entry)
			}
		}

		for _, httpRoute := range vs.Spec.Http {
			for _, dest := range httpRoute.Route {
				if dest.Destination != nil {
					addHost(dest.Destination.Host)
				}
			}
		}
		for _, tcpRoute := range vs.Spec.Tcp {
			for _, dest := range tcpRoute.Route {
				if dest.Destination != nil {
					addHost(dest.Destination.Host)
				}
			}
		}
		for _, tlsRoute := range vs.Spec.Tls {
			for _, dest := range tlsRoute.Route {
				if dest.Destination != nil {
					addHost(dest.Destination.Host)
				}
			}
		}
	}

	return idx
}

func applyVirtualServices(trafficMap graph.TrafficMap, virtualServices []*networkingv1.VirtualService, identityDomain string) {
	idx := buildVSIndex(virtualServices)

NODES:
	for _, n := range trafficMap {
		var isOutsider bool
		if outside, ok := n.Metadata[graph.IsOutside].(bool); ok {
			isOutsider = outside
		}
		if n.NodeType != graph.NodeTypeService || isOutsider {
			continue
		}

		key := drKey(n.Namespace, n.Service)
		for _, entry := range idx[key] {
			if !models.IsVSValidHost(entry.vs, n.Namespace, n.Service, identityDomain) {
				continue
			}

			var vsMetadata graph.VirtualServicesMetadata
			var vsOk bool
			if vsMetadata, vsOk = n.Metadata[graph.HasVS].(graph.VirtualServicesMetadata); !vsOk {
				vsMetadata = make(graph.VirtualServicesMetadata)
				n.Metadata[graph.HasVS] = vsMetadata
			}

			if len(entry.vs.Spec.Hosts) != 0 {
				vsMetadata[entry.vs.Name] = entry.vs.Spec.Hosts
			}

			if entry.hasRequestRouting {
				n.Metadata[graph.HasRequestRouting] = true
			}
			if entry.hasRequestTimeout {
				n.Metadata[graph.HasRequestTimeout] = true
			}
			if entry.hasFaultInjection {
				n.Metadata[graph.HasFaultInjection] = true
			}
			if entry.hasTrafficShifting {
				n.Metadata[graph.HasTrafficShifting] = true
			}
			if entry.hasTCPShifting {
				n.Metadata[graph.HasTCPTrafficShifting] = true
			}
			if entry.hasMirroring {
				n.Metadata[graph.HasMirroring] = true
			}
			if entry.isK8sGatewayAPI {
				n.Metadata[graph.IsK8sGatewayAPI] = true
			}

			continue NODES
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
func addLabels(ctx context.Context, trafficMap graph.TrafficMap, gi *GlobalInfo, serviceLists map[string]*models.ServiceList) {
	svcMap := map[serviceKey]models.ServiceOverview{}
	for cluster, serviceList := range serviceLists {
		for _, sd := range serviceList.Services {
			svcMap[serviceKey{Cluster: cluster, Namespace: sd.Namespace, Name: sd.Name}] = sd
		}
	}

	for _, n := range trafficMap {
		var isOutsider bool
		if outside, ok := n.Metadata[graph.IsOutside].(bool); ok {
			isOutsider = outside
		}
		if n.NodeType != graph.NodeTypeService || n.App != "" || isOutsider {
			continue
		}
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

// decorateGateways decorates workload nodes with gateway metadata. It uses the
// pre-cached AllWorkloads to filter locally by label selector instead of calling
// GetAllWorkloads/GetWorkloadList per gateway.
func decorateGateways(ctx context.Context, cluster string, globalInfo *GlobalInfo, gateways []*networkingv1.Gateway, k8sGateways []*k8s_networking_v1.Gateway) {
	allWorkloads := globalInfo.Vendor.AllWorkloads[cluster]

	for _, gw := range gateways {
		selector := labels.Set(gw.Spec.Selector).AsSelector()

		var hostnames []string
		for _, gwServer := range gw.Spec.Servers {
			hostnames = append(hostnames, gwServer.Hosts...)
		}

		for _, w := range allWorkloads {
			if !selector.Matches(labels.Set(w.Labels)) {
				continue
			}
			node := globalInfo.Vendor.WorkloadMap[graph.NodeKey{Cluster: w.Cluster, Namespace: w.Namespace, Name: w.Name}]
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

	k8sGwSelector := func(gwName string) labels.Selector {
		return labels.Set(map[string]string{config.GatewayLabel: gwName}).AsSelector()
	}

	for _, gw := range k8sGateways {
		sel := k8sGwSelector(gw.Name)

		var matched []*models.Workload
		for _, w := range allWorkloads {
			if sel.Matches(labels.Set(w.Labels)) {
				matched = append(matched, w)
			}
		}

		if len(matched) == 0 {
			continue
		} else if len(matched) > 1 {
			log.FromContext(ctx).Warn().Msgf("Multiple workloads found for GatewayAPI %s in namespace %s", gw.Name, gw.Namespace)
		}

		workload := matched[0]
		node := globalInfo.Vendor.WorkloadMap[graph.NodeKey{Cluster: workload.Cluster, Namespace: workload.Namespace, Name: workload.Name}]
		if node != nil {
			var hostnames []string
			for _, gwListener := range gw.Spec.Listeners {
				if gwListener.Hostname != nil {
					hostnames = append(hostnames, string(*gwListener.Hostname))
				}
			}
			if len(hostnames) == 0 {
				hostnames = append(hostnames, "*")
			}
			node.Metadata[graph.IsGatewayAPI] = graph.GatewaysMetadata{gw.Name: hostnames}
		}
	}
}
