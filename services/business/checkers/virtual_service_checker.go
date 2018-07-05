package checkers

import (
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/virtual_services"
	"github.com/kiali/kiali/services/models"
)

const virtualCheckerType = "virtualservice"

type VirtualServiceChecker struct {
	Namespace        string
	DestinationRules []kubernetes.IstioObject
	VirtualService   []kubernetes.IstioObject
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It run two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between configurations.
func (in VirtualServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())
	validations = validations.MergeValidations(in.runGroupChecks())

	return validations
}

// Runs individual checks for each virtual service
func (in VirtualServiceChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}
	validationsChan := make(chan models.IstioValidations)

	var wg sync.WaitGroup
	wg.Add(len(in.VirtualService))

	for _, virtualService := range in.VirtualService {
		go in.runChecks(virtualService, validationsChan, &wg)
	}

	go func() {
		wg.Wait()
		// Closing the channel stop the range loop below
		close(validationsChan)
	}()

	for v := range validationsChan {
		validations.MergeValidations(v)
	}
	return validations
}

// runGroupChecks runs group checks for all virtual services
func (in VirtualServiceChecker) runGroupChecks() models.IstioValidations {
	return models.IstioValidations{}
}

// runChecks runs all the individual checks for a single virtual service and appends the result into validations.
func (in VirtualServiceChecker) runChecks(virtualService kubernetes.IstioObject,
	validationChan chan models.IstioValidations, wg *sync.WaitGroup) {

	defer (*wg).Done()

	virtualServiceName := virtualService.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: virtualServiceName, ObjectType: virtualCheckerType}
	rrValidation := &models.IstioValidation{
		Name:       virtualServiceName,
		ObjectType: virtualCheckerType,
		Valid:      true,
	}

	enabledCheckers := []Checker{
		virtual_services.RouteChecker{virtualService},
		virtual_services.SubsetPresenceChecker{in.Namespace, in.DestinationRules, virtualService},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	validationChan <- models.IstioValidations{key: rrValidation}
}
