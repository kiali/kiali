package references

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DestinationRuleReferences struct {
	Namespace             string
	Namespaces            models.Namespaces
	DestinationRules      []networking_v1alpha3.DestinationRule
	WorkloadsPerNamespace map[string]models.WorkloadList
	RegistryServices      []*kubernetes.RegistryService
}

func (n DestinationRuleReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, dr := range n.DestinationRules {
		key := models.IstioReferenceKey{Namespace: dr.Namespace, Name: dr.Name, ObjectType: models.ObjectTypeSingular[kubernetes.DestinationRules]}
		references := &models.IstioReferences{}
		references.ServiceReferences = n.getServiceReferences(dr)
		references.WorkloadReferences = n.getWorkloadReferences(dr)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n DestinationRuleReferences) getServiceReferences(dr networking_v1alpha3.DestinationRule) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)

	fqdn := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, dr.ClusterName, n.Namespaces.GetNames())
	return append(result, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
}

func (n DestinationRuleReferences) getWorkloadReferences(dr networking_v1alpha3.DestinationRule) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)

	host := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, dr.ClusterName, n.Namespaces.GetNames())
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

			for _, wl := range n.WorkloadsPerNamespace[localNs].Workloads {
				wlLabelSet := labels.Set(wl.Labels)
				if selector.Matches(wlLabelSet) {
					if subsetSelector.Matches(wlLabelSet) {
						result = append(result, models.WorkloadReference{Name: wl.Name, Namespace: localNs})
					}
				}
			}
		}
	}
	return result
}
