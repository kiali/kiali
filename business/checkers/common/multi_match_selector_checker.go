package common

import (
	"fmt"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GenericMultiMatchChecker struct {
	SubjectType       string
	Subjects          []kubernetes.IstioObject
	WorkloadList      models.WorkloadList
	HasSelector       func(s kubernetes.IstioObject) bool
	GetSelectorLabels func(s kubernetes.IstioObject) map[string]string
	Path              string
}

func SelectorMultiMatchChecker(subjectType string, subjects []kubernetes.IstioObject, workloadList models.WorkloadList) GenericMultiMatchChecker {
	return GenericMultiMatchChecker{
		SubjectType:       subjectType,
		Subjects:          subjects,
		WorkloadList:      workloadList,
		HasSelector:       HasSelector,
		GetSelectorLabels: GetSelectorLabels,
		Path:              "spec/selector",
	}
}

func WorkloadSelectorMultiMatchChecker(subjectType string, subjects []kubernetes.IstioObject, workloadList models.WorkloadList) GenericMultiMatchChecker {
	return GenericMultiMatchChecker{
		SubjectType:       subjectType,
		Subjects:          subjects,
		WorkloadList:      workloadList,
		HasSelector:       HasWorkloadSelector,
		GetSelectorLabels: GetWorkloadSelectorLabels,
		Path:              "spec/workloadSelector",
	}
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

func (m GenericMultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(m.analyzeSelectorLessSidecars())
	validations.MergeValidations(m.analyzeSelectorSidecars())

	return validations
}

func (m GenericMultiMatchChecker) analyzeSelectorLessSidecars() models.IstioValidations {
	return m.buildSelectorLessSidecarValidations(m.selectorLessSidecars())
}

func (m GenericMultiMatchChecker) selectorLessSidecars() []KeyWithIndex {
	swi := make([]KeyWithIndex, 0, len(m.Subjects))

	for i, s := range m.Subjects {
		if !m.HasSelector(s) {
			swi = append(swi, KeyWithIndex{
				Index: i,
				Key: &models.IstioValidationKey{
					Name:       s.GetObjectMeta().Name,
					Namespace:  s.GetObjectMeta().Namespace,
					ObjectType: m.SubjectType,
				},
			},
			)
		}
	}
	return swi
}

func (m GenericMultiMatchChecker) buildSelectorLessSidecarValidations(sidecars []KeyWithIndex) models.IstioValidations {
	validations := models.IstioValidations{}

	if len(sidecars) < 2 {
		return validations
	}

	for _, sidecarWithIndex := range sidecars {
		references := extractReferences(sidecarWithIndex.Index, sidecars)
		checks := models.Build(fmt.Sprintf("%s.multimatch.selectorless", m.SubjectType), m.Path)
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
	references := make([]models.IstioValidationKey, 0, len(sidecars)-1)

	for _, s := range sidecars {
		if s.Index != index {
			references = append(references, *s.Key)
		}
	}

	return references
}

func (m GenericMultiMatchChecker) analyzeSelectorSidecars() models.IstioValidations {
	sidecars := m.multiMatchSidecars()
	return m.buildSidecarValidations(sidecars)
}

func (m GenericMultiMatchChecker) multiMatchSidecars() ReferenceMap {
	workloadSidecars := ReferenceMap{}

	for _, s := range m.Subjects {
		sidecarKey := models.BuildKey(m.SubjectType, s.GetObjectMeta().Name, s.GetObjectMeta().Namespace)

		selector := labels.SelectorFromSet(m.GetSelectorLabels(s))
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

func (m GenericMultiMatchChecker) buildSidecarValidations(workloadSidecar ReferenceMap) models.IstioValidations {
	validations := models.IstioValidations{}

	for wk, scs := range workloadSidecar {
		if !workloadSidecar.HasMultipleReferences(wk) {
			continue
		}

		validations.MergeValidations(m.buildMultipleSidecarsValidation(scs))
	}

	return validations
}

func (m GenericMultiMatchChecker) buildMultipleSidecarsValidation(scs []models.IstioValidationKey) models.IstioValidations {
	validations := models.IstioValidations{}

	for i, sck := range scs {
		// Remove validation sidecar from references
		refs := make([]models.IstioValidationKey, 0, len(scs)-1)
		refs = append(refs, scs[:i]...)
		if len(scs) > i {
			refs = append(refs, scs[i+1:]...)
		}

		checks := models.Build(fmt.Sprintf("%s.multimatch.selector", m.SubjectType), m.Path)
		validation := models.IstioValidations{
			sck: &models.IstioValidation{
				Name:       sck.Name,
				ObjectType: m.SubjectType,
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

func GetWorkloadSelectorLabels(s kubernetes.IstioObject) map[string]string {
	return getLabels("workloadSelector", "labels", s)
}

func GetSelectorLabels(s kubernetes.IstioObject) map[string]string {
	return getLabels("selector", "matchLabels", s)
}

func HasSelector(s kubernetes.IstioObject) bool {
	return s.HasMatchLabelsSelector()
}

func HasWorkloadSelector(s kubernetes.IstioObject) bool {
	return s.HasWorkloadSelectorLabels()
}

// getLabels return the labels of the workloads that the rule be applied to.
// There are two possible ways to define those labels:
// 1. selector: matchLabels: app: productpage
// 2. workloadSelector: labels: app: productpage
// selectorName param: name of the first key (selector, workloadSelector)
// labelsName param: name of the second key (matchLabels, labels)
func getLabels(selectorName, labelsName string, s kubernetes.IstioObject) map[string]string {
	ws, found := s.GetSpec()[selectorName]
	if !found {
		return nil
	}

	wsCasted, ok := ws.(map[string]interface{})
	if !ok {
		return nil
	}

	labels, found := wsCasted[labelsName]
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
