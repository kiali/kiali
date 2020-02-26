package checkers

import (
	"github.com/kiali/kiali/business/checkers/sidecars"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const SidecarCheckerType = "sidecar"

type SidecarChecker struct {
	Sidecars     []kubernetes.IstioObject
	Namespaces   models.Namespaces
	WorkloadList models.WorkloadList
}

func (s SidecarChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, sidecar := range s.Sidecars {
		validations.MergeValidations(s.runChecks(sidecar))
	}

	return validations
}

func (s SidecarChecker) runChecks(sidecar kubernetes.IstioObject) models.IstioValidations {
	policyName := sidecar.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(policyName, sidecar.GetObjectMeta().Namespace, SidecarCheckerType)

	enabledCheckers := []Checker{
		sidecars.WorkloadSelectorChecker{Sidecar: sidecar, WorkloadList: s.WorkloadList},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
