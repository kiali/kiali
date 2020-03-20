package sidecars

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const SidecarCheckerType = "sidecar"

type MultiMatchChecker struct {
	Sidecars     []kubernetes.IstioObject
	WorkloadList models.WorkloadList
}

type KeyWithIndex struct {
	Index int
	Key   *models.IstioValidationKey
}

type ReferenceMap map[models.IstioValidationKey][]models.IstioValidationKey

func (ws ReferenceMap) Add(wk, sk models.IstioValidationKey) {
	ws[wk] = append(ws[wk], sk)
}

func (ws ReferenceMap) Get(wk models.IstioValidationKey) []models.IstioValidationKey {
	return ws[wk]
}

func (ws ReferenceMap) HasMultipleReferences(wk models.IstioValidationKey) bool {
	return len(ws.Get(wk)) > 1
}

func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(m.analyzeSelectorLessSidecars())
	validations.MergeValidations(m.analyzeSelectorSidecars())

	return validations
}

func (m MultiMatchChecker) analyzeSelectorLessSidecars() models.IstioValidations {
	swi := m.selectorLessSidecars()
	return buildSelectorLessSidecarValidations(swi)
}

func (m MultiMatchChecker) selectorLessSidecars() []KeyWithIndex {
	swi := make([]KeyWithIndex, 0, len(m.Sidecars))

	for i, s := range m.Sidecars {
		if !s.HasWorkloadSelectorLabels() {
			swi = append(swi, KeyWithIndex{
				Index: i,
				Key: &models.IstioValidationKey{
					Name:       s.GetObjectMeta().Name,
					Namespace:  s.GetObjectMeta().Namespace,
					ObjectType: SidecarCheckerType,
				},
			},
			)
		}
	}
	return swi
}

func buildSelectorLessSidecarValidations(sidecars []KeyWithIndex) models.IstioValidations {
	validations := models.IstioValidations{}

	if len(sidecars) < 2 {
		return validations
	}

	for _, sidecarWithIndex := range sidecars {
		references := extractReferences(sidecarWithIndex.Index, sidecars)
		checks := models.Build("sidecar.multimatch.selectorless", "spec/workloadSelector")
		validations.MergeValidations(
			models.IstioValidations{
				*sidecarWithIndex.Key: &models.IstioValidation{
					Name:       sidecarWithIndex.Key.Name,
					ObjectType: sidecarWithIndex.Key.ObjectType,
					Valid:      false,
					References: references,
					Checks: []*models.IstioCheck{
						&checks,
					},
				},
			},
		)
	}
	return validations
}

func extractReferences(index int, sidecars []KeyWithIndex) []models.IstioValidationKey {
	references := make([]models.IstioValidationKey, 0, len(sidecars))
	filtered := make([]KeyWithIndex, 0, len(sidecars)-1)

	// Exclude item at index position
	filtered = append(filtered, sidecars[:index]...)
	if len(sidecars) > index+1 {
		filtered = append(filtered, sidecars[index+1:]...)
	}

	for _, s := range filtered {
		references = append(references, *s.Key)
	}

	return references
}

func (m MultiMatchChecker) analyzeSelectorSidecars() models.IstioValidations {
	sidecars := m.multiMatchSidecars()
	return m.buildSidecarValidations(sidecars)
}

func (m MultiMatchChecker) multiMatchSidecars() ReferenceMap {
	workloadSidecars := ReferenceMap{}

	for _, s := range m.Sidecars {
		sidecarKey := models.BuildKey(SidecarCheckerType, s.GetObjectMeta().Name, s.GetObjectMeta().Namespace)

		selector := labels.SelectorFromSet(labels.Set(getWorkloadSelectorLabels(s)))
		if selector.Empty() {
			continue
		}

		for _, w := range m.WorkloadList.Workloads {
			if !selector.Matches(labels.Set(w.Labels)) {
				continue
			}

			workloadKey := models.BuildKey(w.Type, w.Name, m.WorkloadList.Namespace.Name)
			workloadSidecars.Add(workloadKey, sidecarKey)
		}
	}

	return workloadSidecars
}

func (m MultiMatchChecker) buildSidecarValidations(workloadSidecar ReferenceMap) models.IstioValidations {
	validations := models.IstioValidations{}

	for wk, scs := range workloadSidecar {
		if !workloadSidecar.HasMultipleReferences(wk) {
			continue
		}

		validations.MergeValidations(buildMultipleSidecarsValidation(scs))
	}

	return validations
}

func buildMultipleSidecarsValidation(scs []models.IstioValidationKey) models.IstioValidations {
	validations := models.IstioValidations{}

	for i, sck := range scs {
		// Remove validation sidecar from references
		refs := make([]models.IstioValidationKey, 0, len(scs)-1)
		refs = append(refs, scs[:i]...)
		if len(scs) > i {
			refs = append(refs, scs[i+1:]...)
		}

		checks := models.Build("sidecar.multimatch.selector", "spec/workloadSelector")
		validation := models.IstioValidations{
			sck: &models.IstioValidation{
				Name:       sck.Name,
				ObjectType: SidecarCheckerType,
				Valid:      false,
				References: refs,
				Checks: []*models.IstioCheck{
					&checks,
				},
			},
		}

		validations.MergeValidations(validation)
	}

	return validations
}

func getWorkloadSelectorLabels(s kubernetes.IstioObject) map[string]string {
	ws, found := s.GetSpec()["workloadSelector"]
	if !found {
		return nil
	}

	wsCasted, ok := ws.(map[string]interface{})
	if !ok {
		return nil
	}

	labels, found := wsCasted["labels"]
	if !found {
		return nil
	}

	labCast, ok := labels.(map[string]interface{})
	if !ok {
		return nil
	}

	labs := map[string]string{}
	for i, k := range labCast {
		val, ok := k.(string)
		if !ok {
			continue
		}

		labs[i] = val
	}

	return labs
}
