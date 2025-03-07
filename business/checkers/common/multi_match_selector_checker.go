package common

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/models"
)

type GenericMultiMatchChecker struct {
	Cluster               string
	ObjectGVK             schema.GroupVersionKind
	Keys                  []models.IstioValidationKey
	Selectors             map[int]map[string]string
	WorkloadsPerNamespace map[string]models.Workloads
	Path                  string
	skipSelSubj           bool
}

func PeerAuthenticationMultiMatchChecker(cluster string, objectGVK schema.GroupVersionKind, pa []*security_v1.PeerAuthentication, workloadsPerNamespace map[string]models.Workloads) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(pa))
	for i, p := range pa {
		key := models.IstioValidationKey{
			ObjectGVK: objectGVK,
			Name:      p.Name,
			Namespace: p.Namespace,
			Cluster:   cluster,
		}
		keys = append(keys, key)
		selectors[i] = make(map[string]string)
		if p.Spec.Selector != nil {

			selectors[i] = p.Spec.Selector.MatchLabels
		}
	}
	return GenericMultiMatchChecker{
		Cluster:               cluster,
		ObjectGVK:             objectGVK,
		Keys:                  keys,
		Selectors:             selectors,
		WorkloadsPerNamespace: workloadsPerNamespace,
		Path:                  "spec/selector",
		skipSelSubj:           false,
	}
}

func RequestAuthenticationMultiMatchChecker(cluster string, objectGVK schema.GroupVersionKind, ra []*security_v1.RequestAuthentication, workloadsPerNamespace map[string]models.Workloads) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(ra))
	for i, r := range ra {
		key := models.IstioValidationKey{
			ObjectGVK: objectGVK,
			Name:      r.Name,
			Namespace: r.Namespace,
			Cluster:   cluster,
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
		Cluster:               cluster,
		ObjectGVK:             objectGVK,
		Keys:                  keys,
		Selectors:             selectors,
		WorkloadsPerNamespace: workloadsPerNamespace,
		Path:                  "spec/selector",
		skipSelSubj:           true,
	}
}

func SidecarSelectorMultiMatchChecker(cluster string, objectGVK schema.GroupVersionKind, sc []*networking_v1.Sidecar, workloadsPerNamespace map[string]models.Workloads) GenericMultiMatchChecker {
	keys := []models.IstioValidationKey{}
	selectors := make(map[int]map[string]string, len(sc))
	i := 0
	for _, s := range sc {
		for ns, _ := range workloadsPerNamespace {
			if s.Namespace != ns {
				// Workloads from Sidecar's own Namespaces only are considered in Selector
				continue
			}
			key := models.IstioValidationKey{
				ObjectGVK: objectGVK,
				Name:      s.Name,
				Namespace: s.Namespace,
				Cluster:   cluster,
			}
			keys = append(keys, key)
			selectors[i] = make(map[string]string)
			if s.Spec.WorkloadSelector != nil {
				selectors[i] = s.Spec.WorkloadSelector.Labels
			}
			i++
		}
	}
	return GenericMultiMatchChecker{
		Cluster:               cluster,
		ObjectGVK:             objectGVK,
		Keys:                  keys,
		Selectors:             selectors,
		WorkloadsPerNamespace: workloadsPerNamespace,
		Path:                  "spec/workloadSelector",
		skipSelSubj:           false,
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
					ObjectGVK: k.ObjectGVK,
					Name:      k.Name,
					Namespace: k.Namespace,
					Cluster:   m.Cluster,
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
	namespaceNumbers := make(map[string]int)
	for _, subjectWithIndex := range subjects {
		namespaceNumbers[subjectWithIndex.Key.Namespace]++
	}

	for _, subjectWithIndex := range subjects {
		// skip subjects which do not have duplicates in same namespace
		if namespaceNumbers[subjectWithIndex.Key.Namespace] < 2 {
			continue
		}
		references := extractReferences(subjectWithIndex.Index, subjectWithIndex.Key.Namespace, subjects)
		checks := models.Build("generic.multimatch.selectorless", m.Path)
		validations.MergeValidations(
			models.IstioValidations{
				*subjectWithIndex.Key: &models.IstioValidation{
					Cluster:    m.Cluster,
					Name:       subjectWithIndex.Key.Name,
					ObjectGVK:  subjectWithIndex.Key.ObjectGVK,
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

func extractReferences(index int, namespace string, subjects []KeyWithIndex) []models.IstioValidationKey {
	references := make([]models.IstioValidationKey, 0, len(subjects)-1)

	for _, s := range subjects {
		if s.Index != index && s.Key.Namespace == namespace {
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
		subjectKey := models.BuildKey(m.ObjectGVK, s.Name, s.Namespace, m.Cluster)

		selector := labels.SelectorFromSet(m.Selectors[i])
		if selector.Empty() {
			continue
		}

		for ns, workloads := range m.WorkloadsPerNamespace {
			for _, w := range workloads {
				if !selector.Matches(labels.Set(w.Labels)) {
					continue
				}
				workloadKey := models.BuildKey(w.WorkloadGVK, w.Name, ns, m.Cluster)
				workloadSubjects.Add(workloadKey, subjectKey)
			}
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

	namespaceNumbers := make(map[string]int)
	for _, sck := range scs {
		namespaceNumbers[sck.Namespace]++
	}

	for i, sck := range scs {
		// skip subjects which do not have duplicates in same namespace
		if namespaceNumbers[sck.Namespace] < 2 {
			continue
		}
		// Remove validation subject and other namespace subjects from references
		refs := make([]models.IstioValidationKey, 0, len(scs)-1)
		for refIndex, refSck := range scs {
			if refIndex != i && refSck.Namespace == sck.Namespace {
				refs = append(refs, refSck)
			}
		}

		checks := models.Build("generic.multimatch.selector", m.Path)
		validation := models.IstioValidations{
			sck: &models.IstioValidation{
				Cluster:    m.Cluster,
				Name:       sck.Name,
				ObjectGVK:  m.ObjectGVK,
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
