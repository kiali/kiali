package checkers

import (
	"github.com/kiali/kiali/business/checkers/serviceentries"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceEntryCheckerType = "serviceentry"

type ServiceEntryChecker struct {
	ServiceEntries []kubernetes.IstioObject
}

func (s ServiceEntryChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, se := range s.ServiceEntries {
		validations.MergeValidations(s.runSingleChecks(se))
	}

	return validations
}

func (s ServiceEntryChecker) runSingleChecks(se kubernetes.IstioObject) models.IstioValidations {
	validations := models.IstioValidations{}
	checks, valid := serviceentries.PortChecker{
		ServiceEntry: se,
	}.Check()

	key := models.IstioValidationKey{ObjectType: ServiceEntryCheckerType, Name: se.GetObjectMeta().Name}
	validations[key] = &models.IstioValidation{
		Name:       key.Name,
		ObjectType: key.ObjectType,
		Checks:     checks,
		Valid:      valid,
	}
	return validations
}
