package destinationrules

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const DestinationRulesCheckerType = "destinationrule"

type MultiMatchChecker struct {
	DestinationRules []kubernetes.IstioObject
	ServiceEntries   map[string][]string
	Namespaces       models.Namespaces
}

type subset struct {
	Name     string
	RuleName string
}

// Check validates that no two destinationRules target the same host+subset combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Equality search is: [fqdn.Service][subset] except for ServiceEntry targets which use [host][subset]
	seenHostSubsets := make(map[string]map[string]string)

	for _, dr := range m.DestinationRules {
		if host, ok := dr.GetSpec()["host"]; ok {
			destinationRulesName := dr.GetObjectMeta().Name
			destinationRulesNamespace := dr.GetObjectMeta().Namespace
			if dHost, ok := host.(string); ok {
				fqdn := kubernetes.GetHost(dHost, dr.GetObjectMeta().Namespace, dr.GetObjectMeta().ClusterName, m.Namespaces.GetNames())

				if fqdn.Namespace != dr.GetObjectMeta().Namespace && !strings.HasPrefix(fqdn.Service, "*") && fqdn.Namespace != "" {
					// Unable to verify if the same host+subset combination is targeted from different namespace DRs
					// "*" check removes the prefix errors
					key, rrValidation := createError("validation.unable.cross-namespace", destinationRulesNamespace, destinationRulesName, true)
					validations.MergeValidations(models.IstioValidations{key: rrValidation})
					continue
				}

				// Skip DR validation if it enables mTLS either namespace or mesh-wide
				if isNonLocalmTLSForServiceEnabled(dr, fqdn.Service) {
					continue
				}

				foundSubsets := extractSubsets(dr, destinationRulesName)

				if fqdn.Service == "*" {
					// We need to check the matching subsets from all hosts now
					for _, h := range seenHostSubsets {
						checkCollisions(validations, destinationRulesNamespace, destinationRulesName, foundSubsets, h)
					}
					// We add * later
				}
				// Search "*" first and then exact name
				if previous, found := seenHostSubsets["*"]; found {
					// Need to check subsets of "*"
					checkCollisions(validations, destinationRulesNamespace, destinationRulesName, foundSubsets, previous)
				}

				if previous, found := seenHostSubsets[fqdn.Service]; found {
					// Host found, need to check underlying subsets
					checkCollisions(validations, destinationRulesNamespace, destinationRulesName, foundSubsets, previous)
				}
				// Nothing threw an error, so add these
				if _, found := seenHostSubsets[fqdn.Service]; !found {
					seenHostSubsets[fqdn.Service] = make(map[string]string)
				}
				for _, s := range foundSubsets {
					seenHostSubsets[fqdn.Service][s.Name] = destinationRulesName
				}
			}
		}
	}

	return validations
}

func isNonLocalmTLSForServiceEnabled(dr kubernetes.IstioObject, service string) bool {
	return strings.HasPrefix(service, "*") && ismTLSEnabled(dr)
}

func ismTLSEnabled(dr kubernetes.IstioObject) bool {
	if trafficPolicy, trafficPresent := dr.GetSpec()["trafficPolicy"]; trafficPresent {
		if trafficCasted, ok := trafficPolicy.(map[string]interface{}); ok {
			if tls, found := trafficCasted["tls"]; found {
				if tlsCasted, ok := tls.(map[string]interface{}); ok {
					if mode, found := tlsCasted["mode"]; found {
						if modeCasted, ok := mode.(string); ok {
							return modeCasted == "ISTIO_MUTUAL"
						}
					}
				}
			}
		}
	}
	return false
}

func extractSubsets(dr kubernetes.IstioObject, destinationRulesName string) []subset {
	if subsets, found := dr.GetSpec()["subsets"]; found {
		if subsetSlice, ok := subsets.([]interface{}); ok {
			foundSubsets := make([]subset, 0, len(subsetSlice))
			for _, se := range subsetSlice {
				if element, ok := se.(map[string]interface{}); ok {
					if name, found := element["name"]; found {
						if n, ok := name.(string); ok {
							foundSubsets = append(foundSubsets, subset{n, destinationRulesName})
						}
					}
				}
			}
			return foundSubsets
		}
	}
	// Matches all the subsets:~
	return []subset{{"~", destinationRulesName}}
}

func checkCollisions(validations models.IstioValidations, namespace, destinationRulesName string, foundSubsets []subset, existing map[string]string) {
	// If current subset is ~
	if len(foundSubsets) == 1 && foundSubsets[0].Name == "~" {
		// This should match any subset in the same hostname
		for _, v := range existing {
			addError(validations, namespace, []string{destinationRulesName, v})
		}
	}

	// If we have existing subset with ~
	if ruleName, found := existing["~"]; found {
		addError(validations, namespace, []string{destinationRulesName, ruleName})
	}

	for _, s := range foundSubsets {
		if ruleName, found := existing[s.Name]; found {
			addError(validations, namespace, []string{destinationRulesName, ruleName})
		}
	}
}

// addError links new validation errors to the validations. destinationRuleNames must always be a pair
func addError(validations models.IstioValidations, namespace string, destinationRuleNames []string) models.IstioValidations {
	key0, rrValidation0 := createError("destinationrules.multimatch", namespace, destinationRuleNames[0], true)
	key1, rrValidation1 := createError("destinationrules.multimatch", namespace, destinationRuleNames[1], true)

	rrValidation0.References = append(rrValidation0.References, key1)
	rrValidation1.References = append(rrValidation1.References, key0)

	validations.MergeValidations(models.IstioValidations{key0: rrValidation0})
	validations.MergeValidations(models.IstioValidations{key1: rrValidation1})

	return validations
}

func createError(errorText, namespace, destinationRuleName string, valid bool) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: destinationRuleName, Namespace: namespace, ObjectType: DestinationRulesCheckerType}
	checks := models.Build(errorText, "spec/host")
	rrValidation := &models.IstioValidation{
		Name:       destinationRuleName,
		ObjectType: DestinationRulesCheckerType,
		Valid:      valid,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: make([]models.IstioValidationKey, 0),
	}

	return key, rrValidation
}
