package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/workloadgroups"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type WorkloadGroupsChecker struct {
	Cluster         string
	ServiceAccounts map[string][]string
	WorkloadGroups  []*networking_v1.WorkloadGroup
}

func (w WorkloadGroupsChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Individual validations
	for _, wlGroup := range w.WorkloadGroups {
		validations.MergeValidations(w.runChecks(wlGroup))
	}

	// Group checks
	validations.MergeValidations(workloadgroups.DuplicateLabelsChecker{Cluster: w.Cluster, WorkloadGroups: w.WorkloadGroups}.Check())

	return validations
}

// runChecks runs all the individual checks for a single workload group the result into validations.
func (w WorkloadGroupsChecker) runChecks(wlGroup *networking_v1.WorkloadGroup) models.IstioValidations {
	wlGroupName := wlGroup.Name
	key, rrValidation := EmptyValidValidation(wlGroupName, wlGroup.Namespace, kubernetes.WorkloadGroups, w.Cluster)
	enabledCheckers := []Checker{
		workloadgroups.ServiceAccountsChecker{Cluster: w.Cluster, WorkloadGroup: wlGroup, ServiceAccounts: w.ServiceAccounts},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
