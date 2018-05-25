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

func (in RouteRuleChecker) Check() *models.IstioTypeValidations {
	typeValidations := models.IstioTypeValidations{}

	typeValidations = typeValidations.MergeValidations(in.runIndividualChecks())
	typeValidations = typeValidations.MergeValidations(in.runGroupChecks())

	return &typeValidations
}

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

func (in *RouteRuleChecker) runGroupChecks() *models.IstioTypeValidations {
	return &models.IstioTypeValidations{}
}

func enabledCheckersFor(object kubernetes.IstioObject) []Checker {
	return []Checker{
		route_rules.RouteChecker{object},
		route_rules.PrecedenceChecker{object},
	}
}

func runChecks(routeRule kubernetes.IstioObject, typeValidations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var checkersWg sync.WaitGroup

	nameValidations := models.IstioNameValidations{}

	ruleName := routeRule.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: ruleName, ObjectType: objectType, Valid: true}
	nameValidations[ruleName] = validation

	checkers := enabledCheckersFor(routeRule)
	checkersWg.Add(len(checkers))

	for _, checker := range checkers {
		go runChecker(checker, ruleName, &nameValidations, &checkersWg)
	}

	checkersWg.Wait()
	if (*typeValidations)[objectType] != nil {
		(*typeValidations)[objectType].MergeNameValidations(&nameValidations)
	} else {
		(*typeValidations)[objectType] = &nameValidations
	}
}

func runChecker(checker Checker, objectName string, nameValidations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()

	checks, validChecker := checker.Check()
	(*nameValidations)[objectName].Checks = append((*nameValidations)[objectName].Checks, checks...)
	(*nameValidations)[objectName].Valid = (*nameValidations)[objectName].Valid && validChecker
}
