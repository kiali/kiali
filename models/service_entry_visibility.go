package models

import (
	meshapi "istio.io/api/mesh/v1alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// ServiceEntryVisibilityPolicy holds compiled selectors for an immutable MeshConfig snapshot.
type ServiceEntryVisibilityPolicy struct {
	applyToSidecars   bool
	defaultExportTo   []string
	defaultVisibility meshapi.ServiceEntryVisibility_Visibility
	policies          []serviceEntryVisibilityPolicy
}

type serviceEntryVisibilityPolicy struct {
	selectors  []labels.Selector
	visibility meshapi.ServiceEntryVisibility_Visibility
}

// ServiceEntryVisibility is the resolved policy for a definition namespace. It can be reused
// for all ServiceEntries in that namespace and for different requesting namespaces.
type ServiceEntryVisibility struct {
	definitionNamespace string
	policy              *ServiceEntryVisibilityPolicy
	visibility          meshapi.ServiceEntryVisibility_Visibility
}

// PrepareServiceEntryVisibility compiles selectors while constructing a mesh snapshot, before
// discovery publishes it to concurrent graph and validation readers.
func (m *MeshConfig) PrepareServiceEntryVisibility() {
	m.serviceEntryVisibilityPolicy = newServiceEntryVisibilityPolicy(m)
}

// ServiceEntryVisibilityPolicy reuses the prepared snapshot. Unprepared configurations, such as
// those constructed directly by tests, are evaluated without mutating the shared MeshConfig.
func (m *MeshConfig) ServiceEntryVisibilityPolicy() *ServiceEntryVisibilityPolicy {
	if m != nil && m.serviceEntryVisibilityPolicy != nil {
		return m.serviceEntryVisibilityPolicy
	}
	return newServiceEntryVisibilityPolicy(m)
}

func newServiceEntryVisibilityPolicy(m *MeshConfig) *ServiceEntryVisibilityPolicy {
	result := &ServiceEntryVisibilityPolicy{}
	if m == nil || m.MeshConfig == nil {
		return result
	}
	result.defaultExportTo = m.DefaultServiceExportTo
	visibility := m.GetServiceEntryVisibility()
	result.applyToSidecars = visibility.GetApplyToSidecars()
	result.defaultVisibility = visibility.GetDefaultVisibility()
	for _, policy := range visibility.GetPolicies() {
		compiled := serviceEntryVisibilityPolicy{visibility: policy.GetVisibility()}
		for _, rule := range policy.GetMatchingRules() {
			selector := labels.Nothing()
			if nsSelector := rule.GetNamespaceSelector(); nsSelector != nil {
				converted := &metav1.LabelSelector{MatchLabels: nsSelector.GetMatchLabels()}
				for _, expression := range nsSelector.GetMatchExpressions() {
					converted.MatchExpressions = append(converted.MatchExpressions, metav1.LabelSelectorRequirement{
						Key:      expression.GetKey(),
						Operator: metav1.LabelSelectorOperator(expression.GetOperator()),
						Values:   expression.GetValues(),
					})
				}
				var err error
				selector, err = metav1.LabelSelectorAsSelector(converted)
				if err != nil {
					log.Warningf("Invalid serviceEntryVisibility namespace selector: %s", err)
					selector = labels.Nothing()
				}
			}
			compiled.selectors = append(compiled.selectors, selector)
		}
		result.policies = append(result.policies, compiled)
	}
	return result
}

// ForNamespace matches definition-namespace labels, not requesting-namespace labels.
// Rules within a policy are ANDed; the first matching policy wins, including a catch-all.
func (p *ServiceEntryVisibilityPolicy) ForNamespace(namespace string, namespaceLabels map[string]string) ServiceEntryVisibility {
	visibility := p.defaultVisibility
	for _, policy := range p.policies {
		matches := true
		for _, selector := range policy.selectors {
			if !selector.Matches(labels.Set(namespaceLabels)) {
				matches = false
				break
			}
		}
		if matches {
			visibility = policy.visibility
			break
		}
	}
	return ServiceEntryVisibility{definitionNamespace: namespace, policy: p, visibility: visibility}
}

// IsExportedTo applies the exportTo rules independently of the visibility policy, so
// callers can skip policy matching when the visibility constraint does not apply.
func (p *ServiceEntryVisibilityPolicy) IsExportedTo(exportTo []string, definitionNamespace, requestingNamespace string) bool {
	if len(exportTo) == 0 {
		exportTo = p.defaultExportTo
	}
	return kubernetes.IsExportedTo(exportTo, definitionNamespace, requestingNamespace)
}

// IsVisible applies the resolved visibility to ambient requesters, which ignore exportTo.
// Sidecar/gateway requesters honor exportTo, with the administrator's visibility ceiling
// applied only when applyToSidecars is enabled. The zero value defaults to public for
// ambient requesters and evaluates exportTo without mesh defaults for sidecar requesters.
func (v ServiceEntryVisibility) IsVisible(exportTo []string, requestingNamespace string, requestingAmbient bool) bool {
	if !requestingAmbient {
		if v.policy == nil {
			return kubernetes.IsExportedTo(exportTo, v.definitionNamespace, requestingNamespace)
		}
		if !v.policy.IsExportedTo(exportTo, v.definitionNamespace, requestingNamespace) {
			return false
		}
		if !v.policy.applyToSidecars {
			return true
		}
	}
	switch v.visibility {
	case meshapi.ServiceEntryVisibility_NONE:
		return false
	case meshapi.ServiceEntryVisibility_NAMESPACE:
		return v.definitionNamespace == requestingNamespace
	default:
		return true
	}
}
