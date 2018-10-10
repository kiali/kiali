package destination_rules

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const DestinationRulesCheckerType = "destinationrule"

type MultiMatchChecker struct {
	DestinationRules []kubernetes.IstioObject
}

type Host struct {
	Service   string
	Namespace string
	Cluster   string
}

type subset struct {
	Name     string
	RuleName string
}

// Check validates that no two destinationRules target the same host+subset combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Equality search is: [fqdn][subset]
	seenHostSubsets := make(map[string]map[string]string)

	for _, v := range m.DestinationRules {
		if host, ok := v.GetSpec()["host"]; ok {
			destinationRulesName := v.GetObjectMeta().Name
			if dHost, ok := host.(string); ok {
				fqdn := formatHostnameForPrefixSearch(dHost, v.GetObjectMeta().Namespace, v.GetObjectMeta().ClusterName)

				foundSubsets := extractSubsets(v, destinationRulesName)

				if fqdn.Service == "*" {
					// We need to check the matching subsets from all hosts now
					for _, h := range seenHostSubsets {
						checkCollisions(validations, destinationRulesName, foundSubsets, h)
					}
					// We add * later
				}
				// Search "*" first and then exact name
				if previous, found := seenHostSubsets["*"]; found {
					// Need to check subsets of "*"
					checkCollisions(validations, destinationRulesName, foundSubsets, previous)
				}

				if previous, found := seenHostSubsets[fqdn.Service]; found {
					// Host found, need to check underlying subsets
					checkCollisions(validations, destinationRulesName, foundSubsets, previous)
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
	return []subset{subset{"~", destinationRulesName}}
}

func checkCollisions(validations models.IstioValidations, destinationRulesName string, foundSubsets []subset, existing map[string]string) {
	// If current subset is ~
	if len(foundSubsets) == 1 && foundSubsets[0].Name == "~" {
		// This should match any subset in the same hostname
		for _, v := range existing {
			addError(validations, []string{destinationRulesName, v})
		}
	}

	// If we have existing subset with ~
	if ruleName, found := existing["~"]; found {
		addError(validations, []string{destinationRulesName, ruleName})
	}

	for _, s := range foundSubsets {
		if ruleName, found := existing[s.Name]; found {
			addError(validations, []string{destinationRulesName, ruleName})
		}
	}
}

func addError(validations models.IstioValidations, destinationRuleNames []string) models.IstioValidations {
	for _, destinationRuleName := range destinationRuleNames {
		key := models.IstioValidationKey{Name: destinationRuleName, ObjectType: DestinationRulesCheckerType}
		checks := models.BuildCheck("More than one DestinationRules for same host subset combination",
			"warning", "spec/host")
		rrValidation := &models.IstioValidation{
			Name:       destinationRuleName,
			ObjectType: DestinationRulesCheckerType,
			Valid:      true,
			Checks: []*models.IstioCheck{
				&checks,
			},
		}

		if _, exists := validations[key]; !exists {
			validations.MergeValidations(models.IstioValidations{key: rrValidation})
		}
	}
	return validations
}

func formatHostnameForPrefixSearch(hostName, namespace, clusterName string) Host {
	domainParts := strings.Split(hostName, ".")
	host := Host{
		Service: domainParts[0],
	}
	if len(domainParts) > 1 {
		host.Namespace = domainParts[1]

		if len(domainParts) > 2 {
			host.Cluster = strings.Join(domainParts[2:], ".")
		}
	}

	// Fill in missing details, we take precedence from the full hostname and not from DestinationRule details
	if host.Cluster == "" {
		host.Cluster = clusterName
	}

	if host.Namespace == "" {
		host.Namespace = namespace
	}
	return host
}
