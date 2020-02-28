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
		sidecarIndex := sidecarWithIndex.Index
		sidecarKey := sidecarWithIndex.Key
		references := extractReferences(append(sidecars[:sidecarIndex], sidecars[sidecarIndex+1:]...))
		checks := models.Build("sidecar.multimatch", "spec/workloadSelector")
		validations.MergeValidations(
			models.IstioValidations{
				*sidecarWithIndex.Key: &models.IstioValidation{
					Name:       sidecarKey.Name,
					ObjectType: sidecarKey.ObjectType,
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

func extractReferences(withIndex []KeyWithIndex) []models.IstioValidationKey {
	references := make([]models.IstioValidationKey, 0, len(withIndex))

	for _, wi := range withIndex {
		references = append(references, *wi.Key)
	}

	return references
}
