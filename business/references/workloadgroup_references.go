package references

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type WorkloadGroupReferences struct {
	WorkloadGroups        []*networking_v1.WorkloadGroup
	WorkloadEntries       []*networking_v1.WorkloadEntry
	WorkloadsPerNamespace map[string]models.WorkloadList
}

func (n WorkloadGroupReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, wg := range n.WorkloadGroups {
		key := models.IstioReferenceKey{Namespace: wg.Namespace, Name: wg.Name, ObjectGVK: kubernetes.WorkloadGroups}
		references := &models.IstioReferences{}
		references.WorkloadReferences = n.getWorkloadReferences(wg)
		references.ObjectReferences = n.getConfigReferences(wg)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n WorkloadGroupReferences) getWorkloadReferences(wg *networking_v1.WorkloadGroup) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)

	// Searches Workloads from all namespace
	for _, wls := range n.WorkloadsPerNamespace {
		for _, wl := range wls.Workloads {
			if wg.Namespace == wls.Namespace && wg.Name == wl.Name {
				result = append(result, models.WorkloadReference{Name: wl.Name, Namespace: wls.Namespace})
			}
		}
	}
	return result
}

func (n WorkloadGroupReferences) getConfigReferences(wg *networking_v1.WorkloadGroup) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	if wg.Spec.Template == nil || wg.Spec.Template.Labels == nil {
		return result
	}
	selector := labels.SelectorFromSet(wg.Spec.Template.Labels)
	for _, we := range n.WorkloadEntries {
		weLabelSet := labels.Set(we.Spec.Labels)
		if selector.Matches(weLabelSet) {
			result = append(result, models.IstioReference{Name: we.Name, Namespace: we.Namespace, ObjectGVK: kubernetes.WorkloadEntries})
		}
	}
	return result
}
