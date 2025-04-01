package references

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type DestinationRuleReferences struct {
	Conf                  *config.Config
	DestinationRules      []*networking_v1.DestinationRule
	Namespace             string
	Namespaces            []string
	RegistryServices      []*kubernetes.RegistryService
	ServiceEntries        []*networking_v1.ServiceEntry
	VirtualServices       []*networking_v1.VirtualService
	WorkloadsPerNamespace map[string]models.Workloads
}

func (n DestinationRuleReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, dr := range n.DestinationRules {
		key := models.IstioReferenceKey{Namespace: dr.Namespace, Name: dr.Name, ObjectGVK: kubernetes.DestinationRules}
		references := &models.IstioReferences{}
		seRefs := n.getSEReferences(dr)
		references.ObjectReferences = append(references.ObjectReferences, seRefs...)
		if len(seRefs) == 0 {
			references.ServiceReferences = n.getServiceReferences(dr)
		}
		references.WorkloadReferences = n.getWorkloadReferences(dr)
		references.ObjectReferences = append(references.ObjectReferences, n.getConfigReferences(dr)...)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n DestinationRuleReferences) getServiceReferences(dr *networking_v1.DestinationRule) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)

	fqdn := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, n.Namespaces, n.Conf)
	if !fqdn.IsWildcard() && kubernetes.HasMatchingRegistryService(dr.Namespace, fqdn.String(), n.RegistryServices) {
		result = append(result, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
	}
	return result
}

func (n DestinationRuleReferences) getWorkloadReferences(dr *networking_v1.DestinationRule) []models.WorkloadReference {
	keys := make(map[string]bool)
	allWorkloads := make([]models.WorkloadReference, 0)
	result := make([]models.WorkloadReference, 0)

	host := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, n.Namespaces, n.Conf)
	if host.IsWildcard() {
		return result
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

	// Check workloads
	if len(selectors) == 0 {
		return result
	}

	for _, subset := range dr.Spec.Subsets {
		if len(subset.Labels) > 0 {
			selector := labels.SelectorFromSet(labels.Set(selectors))

			subsetLabelSet := labels.Set(subset.Labels)
			subsetSelector := labels.SelectorFromSet(subsetLabelSet)

			for _, w := range n.WorkloadsPerNamespace[localNs] {
				wlLabelSet := labels.Set(w.Labels)
				if selector.Matches(wlLabelSet) {
					if subsetSelector.Matches(wlLabelSet) {
						allWorkloads = append(allWorkloads, models.WorkloadReference{Name: w.Name, Namespace: localNs})
					}
				}
			}
		}
	}
	// filter unique references
	for _, wl := range allWorkloads {
		if !keys[wl.Name+"/"+wl.Namespace] {
			result = append(result, wl)
			keys[wl.Name+"/"+wl.Namespace] = true
		}
	}
	return result
}

func (n DestinationRuleReferences) getSEReferences(dr *networking_v1.DestinationRule) []models.IstioReference {
	result := make([]models.IstioReference, 0)

	fqdn := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, n.Namespaces, n.Conf)
	if !fqdn.IsWildcard() {
		for _, se := range n.ServiceEntries {
			for _, seHost := range se.Spec.Hosts {
				if seHost == fqdn.String() {
					result = append(result, models.IstioReference{Name: se.Name, Namespace: se.Namespace, ObjectGVK: kubernetes.ServiceEntries})
					continue
				}
			}
		}
	}
	return result
}

func (n DestinationRuleReferences) getConfigReferences(dr *networking_v1.DestinationRule) []models.IstioReference {
	keys := make(map[string]bool)
	allConfigs := make([]models.IstioReference, 0)
	result := make([]models.IstioReference, 0)

	for _, subset := range dr.Spec.Subsets {
		if len(subset.Labels) > 0 {
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
								drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces, n.Conf)
								vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces, n.Conf)
								if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
									allConfigs = append(allConfigs, models.IstioReference{Name: virtualService.Name, Namespace: virtualService.Namespace, ObjectGVK: kubernetes.VirtualServices})
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
								drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces, n.Conf)
								vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces, n.Conf)
								if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
									allConfigs = append(allConfigs, models.IstioReference{Name: virtualService.Name, Namespace: virtualService.Namespace, ObjectGVK: kubernetes.VirtualServices})
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
								drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces, n.Conf)
								vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces, n.Conf)
								if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
									allConfigs = append(allConfigs, models.IstioReference{Name: virtualService.Name, Namespace: virtualService.Namespace, ObjectGVK: kubernetes.VirtualServices})
								}
							}
						}
					}
				}
			}
		}
	}
	// filter unique references
	for _, cf := range allConfigs {
		key := util.BuildNameNSTypeKey(cf.Name, cf.Namespace, cf.ObjectGVK)
		if !keys[key] {
			result = append(result, cf)
			keys[key] = true
		}
	}
	return result
}
