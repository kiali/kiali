package checkers

import (
	"github.com/kiali/kiali/business/checkers/meshpolicies"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const MeshPolicyCheckerType = "meshpolicy"

type MeshPolicyChecker struct {
	MeshPolicies []kubernetes.IstioObject
	MTLSDetails  kubernetes.MTLSDetails
}

func (m MeshPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, meshPolicy := range m.MeshPolicies {
		validations.MergeValidations(m.runChecks(meshPolicy))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m MeshPolicyChecker) runChecks(meshPolicy kubernetes.IstioObject) models.IstioValidations {
	meshPolicyName := meshPolicy.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(meshPolicyName, MeshPolicyCheckerType)

	enabledCheckers := []Checker{
		meshpolicies.MeshMtlsChecker{MeshPolicy: meshPolicy, MTLSDetails: m.MTLSDetails},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
