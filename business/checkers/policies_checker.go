package checkers

import (
	"github.com/kiali/kiali/business/checkers/policies"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const PolicyCheckerType = "policy"

type PolicyChecker struct {
	Policies    []kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

func (m PolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, policy := range m.Policies {
		validations.MergeValidations(m.runChecks(policy))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m PolicyChecker) runChecks(policy kubernetes.IstioObject) models.IstioValidations {
	policyName := policy.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(policyName, PolicyCheckerType)

	enabledCheckers := []Checker{
		policies.NamespaceMtlsChecker{Policy: policy, MTLSDetails: m.MTLSDetails},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
