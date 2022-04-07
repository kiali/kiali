package kubernetes

import (
	"fmt"
	"strings"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
)

func FilterAuthorizationPoliciesBySelector(workloadSelector string, authorizationpolicies []security_v1beta1.AuthorizationPolicy) []security_v1beta1.AuthorizationPolicy {
	filtered := []security_v1beta1.AuthorizationPolicy{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, ap := range authorizationpolicies {
		wkLabelsS := []string{}
		if ap.Spec.Selector != nil {
			apSelector := ap.Spec.Selector.MatchLabels
			for k, v := range apSelector {
				wkLabelsS = append(wkLabelsS, k+"="+v)
			}
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, ap)
			}
		}
	}
	return filtered
}

// FilterByHost returns true if a (host, hostNamespace) combination is making
// reference to a (serviceName, svcNamespace) combination.
// Presumably, the host is part of the definition of some Istio Resource. Thus, it
// can take the form of "host", "host.namespace" or "host.namespace.svc", or the
// FQDN "host.namespace.svc.<identity_domain_suffix>". For the cases where
// the host argument takes the simplistic form of only "host", you need to provide
// the hostNamespace argument, which should be set to the namespace of the involved Istio Resource.
// For the other cases, it is safe to omit it. The other arguments are always mandatory.
func FilterByHost(host, hostNamespace, serviceName, svcNamespace string) bool {
	// Check single name
	if host == serviceName && hostNamespace == svcNamespace {
		return true
	}
	// Check service.namespace
	if host == fmt.Sprintf("%s.%s", serviceName, svcNamespace) {
		return true
	}
	// Check the FQDN. <service>.<namespace>.svc
	if host == fmt.Sprintf("%s.%s.%s", serviceName, svcNamespace, "svc") {
		return true
	}

	// Check the FQDN. <service>.<namespace>.svc.<zone>
	if host == fmt.Sprintf("%s.%s.%s", serviceName, svcNamespace, config.Get().ExternalServices.Istio.IstioIdentityDomain) {
		return true
	}

	// Note, FQDN names are defined from Kubernetes registry specification [1]
	// [1] https://github.com/kubernetes/dns/blob/master/docs/specification.md

	return false
}

func FilterDestinationRulesByHostname(allDr []networking_v1beta1.DestinationRule, hostname string) []networking_v1beta1.DestinationRule {
	destinationRules := []networking_v1beta1.DestinationRule{}
	for _, destinationRule := range allDr {
		appendDestinationRule := hostname == ""
		if destinationRule.Spec.Host == hostname {
			appendDestinationRule = true
		}
		if appendDestinationRule {
			destinationRules = append(destinationRules, destinationRule)
		}
	}
	return destinationRules
}

func FilterDestinationRulesByNamespaces(namespaces []string, allDr []networking_v1beta1.DestinationRule) []networking_v1beta1.DestinationRule {
	destinationRules := []networking_v1beta1.DestinationRule{}
	for _, dr := range allDr {
		found := false
		for _, ns := range namespaces {
			if dr.Namespace == ns {
				found = true
				break
			}
		}
		if found {
			destinationRules = append(destinationRules, dr)
		}
	}
	return destinationRules
}

func FilterDestinationRulesByService(allDr []networking_v1beta1.DestinationRule, namespace string, serviceName string) []networking_v1beta1.DestinationRule {
	destinationRules := []networking_v1beta1.DestinationRule{}
	for _, destinationRule := range allDr {
		appendDestinationRule := serviceName == ""
		if FilterByHost(destinationRule.Spec.Host, destinationRule.Namespace, serviceName, namespace) {
			appendDestinationRule = true
		}
		if appendDestinationRule {
			destinationRules = append(destinationRules, destinationRule)
		}
	}
	return destinationRules
}

func FilterEnvoyFiltersBySelector(workloadSelector string, envoyfilters []networking_v1alpha3.EnvoyFilter) []networking_v1alpha3.EnvoyFilter {
	filtered := []networking_v1alpha3.EnvoyFilter{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, ef := range envoyfilters {
		wkLabelsS := []string{}
		if ef.Spec.WorkloadSelector != nil {
			efSelector := ef.Spec.WorkloadSelector.Labels
			for k, v := range efSelector {
				wkLabelsS = append(wkLabelsS, k+"="+v)
			}
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, ef)
			}
		}
	}
	return filtered
}

func FilterGatewaysBySelector(workloadSelector string, gateways []networking_v1beta1.Gateway) []networking_v1beta1.Gateway {
	filtered := []networking_v1beta1.Gateway{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, gw := range gateways {
		wkLabelsS := []string{}
		gwSelector := gw.Spec.Selector
		for k, v := range gwSelector {
			wkLabelsS = append(wkLabelsS, k+"="+v)
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, gw)
			}
		}
	}
	return filtered
}

func FilterGatewaysByVirtualServices(allGws []networking_v1beta1.Gateway, allVs []networking_v1beta1.VirtualService) []networking_v1beta1.Gateway {
	var empty struct{}
	gateways := []networking_v1beta1.Gateway{}
	gatewayNames := make(map[string]struct{})
	for _, vs := range allVs {
		for _, gwn := range vs.Spec.Gateways {
			if !strings.Contains(gwn, "/") {
				gatewayNames[vs.Namespace+"/"+gwn] = empty
			} else {
				gatewayNames[gwn] = empty
			}
		}
	}
	for _, gw := range allGws {
		if _, ok := gatewayNames[gw.Namespace+"/"+gw.Name]; ok {
			gateways = append(gateways, gw)
		}
	}
	return gateways
}

func FilterPodsByController(controllerName string, controllerType string, allPods []core_v1.Pod) []core_v1.Pod {
	var pods []core_v1.Pod
	for _, pod := range allPods {
		for _, ref := range pod.OwnerReferences {
			// TODO: Kind is not a definitive reference. Need to include check for API version as well.
			if ref.Controller != nil && *ref.Controller && ref.Name == controllerName && ref.Kind == controllerType {
				pods = append(pods, pod)
				break
			}
		}
	}
	return pods
}

func FilterPeerAuthenticationByNamespace(namespace string, peerauthentications []security_v1beta1.PeerAuthentication) []security_v1beta1.PeerAuthentication {
	filtered := []security_v1beta1.PeerAuthentication{}
	for _, pa := range peerauthentications {
		if pa.Namespace == namespace {
			filtered = append(filtered, pa)
		}
	}
	return filtered
}

func FilterPeerAuthenticationsBySelector(workloadSelector string, peerauthentications []security_v1beta1.PeerAuthentication) []security_v1beta1.PeerAuthentication {
	filtered := []security_v1beta1.PeerAuthentication{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, pa := range peerauthentications {
		wkLabelsS := []string{}
		if pa.Spec.Selector != nil {
			apSelector := pa.Spec.Selector.MatchLabels
			for k, v := range apSelector {
				wkLabelsS = append(wkLabelsS, k+"="+v)
			}
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, pa)
			}
		}
	}
	return filtered
}

// FilterPodsByEndpoints performs a second pass was selector may return too many data
// This case happens when a "nil" selector (such as one of default/kubernetes service) is used
func FilterPodsByEndpoints(endpoints *core_v1.Endpoints, unfiltered []core_v1.Pod) []core_v1.Pod {
	var pods []core_v1.Pod
	if endpoints == nil {
		return pods
	}
	endpointPods := make(map[string]bool)
	for _, subset := range endpoints.Subsets {
		for _, address := range subset.Addresses {
			if address.TargetRef != nil && address.TargetRef.Kind == "Pod" {
				endpointPods[address.TargetRef.Name] = true
			}
		}
	}

	for _, pod := range unfiltered {
		if _, ok := endpointPods[pod.Name]; ok {
			pods = append(pods, pod)
		}
	}
	return pods
}

func FilterPodsBySelector(selector labels.Selector, allPods []core_v1.Pod) []core_v1.Pod {
	var pods []core_v1.Pod
	for _, pod := range allPods {
		if selector.Matches(labels.Set(pod.ObjectMeta.Labels)) {
			pods = append(pods, pod)
		}
	}
	return pods
}

// FilterPodsByService returns a subpart of pod list filtered according service selector
func FilterPodsByService(s *core_v1.Service, allPods []core_v1.Pod) []core_v1.Pod {
	if s == nil || allPods == nil {
		return nil
	}
	serviceSelector := labels.Set(s.Spec.Selector).AsSelector()
	pods := FilterPodsBySelector(serviceSelector, allPods)

	return pods
}

// Filter Istio registry that are not persent as kubernetes services
func FilterRegistryServicesByServices(registryServices []*RegistryService, services []core_v1.Service) []*RegistryService {
	filtered := []*RegistryService{}
	keys := make(map[string]map[string]struct{})
	for _, svc := range services {
		if _, ok := keys[svc.Namespace]; !ok {
			keys[svc.Namespace] = make(map[string]struct{})
		}
		keys[svc.Namespace][svc.Name] = struct{}{}
	}
	for _, rSvc := range registryServices {
		if _, ok := keys[rSvc.Attributes.Namespace][rSvc.Attributes.Name]; !ok {
			filtered = append(filtered, rSvc)
		}
	}
	return filtered
}

func FilterRegistryServicesBySelector(selector labels.Selector, namespace string, registryServices []*RegistryService) []*RegistryService {
	// From given Registry Services, this method filters those services which are exported to given namespace and have labels matching the given selector
	filtered := []*RegistryService{}
	for _, rSvc := range registryServices {
		// here is a hack with providing own hostname
		if FilterByRegistryService(namespace, rSvc.Hostname, rSvc) && selector.Matches(labels.Set(rSvc.IstioService.Attributes.Labels)) {
			filtered = append(filtered, rSvc)
		}
	}
	return filtered
}

func FilterByRegistryService(namespace string, hostname string, registryService *RegistryService) bool {
	// Basic filter using Hostname, also consider exported Namespaces of Service
	// but for a first iteration if it's found in the registry it will be considered "valid" to reduce the number of false validation errors
	if hostname == registryService.Hostname {
		exportTo := registryService.IstioService.Attributes.ExportTo
		if len(exportTo) > 0 {
			for exportToNs := range exportTo {
				// take only namespaces where it is exported to, exported to the own namespace, or if it is exported to all namespaces
				if exportToNs == "*" || exportToNs == namespace || (exportToNs == "." && registryService.IstioService.Attributes.Namespace == namespace) {
					return true
				}
			}
		} else {
			// no exportTo field, means service exported to all namespaces
			return true
		}
	}
	return false
}

func FilterRequestAuthenticationsBySelector(workloadSelector string, requestauthentications []security_v1beta1.RequestAuthentication) []security_v1beta1.RequestAuthentication {
	filtered := []security_v1beta1.RequestAuthentication{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, ra := range requestauthentications {
		wkLabelsS := []string{}
		if ra.Spec.Selector != nil {
			apSelector := ra.Spec.Selector.MatchLabels
			for k, v := range apSelector {
				wkLabelsS = append(wkLabelsS, k+"="+v)
			}
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, ra)
			}
		}
	}
	return filtered
}

func FilterServicesByLabels(selector labels.Selector, allServices []core_v1.Service) []core_v1.Service {
	var services []core_v1.Service
	for _, svc := range allServices {
		if selector.Matches(labels.Set(svc.ObjectMeta.Labels)) {
			services = append(services, svc)
		}
	}
	return services
}

func FilterServiceEntriesByHostname(serviceEntries []networking_v1beta1.ServiceEntry, hostname string) []networking_v1beta1.ServiceEntry {
	filtered := []networking_v1beta1.ServiceEntry{}
	for _, se := range serviceEntries {
		for _, h := range se.Spec.Hosts {
			if h == hostname {
				filtered = append(filtered, se)
				break
			}
		}
	}
	return filtered
}

func FilterSidecarsBySelector(workloadSelector string, sidecars []networking_v1beta1.Sidecar) []networking_v1beta1.Sidecar {
	filtered := []networking_v1beta1.Sidecar{}
	workloadLabels := mapWorkloadSelector(workloadSelector)
	for _, sc := range sidecars {
		wkLabelsS := []string{}
		if sc.Spec.WorkloadSelector != nil {
			efSelector := sc.Spec.WorkloadSelector.Labels
			for k, v := range efSelector {
				wkLabelsS = append(wkLabelsS, k+"="+v)
			}
		}
		if resourceSelector, err := labels.Parse(strings.Join(wkLabelsS, ",")); err == nil {
			if resourceSelector.Matches(labels.Set(workloadLabels)) {
				filtered = append(filtered, sc)
			}
		}
	}
	return filtered
}

func FilterVirtualServicesByHostname(allVs []networking_v1beta1.VirtualService, hostname string) []networking_v1beta1.VirtualService {
	filtered := []networking_v1beta1.VirtualService{}
	for _, vs := range allVs {
		appendVirtualService := hostname == ""
		if !appendVirtualService {
			for _, httpRoute := range vs.Spec.Http {
				if httpRoute != nil {
					for _, dest := range httpRoute.Route {
						if dest.Destination != nil && dest.Destination.Host == hostname {
							appendVirtualService = true
						}
					}
				}
			}
			if !appendVirtualService {
				for _, tcpRoute := range vs.Spec.Tcp {
					if tcpRoute != nil {
						for _, dest := range tcpRoute.Route {
							if dest.Destination != nil && dest.Destination.Host == hostname {
								appendVirtualService = true
							}
						}
					}
				}
			}
			if !appendVirtualService {
				for _, tlsRoute := range vs.Spec.Tls {
					if tlsRoute != nil {
						for _, dest := range tlsRoute.Route {
							if dest.Destination != nil && dest.Destination.Host == hostname {
								appendVirtualService = true
							}
						}
					}
				}
			}
		}
		if appendVirtualService {
			filtered = append(filtered, vs)
		}
	}
	return filtered
}

func FilterVirtualServicesByService(allVs []networking_v1beta1.VirtualService, namespace string, serviceName string) []networking_v1beta1.VirtualService {
	filtered := []networking_v1beta1.VirtualService{}
	for _, vs := range allVs {
		appendVirtualService := serviceName == ""
		if !appendVirtualService {
			for _, httpRoute := range vs.Spec.Http {
				if httpRoute != nil {
					for _, dest := range httpRoute.Route {
						if dest.Destination != nil && FilterByHost(dest.Destination.Host, vs.Namespace, serviceName, namespace) {
							appendVirtualService = true
						}
					}
				}
			}
			if !appendVirtualService {
				for _, tcpRoute := range vs.Spec.Tcp {
					if tcpRoute != nil {
						for _, dest := range tcpRoute.Route {
							if dest.Destination != nil && FilterByHost(dest.Destination.Host, vs.Namespace, serviceName, namespace) {
								appendVirtualService = true
							}
						}
					}
				}
			}
			if !appendVirtualService {
				for _, tlsRoute := range vs.Spec.Tls {
					if tlsRoute != nil {
						for _, dest := range tlsRoute.Route {
							if dest.Destination != nil && FilterByHost(dest.Destination.Host, vs.Namespace, serviceName, namespace) {
								appendVirtualService = true
							}
						}
					}
				}
			}
		}
		if appendVirtualService {
			filtered = append(filtered, vs)
		}
	}
	return filtered
}

func FilterVirtualServiceByRoute(vs *networking_v1beta1.VirtualService, service string, namespace string) bool {
	if vs == nil {
		return false
	}
	hosts := []string{}
	for _, httpRoute := range vs.Spec.Http {
		for _, httpDes := range httpRoute.Route {
			if httpDes.Destination != nil {
				hosts = append(hosts, httpDes.Destination.Host)
			}
		}
	}
	for _, tcpRoute := range vs.Spec.Tcp {
		for _, tcpDes := range tcpRoute.Route {
			if tcpDes.Destination != nil {
				hosts = append(hosts, tcpDes.Destination.Host)
			}
		}
	}
	for _, tlsRoute := range vs.Spec.Tls {
		for _, tlsDes := range tlsRoute.Route {
			if tlsDes.Destination != nil {
				hosts = append(hosts, tlsDes.Destination.Host)
			}
		}
	}
	for _, h := range hosts {
		if FilterByHost(h, vs.Namespace, service, namespace) {
			return true
		}
	}
	return false
}

func mapWorkloadSelector(workloadSelector string) map[string]string {
	// workloadSelector is a representation of the template labels of a workload
	workloadLabels := map[string]string{}
	aLabels := strings.Split(workloadSelector, ",")
	for _, labels := range aLabels {
		label := strings.Split(labels, "=")
		if len(label) == 2 {
			workloadLabels[label[0]] = label[1]
		} else if len(label) == 1 {
			workloadLabels[label[0]] = ""
		}
	}
	return workloadLabels
}
