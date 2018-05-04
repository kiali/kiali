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

func (in RouteRuleChecker) Check() *models.IstioValidations {
	objectValidations := models.IstioValidations{}

	objectValidations = objectValidations.MergeValidations(in.runIndividualChecks())
	objectValidations = objectValidations.MergeValidations(in.runGroupChecks())

	return &objectValidations
}

func (in RouteRuleChecker) runIndividualChecks() *models.IstioValidations {
	validations := models.IstioValidations{}
	var wg sync.WaitGroup

	wg.Add(len(in.RouteRules))

	for _, routeRule := range in.RouteRules {
		go runChecks(routeRule, &validations, &wg)
	}

	wg.Wait()

	return &validations
}

func (in *RouteRuleChecker) runGroupChecks() *models.IstioValidations {
	return &models.IstioValidations{}
}

func enabledCheckersFor(object kubernetes.IstioObject) []Checker {
	return []Checker{
		route_rules.RouteChecker{object},
		route_rules.PrecedenceChecker{object},
	}
}

func runChecks(routeRule kubernetes.IstioObject, validationsPointer *models.IstioValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var checkersWg sync.WaitGroup

	ruleName := routeRule.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: ruleName, ObjectType: objectType, Valid: true}
	validations := *validationsPointer
	validations[ruleName] = validation

	checkers := enabledCheckersFor(routeRule)
	checkersWg.Add(len(checkers))

	for _, checker := range checkers {
		go runChecker(checker, ruleName, validationsPointer, &checkersWg)
	}

	checkersWg.Wait()
}

func runChecker(checker Checker, objectName string, validationsPointer *models.IstioValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	validations := *validationsPointer

	checks, validChecker := checker.Check()
	validations[objectName].Checks = append(validations[objectName].Checks, checks...)
	validations[objectName].Valid = validations[objectName].Valid && validChecker
}
