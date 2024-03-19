package checkers

import (
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/business/checkers/workloads"
	"github.com/kiali/kiali/models"
)

const WorkloadCheckerType = "workload"

type WorkloadChecker struct {
	AuthorizationPolicies []*security_v1beta1.AuthorizationPolicy
	WorkloadsPerNamespace map[string]models.WorkloadList
	Cluster               string
}

func (w WorkloadChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, wls := range w.WorkloadsPerNamespace {
		for _, wl := range wls.Workloads {
			validations.MergeValidations(w.runChecks(wl, wls.Namespace.Name))
		}
	}

	return validations
}

// runChecks runs all the individual checks for a single workload and appends the result into validations.
func (w WorkloadChecker) runChecks(workload models.WorkloadListItem, namespace string) models.IstioValidations {
	wlName := workload.Name
	key, rrValidation := EmptyValidValidation(wlName, namespace, WorkloadCheckerType, w.Cluster)

	enabledCheckers := []Checker{
		workloads.UncoveredWorkloadChecker{Workload: workload, Namespace: namespace, AuthorizationPolicies: w.AuthorizationPolicies},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	iv := make(models.IstioValidations)
	iv[key] = rrValidation
	return iv
}
