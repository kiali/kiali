package destination_rules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type MultiMatchChecker struct {
	DestinationRules []kubernetes.IstioObject
}

func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	var empty struct{}
	seenHosts := make(map[string]struct{}, len(m.DestinationRules))

	for _, v := range m.DestinationRules {
		if host, ok := v.GetSpec()["host"]; ok {
			if dHost, ok := host.(string); ok {
				if _, found := seenHosts[dHost]; found {
					destinationRulesName := v.GetObjectMeta().Name
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
				} else {
					seenHosts[dHost] = empty
				}
			}
		}
	}

	return validations
}
