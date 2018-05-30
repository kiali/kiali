package checkers

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/route_rules"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

const objectType = "routerule"

type RouteRuleChecker struct {
	Namespace  string
	PodList    []v1.Pod
	RouteRules []kubernetes.IstioObject
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It run two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between configurations.
func (in RouteRuleChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())
	validations = validations.MergeValidations(in.runGroupChecks())

	return validations
}

// Runs individual checks for each route rule
func (in RouteRuleChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, routeRule := range in.RouteRules {
		in.runChecks(routeRule, validations)
	}

	return validations
}

// runGroupChecks runs group checks for all route rules
func (in RouteRuleChecker) runGroupChecks() models.IstioValidations {
	return models.IstioValidations{}
}

// enabledCheckersFor returns the list of all individual enabled checkers.
func (in RouteRuleChecker) enabledCheckersFor(object kubernetes.IstioObject) []Checker {
	return []Checker{
		route_rules.RouteChecker{object},
		route_rules.PrecedenceChecker{object},
		route_rules.VersionPresenceChecker{in.Namespace, in.PodList, object},
	}
}

// runChecks runs all the individual checks for a single route rule and appends the result into validations.
func (in RouteRuleChecker) runChecks(routeRule kubernetes.IstioObject, validations models.IstioValidations) {
	ruleName := routeRule.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: ruleName, ObjectType: objectType}
	rrValidation := &models.IstioValidation{
		Name:       ruleName,
		ObjectType: objectType,
		Valid:      true,
	}

	for _, checker := range in.enabledCheckersFor(routeRule) {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
}
