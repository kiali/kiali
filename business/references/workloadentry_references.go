package references

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type WorkloadEntryReferences struct {
	WorkloadGroups  []*networking_v1.WorkloadGroup
	WorkloadEntries []*networking_v1.WorkloadEntry
}

func (n WorkloadEntryReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, we := range n.WorkloadEntries {
		key := models.IstioReferenceKey{Namespace: we.Namespace, Name: we.Name, ObjectGVK: kubernetes.WorkloadEntries}
		references := &models.IstioReferences{}
		references.ObjectReferences = n.getConfigReferences(we)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n WorkloadEntryReferences) getConfigReferences(we *networking_v1.WorkloadEntry) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	if we.Spec.Labels == nil {
		return result
	}
	weLabelSet := labels.Set(we.Spec.Labels)
	for _, wg := range n.WorkloadGroups {
		if wg.Spec.Template == nil || wg.Spec.Template.Labels == nil {
			continue
		}
		selector := labels.SelectorFromSet(wg.Spec.Template.Labels)
		if selector.Matches(weLabelSet) {
			result = append(result, models.IstioReference{Name: wg.Name, Namespace: wg.Namespace, ObjectGVK: kubernetes.WorkloadGroups})
		}
	}
	return result
}
