package destinationrules

import (
	"strconv"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoDestinationChecker struct {
	Conf                  *config.Config
	Namespaces            models.Namespaces
	WorkloadsPerNamespace map[string]models.Workloads
	DestinationRule       *networking_v1.DestinationRule
	VirtualServices       []*networking_v1.VirtualService
	ServiceEntries        []*networking_v1.ServiceEntry
	RegistryServices      []*kubernetes.RegistryService
	PolicyAllowAny        bool
}

// Check parses the DestinationRule definitions and verifies that they point to an existing service, including any subset definitions
func (n NoDestinationChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)
	labelValidations := make([]*models.IstioCheck, 0)

	namespace := n.DestinationRule.Namespace

	fqdn := kubernetes.GetHost(n.DestinationRule.Spec.Host, namespace, n.Namespaces.GetNames(), n.Conf)
	// Testing Kubernetes Services + Istio ServiceEntries + Istio Runtime Registry (cross namespace)
	if !n.hasMatchingService(fqdn, namespace) {
		validation := models.Build("destinationrules.nodest.matchingregistry", "spec/host")
		if n.PolicyAllowAny {
			validation.Severity = models.WarningSeverity
		}
		valid = false
		validations = append(validations, &validation)
	} else if len(n.DestinationRule.Spec.Subsets) > 0 {
		// Check that each subset has a matching workload somewhere..
		hasLabel := false
		for i, subset := range n.DestinationRule.Spec.Subsets {
			if len(subset.Labels) > 0 {
				if !n.hasMatchingWorkload(fqdn, subset.Labels) {
					validation := models.Build("destinationrules.nodest.subsetlabels",
						"spec/subsets["+strconv.Itoa(i)+"]")
					if n.isSubsetReferenced(n.DestinationRule.Spec.Host, subset.Name) {
						valid = false
					} else {
						validation.Severity = models.Unknown
					}
					validations = append(validations, &validation)
				} else {
					hasLabel = true
				}
			} else {
				validation := models.Build("destinationrules.nodest.subsetnolabels",
					"spec/subsets["+strconv.Itoa(i)+"]")
				labelValidations = append(labelValidations, &validation)
				// Not changing valid value, if other subset is on error, a valid = false has priority
			}
		}
		for _, v := range labelValidations {
			if hasLabel {
				v.Severity = models.Unknown
			}
			validations = append(validations, v)
		}
	}
	return validations, valid
}

func (n NoDestinationChecker) hasMatchingWorkload(host kubernetes.Host, subsetLabels map[string]string) bool {
	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if host.IsWildcard() {
		return true
	}

	// Covering 'servicename.namespace' host format scenario
	localSvc, localNs := kubernetes.ParseTwoPartHost(host)

	var selectors map[string]string

	// Find the correct service
	for _, s := range n.RegistryServices {
		if s.Attributes.Name == localSvc && s.Attributes.Namespace == localNs {
			selectors = s.Attributes.LabelSelectors
			break
		}
	}

	subsetLabelSet := labels.Set(subsetLabels)
	subsetSelector := labels.SelectorFromSet(subsetLabelSet)

	// Check workloads
	if len(selectors) != 0 {
		selector := labels.SelectorFromSet(labels.Set(selectors))

		for _, w := range n.WorkloadsPerNamespace[localNs] {
			wLabelSet := labels.Set(w.Labels)
			if selector.Matches(wLabelSet) {
				if subsetSelector.Matches(wLabelSet) {
					return true
				}
			}
		}
	} else {
		// Check Service Entries
		for _, se := range n.ServiceEntries {
			for _, ep := range se.Spec.Endpoints {
				epLabelSet := labels.Set(ep.Labels)
				if subsetSelector.Matches(epLabelSet) {
					return true
				}
			}
		}
	}
	return false
}

func (n NoDestinationChecker) hasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if host.IsWildcard() {
		return true
	}

	// Covering 'servicename.namespace' host format scenario
	localSvc, localNs := kubernetes.ParseTwoPartHost(host)

	if localNs == itemNamespace {
		// Check Workloads
		if matches := kubernetes.HasMatchingWorkloads(localSvc, n.WorkloadsPerNamespace[localNs].GetLabels(), n.Conf); matches {
			return matches
		}
	}

	// Check ServiceEntries
	if kubernetes.HasMatchingServiceEntries(host.String(), kubernetes.ServiceEntryHostnames(n.ServiceEntries)) {
		return true
	}

	// Use RegistryService to check destinations that may not be covered with previous check
	// i.e. Multi-cluster or Federation validations
	if kubernetes.HasMatchingRegistryService(itemNamespace, host.String(), n.RegistryServices) {
		return true
	}
	return false
}

func (n NoDestinationChecker) isSubsetReferenced(host string, subset string) bool {
	virtualServices, ok := n.getVirtualServices(host, subset)
	if ok && len(virtualServices) > 0 {
		return true
	}

	return false
}

func (n NoDestinationChecker) getVirtualServices(virtualServiceHost string, virtualServiceSubset string) ([]*networking_v1.VirtualService, bool) {
	vss := make([]*networking_v1.VirtualService, 0, len(n.VirtualServices))

	for _, virtualService := range n.VirtualServices {

		if len(virtualService.Spec.Http) > 0 {
			for _, httpRoute := range virtualService.Spec.Http {
				if httpRoute == nil {
					continue
				}
				if len(httpRoute.Route) > 0 {
					for _, dest := range httpRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						subset := dest.Destination.Subset
						drHost := kubernetes.GetHost(host, n.DestinationRule.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(virtualServiceHost, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						// Host could be in another namespace (FQDN)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) && subset == virtualServiceSubset {
							vss = append(vss, virtualService)
						}
					}
				}
			}
		}

		if len(virtualService.Spec.Tcp) > 0 {
			for _, tcpRoute := range virtualService.Spec.Tcp {
				if tcpRoute == nil {
					continue
				}
				if len(tcpRoute.Route) > 0 {
					for _, dest := range tcpRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						subset := dest.Destination.Subset
						drHost := kubernetes.GetHost(host, n.DestinationRule.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(virtualServiceHost, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						// Host could be in another namespace (FQDN)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) && subset == virtualServiceSubset {
							vss = append(vss, virtualService)
						}
					}
				}
			}
		}

		if len(virtualService.Spec.Tls) > 0 {
			for _, tlsRoute := range virtualService.Spec.Tls {
				if tlsRoute == nil {
					continue
				}
				if len(tlsRoute.Route) > 0 {
					for _, dest := range tlsRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						subset := dest.Destination.Subset
						drHost := kubernetes.GetHost(host, n.DestinationRule.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(virtualServiceHost, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						// Host could be in another namespace (FQDN)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) && subset == virtualServiceSubset {
							vss = append(vss, virtualService)
						}
					}
				}
			}
		}
	}

	return vss, len(vss) > 0
}
