package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/serviceentries"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ServiceEntryChecker struct {
	ServiceEntries  []*networking_v1.ServiceEntry
	Namespaces      models.Namespaces
	WorkloadEntries []*networking_v1.WorkloadEntry
	Cluster         string
}

func (s ServiceEntryChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	weMap := serviceentries.GroupWorkloadEntriesByLabels(s.WorkloadEntries)

	for _, se := range s.ServiceEntries {
		validations.MergeValidations(s.runSingleChecks(se, weMap))
	}

	return validations
}

func (s ServiceEntryChecker) runSingleChecks(se *networking_v1.ServiceEntry, workloadEntriesMap map[string][]string) models.IstioValidations {
	key, validations := EmptyValidValidation(se.Name, se.Namespace, kubernetes.ServiceEntries, s.Cluster)

	enabledCheckers := []Checker{
		serviceentries.HasMatchingWorkloadEntryAddress{ServiceEntry: se, WorkloadEntries: workloadEntriesMap},
	}
	if !s.Namespaces.IsNamespaceAmbient(se.Namespace, s.Cluster) {
		enabledCheckers = append(enabledCheckers, common.ExportToNamespaceChecker{ExportTo: se.Spec.ExportTo, Namespaces: s.Namespaces.GetNames()})
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
