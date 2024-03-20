package references

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type AuthorizationPolicyReferences struct {
	AuthorizationPolicies []*security_v1beta.AuthorizationPolicy
	Namespace             string
	Namespaces            models.Namespaces
	ServiceEntries        []*networking_v1beta1.ServiceEntry
	VirtualServices       []*networking_v1beta1.VirtualService
	RegistryServices      []*kubernetes.RegistryService
	WorkloadsPerNamespace map[string]models.WorkloadList
}

func (n AuthorizationPolicyReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, ap := range n.AuthorizationPolicies {
		namespace := ap.Namespace
		key := models.IstioReferenceKey{Namespace: namespace, Name: ap.Name, ObjectType: models.ObjectTypeSingular[kubernetes.AuthorizationPolicies]}
		references := &models.IstioReferences{}
		for _, rule := range ap.Spec.Rules {
			if rule == nil {
				continue
			}
			if len(rule.To) > 0 {
				for _, t := range rule.To {
					if t == nil || t.Operation == nil || len(t.Operation.Hosts) == 0 {
						continue
					}
					for _, h := range t.Operation.Hosts {
						fqdn := kubernetes.GetHost(h, namespace, n.Namespaces.GetNames())
						if !fqdn.IsWildcard() {
							configRef := n.getConfigReferences(fqdn)
							references.ObjectReferences = append(references.ObjectReferences, configRef...)
							// if No ServiceEntry or VS is found, look into Services as RegistryServices contains all
							if len(configRef) == 0 {
								references.ServiceReferences = append(references.ServiceReferences, n.getServiceReferences(fqdn, namespace)...)
							}
						}
					}
				}
			}
		}
		references.WorkloadReferences = append(references.WorkloadReferences, n.getWorkloadReferences(ap)...)
		ir := make(models.IstioReferencesMap)
		ir[key] = references
		result.MergeReferencesMap(ir)
	}

	return result
}

func (n AuthorizationPolicyReferences) getServiceReferences(host kubernetes.Host, itemNamespace string) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	if kubernetes.HasMatchingRegistryService(itemNamespace, host.String(), n.RegistryServices) {
		result = append(result, models.ServiceReference{Name: host.Service, Namespace: host.Namespace})
	}
	return result
}

func (n AuthorizationPolicyReferences) getConfigReferences(host kubernetes.Host) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, se := range n.ServiceEntries {
		for _, seHost := range se.Spec.Hosts {
			if seHost == host.String() {
				result = append(result, models.IstioReference{Name: se.Name, Namespace: se.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.ServiceEntries]})
				continue
			}
		}
	}
	for _, vs := range n.VirtualServices {
		for hostIdx := 0; hostIdx < len(vs.Spec.Hosts); hostIdx++ {
			vHost := vs.Spec.Hosts[hostIdx]

			hostS := kubernetes.ParseHost(vHost, vs.Namespace)
			if hostS.String() == host.String() {
				result = append(result, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]})
				continue
			}
		}
	}
	return result
}

func (n AuthorizationPolicyReferences) getWorkloadReferences(ap *security_v1beta.AuthorizationPolicy) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)
	if ap.Spec.Selector != nil {
		selector := labels.SelectorFromSet(ap.Spec.Selector.MatchLabels)

		// AuthPolicy searches Workloads from own namespace, or from all namespaces when AuthPolicy is in root namespace
		for _, wls := range n.WorkloadsPerNamespace {
			if !config.IsRootNamespace(ap.Namespace) && wls.Namespace.Name != ap.Namespace {
				continue
			}
			for _, wl := range wls.Workloads {
				wlLabelSet := labels.Set(wl.Labels)
				if selector.Matches(wlLabelSet) {
					result = append(result, models.WorkloadReference{Name: wl.Name, Namespace: wls.Namespace.Name})
				}
			}
		}
	}
	return result
}
