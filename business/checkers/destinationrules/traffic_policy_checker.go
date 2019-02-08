package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type TrafficPolicyChecker struct {
	DestinationRules []kubernetes.IstioObject
}

func (t TrafficPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// When mTLS is not enabled, there is no validation to be added.
	if !t.hasEnablingmTLSDR() {
		return validations
	}

	// Check whether DRs override mTLS.
	for _, dr := range t.DestinationRules {
		if !enablesNonLocalmTLS(dr) {
			check := models.Build("destinationrules.trafficpolicy.meshmtls", "spec")
			key := models.BuildKey(DestinationRulesCheckerType, dr.GetObjectMeta().Name)
			validation := buildDestinationRuleValidation(dr, check, true)

			if _, exists := validations[key]; !exists {
				validations.MergeValidations(models.IstioValidations{key: validation})
			}
		}
	}

	return validations
}

func (t TrafficPolicyChecker) hasEnablingmTLSDR() bool {
	enablesTLS := false

	for _, dr := range t.DestinationRules {
		enablesTLS = enablesNonLocalmTLS(dr)
		if enablesTLS {
			break
		}
	}

	return enablesTLS
}

func buildDestinationRuleValidation(dr kubernetes.IstioObject, checks models.IstioCheck, valid bool) *models.IstioValidation {
	validation := &models.IstioValidation{
		Name:       dr.GetObjectMeta().Name,
		ObjectType: DestinationRulesCheckerType,
		Valid:      valid,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	return validation
}
