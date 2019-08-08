package checkers

import (
	"github.com/kiali/kiali/business/checkers/meshpolicies"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceMeshPolicyCheckerType = "servicemeshpolicy"

type ServiceMeshPolicyChecker struct {
	ServiceMeshPolicies []kubernetes.IstioObject
	MTLSDetails         kubernetes.MTLSDetails
}

func (m ServiceMeshPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, smPolicy := range m.ServiceMeshPolicies {
		validations.MergeValidations(m.runChecks(smPolicy))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m ServiceMeshPolicyChecker) runChecks(smPolicy kubernetes.IstioObject) models.IstioValidations {
	meshPolicyName := smPolicy.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(meshPolicyName, ServiceMeshPolicyCheckerType)

	enabledCheckers := []Checker{
		// ServiceMeshPolicy is a clone of MeshPolicy so we can reuse the MeshMtlsChecker
		meshpolicies.MeshMtlsChecker{MeshPolicy: smPolicy, MTLSDetails: m.MTLSDetails, IsServiceMesh: true},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
