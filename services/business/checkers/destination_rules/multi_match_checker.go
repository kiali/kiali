package destination_rules

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
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

func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	seenHosts := make(map[string]map[string]map[string]string) // Poor man's trie, last string is the first service's name that used the host

	for _, v := range m.DestinationRules {
		if host, ok := v.GetSpec()["host"]; ok {
			destinationRulesName := v.GetObjectMeta().Name
			if dHost, ok := host.(string); ok {
				fqdn := formatHostnameForPrefixSearch(dHost, v.GetObjectMeta().Namespace, v.GetObjectMeta().ClusterName)

				namespaceMap, found := seenHosts[fqdn.Cluster]
				if !found {
					seenHosts[fqdn.Cluster] = make(map[string]map[string]string)
					namespaceMap = seenHosts[fqdn.Cluster]
				}

				serviceMap, found := namespaceMap[fqdn.Namespace]
				if !found {
					namespaceMap[fqdn.Namespace] = make(map[string]string)
					serviceMap = namespaceMap[fqdn.Namespace]
				}

				if fqdn.Service == "*" && found {
					// Existence of this map is enough to cause an error
					addError(validations, []string{destinationRulesName, serviceMap[fqdn.Service]})
				}
				// Search "*" first and then exact name
				if previous, found := serviceMap["*"]; found {
					addError(validations, []string{destinationRulesName, previous})
				} else {
					if previous, found := serviceMap[fqdn.Service]; found {
						addError(validations, []string{destinationRulesName, previous})
					} else {
						serviceMap[fqdn.Service] = destinationRulesName // This will add "*" also
					}
				}
			}
		}
	}

	return validations
}

func addError(validations models.IstioValidations, destinationRuleNames []string) models.IstioValidations {
	for _, destinationRuleName := range destinationRuleNames {
		key := models.IstioValidationKey{Name: destinationRuleName, ObjectType: DestinationRulesCheckerType}
		checks := models.BuildCheck("More than one DestinationRules for same host",
			"warning", "spec/hosts")
		rrValidation := &models.IstioValidation{
			Name:       destinationRuleName,
			ObjectType: DestinationRulesCheckerType,
			Valid:      true,
			Checks: []*models.IstioCheck{
				&checks,
			},
		}

		validations.MergeValidations(models.IstioValidations{key: rrValidation})
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
