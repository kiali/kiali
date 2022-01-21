package checkers

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/sidecars"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const SidecarCheckerType = "sidecar"

type SidecarChecker struct {
	Sidecars         []networking_v1alpha3.Sidecar
	ServiceEntries   []networking_v1alpha3.ServiceEntry
	Namespaces       models.Namespaces
	WorkloadList     models.WorkloadList
	RegistryServices []*kubernetes.RegistryService
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
		common.SidecarSelectorMultiMatchChecker(SidecarCheckerType, s.Sidecars, s.WorkloadList),
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

func (s SidecarChecker) runChecks(sidecar networking_v1alpha3.Sidecar) models.IstioValidations {
	policyName := sidecar.Name
	key, rrValidation := EmptyValidValidation(policyName, sidecar.Namespace, SidecarCheckerType)
	serviceHosts := kubernetes.ServiceEntryHostnames(s.ServiceEntries)
	selectorLabels := make(map[string]string)
	if sidecar.Spec.WorkloadSelector != nil {
		selectorLabels = sidecar.Spec.WorkloadSelector.Labels
	}

	enabledCheckers := []Checker{
		common.WorkloadSelectorNoWorkloadFoundChecker(SidecarCheckerType, selectorLabels, s.WorkloadList),
		sidecars.EgressHostChecker{Sidecar: sidecar, ServiceEntries: serviceHosts, RegistryServices: s.RegistryServices},
		sidecars.GlobalChecker{Sidecar: sidecar},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
