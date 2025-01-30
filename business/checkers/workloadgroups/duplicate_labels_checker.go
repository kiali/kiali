package workloadgroups

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type DuplicateLabelsChecker struct {
	Cluster        string
	existingList   map[string][]Group
	WorkloadGroups []*networking_v1.WorkloadGroup
}

type Group struct {
	Name      string
	Namespace string
	Labels    map[string]string
}

// Check validates that no more than one Workload Group in the same namespace with the same labels
func (d DuplicateLabelsChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	d.existingList = map[string][]Group{}
	// Create the map of namespace to WorkloadGroup list
	for _, wg := range d.WorkloadGroups {
		if wg.Spec.Metadata != nil {
			d.existingList[wg.Namespace] = append(d.existingList[wg.Namespace], Group{
				Name:      wg.Name,
				Namespace: wg.Namespace,
				Labels:    wg.Spec.Metadata.Labels,
			})
		}
	}

	for _, wg := range d.WorkloadGroups {
		if wg.Spec.Metadata != nil {
			duplicate, dGroups := d.findMatch(wg.Name, wg.Namespace, wg.Spec.Metadata.Labels)
			if duplicate {
				key, validation := createError(wg.Name, wg.Namespace, d.Cluster, dGroups)
				validations.MergeValidations(models.IstioValidations{key: validation})
			}
		}
	}

	return validations
}

func (d DuplicateLabelsChecker) findMatch(name, namespace string, labels map[string]string) (bool, []Group) {
	duplicates := make([]Group, 0)

	for _, g := range d.existingList[namespace] {
		// skip ongoing WorkloadGroup
		// consider matched those which Labels are equal
		// sort labels to compare
		if g.Name != name && util.LabelsToSortedString(g.Labels) == util.LabelsToSortedString(labels) {
			duplicates = append(duplicates, g)
		}
	}
	return len(duplicates) > 0, duplicates
}

func createError(name, namespace, cluster string, duplicates []Group) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: name, Namespace: namespace, ObjectGVK: kubernetes.WorkloadGroups, Cluster: cluster}
	references := make([]models.IstioValidationKey, 0, len(duplicates))
	for _, d := range duplicates {
		references = append(references, models.IstioValidationKey{Name: d.Name, Namespace: d.Namespace, ObjectGVK: kubernetes.WorkloadGroups, Cluster: cluster})
	}
	checks := models.Build("workloadgroup.labels.duplicate", "spec/metadata/labels")
	rrValidation := &models.IstioValidation{
		Cluster:   cluster,
		Name:      name,
		Namespace: namespace,
		ObjectGVK: kubernetes.WorkloadGroups,
		Valid:     false,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: references,
	}

	return key, rrValidation
}
