package authorization

import (
	"fmt"
	"regexp"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	v1 "k8s.io/api/core/v1"
)

type ServiceChecker struct {
	ServiceRole kubernetes.IstioObject
	Services    []v1.Service
}

// Check verifies that the services point to existing ones. ServiceRole can only affect the defined namespace, no other even if FQDN is used to point to different namespace
func (sc ServiceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if rulesSpec, found := sc.ServiceRole.GetSpec()["rules"]; found {
		if rules, ok := rulesSpec.([]interface{}); ok {
			for ruleIndex, ruleSpec := range rules {
				if rule, ok := ruleSpec.(map[string]interface{}); ok {
					if servicesSpec, found := rule["services"]; found {
						if service, ok := servicesSpec.([]interface{}); ok {
							for _, s := range service {
								if host, ok := s.(string); ok {
									fqdn := kubernetes.ParseHost(host, sc.ServiceRole.GetObjectMeta().Namespace, sc.ServiceRole.GetObjectMeta().ClusterName)
									if !sc.hasMatchingService(fqdn.Service) {
										validation := models.Build("servicerole.invalid.services", fmt.Sprintf("spec/rules[%d]/services", ruleIndex))
										validations = append(validations, &validation)
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return validations, len(validations) == 0
}

func (sc ServiceChecker) hasMatchingService(service string) bool {
	// Check wildcard hosts
	if service == "*" {
		return true
	}

	// AccessRule allows prefix matching also
	r := regexp.MustCompile(service)

	// Check ServiceNames
	for _, s := range sc.Services {
		// Prefixmatch is also allowed
		if service == s.Name || r.MatchString(s.Name) {
			return true
		}
	}

	return false
}
