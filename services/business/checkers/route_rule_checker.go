package checkers

import (
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/route_rules"
	"github.com/kiali/kiali/services/models"
)

const objectType = "routerule"

type Checker interface {
	Check() ([]*models.IstioCheck, bool)
}

type RouteRuleChecker struct {
	RouteRules []kubernetes.IstioObject
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It run two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between configurations.
func (in RouteRuleChecker) Check() *models.IstioTypeValidations {
	typeValidations := models.IstioTypeValidations{}

	typeValidations = typeValidations.MergeValidations(in.runIndividualChecks())
	typeValidations = typeValidations.MergeValidations(in.runGroupChecks())

	return &typeValidations
}

// Runs individual checks for each route rule
func (in RouteRuleChecker) runIndividualChecks() *models.IstioTypeValidations {
	typeValidations := models.IstioTypeValidations{}
	var wg sync.WaitGroup

	wg.Add(len(in.RouteRules))

	for _, routeRule := range in.RouteRules {
		go runChecks(routeRule, &typeValidations, &wg)
	}

	wg.Wait()

	return &typeValidations
}

// runGroupChecks runs group checks for all route rules
func (in *RouteRuleChecker) runGroupChecks() *models.IstioTypeValidations {
	return &models.IstioTypeValidations{}
}

// enabledCheckersFor returns the list of all individual enabled checkers
func enabledCheckersFor(object kubernetes.IstioObject) []Checker {
	return []Checker{
		route_rules.RouteChecker{object},
		route_rules.PrecedenceChecker{object},
	}
}

// runChecks runs all the individual checks for a single route rule and it appends the result into typeValidations
func runChecks(routeRule kubernetes.IstioObject, typeValidations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var checkersWg sync.WaitGroup

	nameValidations := models.IstioNameValidations{}
	(*typeValidations)[objectType] = &nameValidations

	ruleName := routeRule.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: ruleName, ObjectType: objectType, Valid: true}
	nameValidations[ruleName] = validation

	checkers := enabledCheckersFor(routeRule)
	checkersWg.Add(len(checkers))

	for _, checker := range checkers {
		go runChecker(checker, ruleName, &nameValidations, &checkersWg)
	}

	checkersWg.Wait()
}

// runChecker runs the specific checker and store its result into nameValidations under objectName map.
func runChecker(checker Checker, objectName string, nameValidations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()

	checks, validChecker := checker.Check()
	(*nameValidations)[objectName].Checks = append((*nameValidations)[objectName].Checks, checks...)
	(*nameValidations)[objectName].Valid = (*nameValidations)[objectName].Valid && validChecker
}
