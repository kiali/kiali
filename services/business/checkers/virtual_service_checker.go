package checkers

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/virtual_services"
	"github.com/kiali/kiali/services/models"
)

const virtualCheckerType = "virtualservice"

type VirtualServiceChecker struct {
	Namespace        string
	PodList          []v1.Pod
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

	for _, virtualService := range in.VirtualService {
		in.runChecks(virtualService, validations)
	}

	return validations
}

// runGroupChecks runs group checks for all virtual services
func (in VirtualServiceChecker) runGroupChecks() models.IstioValidations {
	return models.IstioValidations{}
}

// enabledCheckersFor returns the list of all individual enabled checkers.
func (in VirtualServiceChecker) enabledCheckersFor(object kubernetes.IstioObject) []Checker {
	return []Checker{
		virtual_services.PrecedenceChecker{object},
		virtual_services.RouteChecker{object},
		virtual_services.VersionPresenceChecker{in.Namespace, in.PodList,
			in.DestinationRules, object},
	}
}

// runChecks runs all the individual checks for a single virtual service and appends the result into validations.
func (in VirtualServiceChecker) runChecks(routeRule kubernetes.IstioObject, validations models.IstioValidations) {
	ruleName := routeRule.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: ruleName, ObjectType: virtualCheckerType}
	rrValidation := &models.IstioValidation{
		Name:       ruleName,
		ObjectType: virtualCheckerType,
		Valid:      true,
	}

	for _, checker := range in.enabledCheckersFor(routeRule) {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
}
