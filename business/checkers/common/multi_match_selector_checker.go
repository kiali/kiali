package common

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/models"
)

type GenericMultiMatchChecker struct {
	SubjectType  string
	Keys         []models.IstioValidationKey
	Selectors    map[int]map[string]string
	WorkloadList models.WorkloadList
	Path         string
	skipSelSubj  bool
}

func PeerAuthenticationMultiMatchChecker(subjectType string, pa []security_v1beta.PeerAuthentication, workloadList models.WorkloadList) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(pa))
	for i, p := range pa {
		key := models.IstioValidationKey{
			ObjectType: subjectType,
			Name:       p.Name,
			Namespace:  p.Namespace,
		}
		keys = append(keys, key)
		selectors[i] = make(map[string]string)
		if p.Spec.Selector != nil {
			selectors[i] = p.Spec.Selector.MatchLabels
		}
	}
	return GenericMultiMatchChecker{
		SubjectType:  subjectType,
		Keys:         keys,
		Selectors:    selectors,
		WorkloadList: workloadList,
		Path:         "spec/selector",
		skipSelSubj:  false,
	}
}

func RequestAuthenticationMultiMatchChecker(subjectType string, ra []security_v1beta.RequestAuthentication, workloadList models.WorkloadList) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(ra))
	for i, r := range ra {
		key := models.IstioValidationKey{
			ObjectType: subjectType,
			Name:       r.Name,
			Namespace:  r.Namespace,
		}
		keys = append(keys, key)
		selectors[i] = make(map[string]string)
		if r.Spec.Selector != nil {
			selectors[i] = r.Spec.Selector.MatchLabels
		}
	}
	// For RequestAuthentication, when more than one policy matches a workload, Istio combines all rules as if they were specified as a single policy.
	// So skip multi match validation
	return GenericMultiMatchChecker{
		SubjectType:  subjectType,
		Keys:         keys,
		Selectors:    selectors,
		WorkloadList: workloadList,
		Path:         "spec/selector",
		skipSelSubj:  true,
	}
}

func SidecarSelectorMultiMatchChecker(subjectType string, sc []networking_v1alpha3.Sidecar, workloadList models.WorkloadList) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(sc))
	i := 0
	for _, s := range sc {
		if s.Namespace != workloadList.Namespace.Name {
			// Workloads from Sidecar's own Namespaces only are considered in Selector
			continue
		}
		key := models.IstioValidationKey{
			ObjectType: subjectType,
			Name:       s.Name,
			Namespace:  s.Namespace,
		}
		keys = append(keys, key)
		selectors[i] = make(map[string]string)
		if s.Spec.WorkloadSelector != nil {
			selectors[i] = s.Spec.WorkloadSelector.Labels
		}
		i++
	}
	return GenericMultiMatchChecker{
		SubjectType:  subjectType,
		Keys:         keys,
		Selectors:    selectors,
		WorkloadList: workloadList,
		Path:         "spec/workloadSelector",
		skipSelSubj:  false,
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
	if !m.skipSelSubj {
		validations.MergeValidations(m.analyzeSelectorSubjects())
	}

	return validations
}

func (m GenericMultiMatchChecker) analyzeSelectorLessSubjects() models.IstioValidations {
	return m.buildSelectorLessSubjectValidations(m.selectorLessSubjects())
}

func (m GenericMultiMatchChecker) selectorLessSubjects() []KeyWithIndex {
	swi := make([]KeyWithIndex, 0, len(m.Keys))
	for i, k := range m.Keys {
		if len(m.Selectors[i]) == 0 {
			swi = append(swi, KeyWithIndex{
				Index: i,
				Key: &models.IstioValidationKey{
					ObjectType: k.ObjectType,
					Name:       k.Name,
					Namespace:  k.Namespace,
				},
			})
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
		checks := models.Build("generic.multimatch.selectorless", m.Path)
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

	for i, s := range m.Keys {
		subjectKey := models.BuildKey(m.SubjectType, s.Name, s.Namespace)

		selector := labels.SelectorFromSet(m.Selectors[i])
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

		checks := models.Build("generic.multimatch.selector", m.Path)
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
