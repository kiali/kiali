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

	validations.MergeValidations(m.analyzeSelectorLessSubjects())
	validations.MergeValidations(m.analyzeSelectorSubjects())

	return validations
}

func (m GenericMultiMatchChecker) analyzeSelectorLessSubjects() models.IstioValidations {
	return m.buildSelectorLessSubjectValidations(m.selectorLessSubjects())
}

func (m GenericMultiMatchChecker) selectorLessSubjects() []KeyWithIndex {
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

func (m GenericMultiMatchChecker) buildSelectorLessSubjectValidations(subjects []KeyWithIndex) models.IstioValidations {
	validations := models.IstioValidations{}

	if len(subjects) < 2 {
		return validations
	}

	for _, subjectWithIndex := range subjects {
		references := extractReferences(subjectWithIndex.Index, subjects)
		checks := models.Build(fmt.Sprintf("%s.multimatch.selectorless", m.SubjectType), m.Path)
		validations.MergeValidations(
			models.IstioValidations{
				*subjectWithIndex.Key: &models.IstioValidation{
					Name:       subjectWithIndex.Key.Name,
					ObjectType: subjectWithIndex.Key.ObjectType,
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

func extractReferences(index int, subjects []KeyWithIndex) []models.IstioValidationKey {
	references := make([]models.IstioValidationKey, 0, len(subjects)-1)

	for _, s := range subjects {
		if s.Index != index {
			references = append(references, *s.Key)
		}
	}

	return references
}

func (m GenericMultiMatchChecker) analyzeSelectorSubjects() models.IstioValidations {
	subjects := m.multiMatchSubjects()
	return m.buildSubjectValidations(subjects)
}

func (m GenericMultiMatchChecker) multiMatchSubjects() ReferenceMap {
	workloadSubjects := ReferenceMap{}

	for _, s := range m.Subjects {
		subjectKey := models.BuildKey(m.SubjectType, s.GetObjectMeta().Name, s.GetObjectMeta().Namespace)

		selector := labels.SelectorFromSet(m.GetSelectorLabels(s))
		if selector.Empty() {
			continue
		}

		for _, w := range m.WorkloadList.Workloads {
			if !selector.Matches(labels.Set(w.Labels)) {
				continue
			}

			workloadKey := models.BuildKey(w.Type, w.Name, m.WorkloadList.Namespace.Name)
			workloadSubjects.Add(workloadKey, subjectKey)
		}
	}

	return workloadSubjects
}

func (m GenericMultiMatchChecker) buildSubjectValidations(workloadSubject ReferenceMap) models.IstioValidations {
	validations := models.IstioValidations{}

	for wk, scs := range workloadSubject {
		if !workloadSubject.HasMultipleReferences(wk) {
			continue
		}

		validations.MergeValidations(m.buildMultipleSubjectValidation(scs))
	}

	return validations
}

func (m GenericMultiMatchChecker) buildMultipleSubjectValidation(scs []models.IstioValidationKey) models.IstioValidations {
	validations := models.IstioValidations{}

	for i, sck := range scs {
		// Remove validation subject from references
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
