package destination_rules

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

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

	var empty struct{}
	seenHosts := make(map[string]map[string]map[string]struct{}) // Poor man's trie

	for _, v := range m.DestinationRules {
		if host, ok := v.GetSpec()["host"]; ok {
			destinationRulesName := v.GetObjectMeta().Name
			if dHost, ok := host.(string); ok {
				fqdn := formatHostnameForPrefixSearch(dHost, v.GetObjectMeta().Namespace, v.GetObjectMeta().ClusterName)

				namespaceMap, found := seenHosts[fqdn.Cluster]
				if !found {
					seenHosts[fqdn.Cluster] = make(map[string]map[string]struct{})
					namespaceMap = seenHosts[fqdn.Cluster]
				}

				serviceMap, found := namespaceMap[fqdn.Namespace]
				if !found {
					namespaceMap[fqdn.Namespace] = make(map[string]struct{})
					serviceMap = namespaceMap[fqdn.Namespace]
				}

				if fqdn.Service == "*" && found {
					// Existence of this map is enough to cause an error
					addError(validations, destinationRulesName)
				}
				// Search "*" first and then exact name
				if _, found := serviceMap["*"]; found {
					addError(validations, destinationRulesName)
				} else {
					if _, found := serviceMap[fqdn.Service]; found {
						addError(validations, destinationRulesName)
					} else {
						serviceMap[fqdn.Service] = empty // This will add "*" also
					}
				}
			}
		}
	}

	return validations
}

func addError(validations models.IstioValidations, destinationRulesName string) {
	key := models.IstioValidationKey{Name: destinationRulesName, ObjectType: "destinationrules"}
	checks := models.BuildCheck("More than one DestinationRules for same host",
		"warning", "spec/hosts")
	rrValidation := &models.IstioValidation{
		Name:       destinationRulesName,
		ObjectType: "destinationrules",
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
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
