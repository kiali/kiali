package references

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type ServiceEntryReferences struct {
	Namespace             string
	Namespaces            models.Namespaces
	ServiceEntries        []*networking_v1.ServiceEntry
	Sidecars              []*networking_v1.Sidecar
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	DestinationRules      []*networking_v1.DestinationRule
	RegistryServices      []*kubernetes.RegistryService
}

func (n ServiceEntryReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, se := range n.ServiceEntries {
		key := models.IstioReferenceKey{Namespace: se.Namespace, Name: se.Name, ObjectType: kubernetes.ServiceEntries.String()}
		references := &models.IstioReferences{}
		references.ObjectReferences = append(references.ObjectReferences, n.getConfigReferences(se)...)
		references.ServiceReferences = append(references.ServiceReferences, n.getServiceReferences(se)...)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result

}

func (n ServiceEntryReferences) getConfigReferences(se *networking_v1.ServiceEntry) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, dr := range n.DestinationRules {
		fqdn := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, n.Namespaces.GetNames())
		if !fqdn.IsWildcard() {
			for _, seHost := range se.Spec.Hosts {
				if seHost == fqdn.String() {
					result = append(result, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectType: kubernetes.DestinationRules.String()})
					continue
				}
			}
		}
	}
	for _, sc := range n.Sidecars {
		for _, ei := range sc.Spec.Egress {
			if ei == nil {
				continue
			}
			if len(ei.Hosts) > 0 {
				for _, h := range ei.Hosts {
					hostNs, dnsName, _ := getHostComponents(h)
					if hostNs == "*" || hostNs == "~" || hostNs == "." || dnsName == "*" {
						continue
					}
					fqdn := kubernetes.ParseHost(dnsName, hostNs)

					if se.Namespace != hostNs {
						continue
					}
					for _, seHost := range se.Spec.Hosts {
						if seHost == fqdn.String() {
							result = append(result, models.IstioReference{Name: sc.Name, Namespace: sc.Namespace, ObjectType: kubernetes.Sidecars.String()})
							break
						}
					}
				}
			}
		}
	}
	result = append(result, n.getAuthPoliciesReferences(se)...)
	return result
}

func (n ServiceEntryReferences) getAuthPoliciesReferences(se *networking_v1.ServiceEntry) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, ap := range n.AuthorizationPolicies {
		namespace := ap.Namespace
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
							for _, seHost := range se.Spec.Hosts {
								if seHost == fqdn.String() {
									result = append(result, models.IstioReference{Name: ap.Name, Namespace: ap.Namespace, ObjectType: kubernetes.AuthorizationPolicies.String()})
									continue
								}
							}
						}
					}
				}
			}
		}
	}
	return result
}

func (n ServiceEntryReferences) getServiceReferences(se *networking_v1.ServiceEntry) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	keys := make(map[string]bool)
	allServices := make([]models.ServiceReference, 0)
	for _, seHost := range se.Spec.Hosts {
		for _, rStatus := range n.RegistryServices {
			if kubernetes.FilterByRegistryService(se.Namespace, seHost, rStatus) {
				allServices = append(allServices, models.ServiceReference{Name: rStatus.Hostname, Namespace: rStatus.IstioService.Attributes.Namespace})
			}
		}
	}
	// filter unique references
	for _, s := range allServices {
		key := util.BuildNameNSKey(s.Name, s.Namespace)
		if !keys[key] {
			result = append(result, s)
			keys[key] = true
		}
	}
	return result
}
