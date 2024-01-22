package checkers

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/serviceentries"
	"github.com/kiali/kiali/models"
)

const ServiceEntryCheckerType = "serviceentry"

type ServiceEntryChecker struct {
	ServiceEntries  []*networking_v1beta1.ServiceEntry
	Namespaces      models.Namespaces
	WorkloadEntries []*networking_v1beta1.WorkloadEntry
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

func (s ServiceEntryChecker) runSingleChecks(se *networking_v1beta1.ServiceEntry, workloadEntriesMap map[string][]string) models.IstioValidations {
	key, validations := EmptyValidValidation(se.Name, se.Namespace, ServiceEntryCheckerType, s.Cluster)

	enabledCheckers := []Checker{
		serviceentries.HasMatchingWorkloadEntryAddress{ServiceEntry: se, WorkloadEntries: workloadEntriesMap},
	}
	if !s.Namespaces.IsNamespaceAmbient(se.Namespace, s.Cluster) {
		enabledCheckers = append(enabledCheckers, common.ExportToNamespaceChecker{ExportTo: se.Spec.ExportTo, Namespaces: s.Namespaces})
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
