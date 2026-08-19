package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/serviceentries"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ServiceEntryChecker struct {
	Cluster        string
	ImportScope    common.ImportScope
	Namespaces     models.Namespaces
	ServiceEntries []*networking_v1.ServiceEntry
}

func (s ServiceEntryChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(s.runGroupChecks())

	for _, se := range s.ServiceEntries {
		validations.MergeValidations(s.runSingleChecks(se))
	}

	return validations
}

func (s ServiceEntryChecker) runGroupChecks() models.IstioValidations {
	// Multi-match (KIA1211/1212) only considers Sidecar-imported ServiceEntries.
	conflictSEs := common.FilterServiceEntriesByImport(s.ServiceEntries, s.ImportScope)
	return serviceentries.MultiMatchChecker{
		Cluster:        s.Cluster,
		ServiceEntries: conflictSEs,
	}.Check()
}

func (s ServiceEntryChecker) runSingleChecks(se *networking_v1.ServiceEntry) models.IstioValidations {
	key, validations := EmptyValidValidation(se.Name, se.Namespace, kubernetes.ServiceEntries, s.Cluster)

	enabledCheckers := []Checker{}
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
