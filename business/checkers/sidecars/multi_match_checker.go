package sidecars

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const SidecarCheckerType = "sidecar"

type MultiMatchChecker struct {
	Sidecars []kubernetes.IstioObject
}

type KeyWithIndex struct {
	Index int
	Key   *models.IstioValidationKey
}

func (m MultiMatchChecker) Check() models.IstioValidations {
	swi := m.selectorLessSidecars()
	return buildSidecarValidations(swi)
}

func (m MultiMatchChecker) selectorLessSidecars() []KeyWithIndex {
	swi := make([]KeyWithIndex, 0, len(m.Sidecars))

	for i, s := range m.Sidecars {
		add := false

		if ws, found := s.GetSpec()["workloadSelector"]; found {
			if wsCasted, ok := ws.(map[string]interface{}); ok {
				if _, found := wsCasted["labels"]; !found {
					add = true
				}
			}
		} else {
			add = true
		}

		if add {
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

func buildSidecarValidations(sidecars []KeyWithIndex) models.IstioValidations {
	validations := models.IstioValidations{}

	if len(sidecars) < 2 {
		return validations
	}

	for _, sidecarWithIndex := range sidecars {
		references := extractReferences(sidecarWithIndex.Index, sidecars)
		checks := models.Build("sidecar.multimatch", "spec/workloadSelector")
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
