package destinationrules

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	Cluster          string
	DestinationRules []*networking_v1.DestinationRule
	IdentityDomain   string
	Namespaces       []string
}

type subset struct {
	Name      string
	Namespace string
	RuleName  string
}

type rule struct {
	Name      string
	Namespace string
}

// Check validates that no two destinationRules target the same host+subset combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Equality search is: [fqdn.String()][subset]
	seenHostSubsets := make(map[string]map[string][]rule)

	for _, dr := range m.DestinationRules {
		destinationRulesName := dr.Name
		destinationRulesNamespace := dr.Namespace
		fqdn := kubernetes.GetHost(dr.Spec.Host, dr.Namespace, m.Namespaces, m.IdentityDomain)

		// Skip mesh-wide / namespace-wide mTLS DestinationRules (e.g. *.local, *.ns.svc...).
		// These are intended to coexist with more specific DRs and must not drive multi-match.
		if isNonLocalmTLSForServiceEnabled(dr, m.IdentityDomain) {
			continue
		}

		foundSubsets := extractSubsets(dr, destinationRulesName, destinationRulesNamespace)
		currentHost := fqdn.String()

		// Only collide with previously seen hosts that actually overlap this one.
		// Wildcard hosts must honor the namespace/domain suffix (e.g. *.vault... must not
		// collide with *.istio-test3...); previously any wildcard was compared to all hosts.
		for hostKey, existing := range seenHostSubsets {
			if hostsOverlap(currentHost, hostKey) {
				checkCollisions(validations, destinationRulesNamespace, destinationRulesName, foundSubsets, existing, m.Cluster)
			}
		}

		if _, found := seenHostSubsets[currentHost]; !found {
			seenHostSubsets[currentHost] = make(map[string][]rule)
		}
		for _, s := range foundSubsets {
			seenHostSubsets[currentHost][s.Name] = append(seenHostSubsets[currentHost][s.Name], rule{destinationRulesName, destinationRulesNamespace})
		}

	}

	return validations
}

// hostsOverlap reports whether two DestinationRule host keys select the same traffic.
// Exact matches overlap; a bare "*" overlaps everything; otherwise a wildcard overlaps
// a host (or a more specific wildcard) when the non-wildcard/more-specific side falls
// within the wildcard's domain suffix.
func hostsOverlap(a, b string) bool {
	if a == b {
		return true
	}
	if a == "*" || b == "*" {
		return true
	}
	return kubernetes.HostWithinWildcardHost(b, a) || kubernetes.HostWithinWildcardHost(a, b)
}

func isNonLocalmTLSForServiceEnabled(dr *networking_v1.DestinationRule, identityDomain string) bool {
	if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
		return true
	}
	if enabled, _ := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(dr.Namespace, dr, identityDomain); enabled {
		return true
	}
	return false
}

func ismTLSEnabled(dr *networking_v1.DestinationRule) bool {
	if dr.Spec.TrafficPolicy != nil && dr.Spec.TrafficPolicy.Tls != nil {
		mode := dr.Spec.TrafficPolicy.Tls.Mode.String()
		return mode == "ISTIO_MUTUAL"
	}
	return false
}

func extractSubsets(dr *networking_v1.DestinationRule, destinationRulesName string, destinationRulesNamespace string) []subset {
	if len(dr.Spec.Subsets) > 0 {
		foundSubsets := []subset{}
		for _, ss := range dr.Spec.Subsets {
			foundSubsets = append(foundSubsets, subset{
				Name:      ss.Name,
				Namespace: destinationRulesNamespace,
				RuleName:  destinationRulesName,
			})
		}
		return foundSubsets
	}
	// Matches all the subsets:~
	return []subset{{"~", destinationRulesNamespace, destinationRulesName}}
}

func checkCollisions(validations models.IstioValidations, namespace, destinationRulesName string, foundSubsets []subset, existing map[string][]rule, cluster string) {
	// If current subset is ~
	if len(foundSubsets) == 1 && foundSubsets[0].Name == "~" {
		// This should match any subset in the same hostname
		for _, v := range existing {
			for _, e := range v {
				addError(validations, []string{namespace, e.Namespace}, []string{destinationRulesName, e.Name}, cluster)
			}
		}
	}

	// If we have existing subset with ~
	if rules, found := existing["~"]; found {
		for _, rule := range rules {
			addError(validations, []string{namespace, rule.Namespace}, []string{destinationRulesName, rule.Name}, cluster)
		}
	}

	for _, s := range foundSubsets {
		if rules, found := existing[s.Name]; found {
			for _, rule := range rules {
				addError(validations, []string{namespace, rule.Namespace}, []string{destinationRulesName, rule.Name}, cluster)
			}
		}
	}
}

// addError links new validation errors to the validations. namespaces nad destinationRuleNames must always be a pair
func addError(validations models.IstioValidations, namespaces []string, destinationRuleNames []string, cluster string) models.IstioValidations {
	key0, rrValidation0 := createError("destinationrules.multimatch", namespaces[0], destinationRuleNames[0], cluster, true)
	key1, rrValidation1 := createError("destinationrules.multimatch", namespaces[1], destinationRuleNames[1], cluster, true)

	rrValidation0.References = append(rrValidation0.References, key1)
	rrValidation1.References = append(rrValidation1.References, key0)

	validations.MergeValidations(models.IstioValidations{key0: rrValidation0})
	validations.MergeValidations(models.IstioValidations{key1: rrValidation1})

	return validations
}

func createError(errorText, namespace, destinationRuleName, cluster string, valid bool) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: destinationRuleName, Namespace: namespace, ObjectGVK: kubernetes.DestinationRules, Cluster: cluster}
	checks := models.Build(errorText, "spec/host")
	rrValidation := &models.IstioValidation{
		Cluster:   cluster,
		Name:      destinationRuleName,
		ObjectGVK: key.ObjectGVK,
		Valid:     valid,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: make([]models.IstioValidationKey, 0),
	}

	return key, rrValidation
}
