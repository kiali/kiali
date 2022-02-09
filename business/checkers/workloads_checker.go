package checkers

import (
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/business/checkers/workloads"
	"github.com/kiali/kiali/models"
)

const WorkloadCheckerType = "workload"

type WorkloadChecker struct {
	Namespace             string
	AuthorizationPolicies []security_v1beta1.AuthorizationPolicy
	WorkloadList          models.WorkloadList
}

func (w WorkloadChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, wl := range w.WorkloadList.Workloads {
		validations.MergeValidations(w.runChecks(wl))
	}

	return validations
}

// runChecks runs all the individual checks for a single workload and appends the result into validations.
func (w WorkloadChecker) runChecks(workload models.WorkloadListItem) models.IstioValidations {
	wlName := workload.Name
	key, rrValidation := EmptyValidValidation(wlName, w.Namespace, WorkloadCheckerType)

	enabledCheckers := []Checker{
		workloads.UncoveredWorkloadChecker{Workload: workload, Namespace: w.Namespace, AuthorizationPolicies: w.AuthorizationPolicies},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
