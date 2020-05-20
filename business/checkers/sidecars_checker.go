package checkers

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/sidecars"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const SidecarCheckerType = "sidecar"

type SidecarChecker struct {
	Sidecars       []kubernetes.IstioObject
	ServiceEntries []kubernetes.IstioObject
	Services       []core_v1.Service
	Namespaces     models.Namespaces
	WorkloadList   models.WorkloadList
}

func (s SidecarChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(s.runIndividualChecks())
	validations = validations.MergeValidations(s.runGroupChecks())

	return validations
}

func (s SidecarChecker) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	enabledDRCheckers := []GroupChecker{
		common.WorkloadSelectorMultiMatchChecker(SidecarCheckerType, s.Sidecars, s.WorkloadList),
	}

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

func (s SidecarChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, sidecar := range s.Sidecars {
		validations.MergeValidations(s.runChecks(sidecar))
	}

	return validations
}

func (s SidecarChecker) runChecks(sidecar kubernetes.IstioObject) models.IstioValidations {
	policyName := sidecar.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(policyName, sidecar.GetObjectMeta().Namespace, SidecarCheckerType)
	serviceHosts := kubernetes.ServiceEntryHostnames(s.ServiceEntries)

	enabledCheckers := []Checker{
		common.WorkloadSelectorNoWorkloadFoundChecker(SidecarCheckerType, sidecar, s.WorkloadList),
		sidecars.EgressHostChecker{Sidecar: sidecar, Services: s.Services, ServiceEntries: serviceHosts},
		sidecars.GlobalChecker{Sidecar: sidecar},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
