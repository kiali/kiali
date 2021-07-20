package checkers

import (
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceEntryCheckerType = "serviceentry"

type ServiceEntryChecker struct {
	ServiceEntries []kubernetes.IstioObject
	Namespaces     models.Namespaces
}

func (s ServiceEntryChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, se := range s.ServiceEntries {
		validations.MergeValidations(s.runSingleChecks(se))
	}

	return validations
}

func (s ServiceEntryChecker) runSingleChecks(se kubernetes.IstioObject) models.IstioValidations {
	key, validations := EmptyValidValidation(se.GetObjectMeta().Name, se.GetObjectMeta().Namespace, ServiceEntryCheckerType)

	enabledCheckers := []Checker{
		common.ExportToNamespaceChecker{IstioObject: se, Namespaces: s.Namespaces},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
