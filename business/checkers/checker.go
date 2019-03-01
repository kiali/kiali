package checkers

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ObjectChecker interface {
	GetType() string
	GetGroupCheckers() []GroupChecker
	GetIndividualCheckers() []IndividualChecker
	GetObjects() []kubernetes.IstioObject
	Check() models.IstioValidations
}

type IndividualChecker interface {
	Check() ([]*models.IstioCheck, bool)
}

type GroupChecker interface {
	Check() models.IstioValidations
}

type ObjectCheck struct{}

func (oc ObjectCheck) GetType() string {
	return "Type not defined"
}

func (oc ObjectCheck) GetGroupCheckers() []GroupChecker {
	return []GroupChecker{}
}

func (oc ObjectCheck) GetIndividualCheckers(object kubernetes.IstioObject) []IndividualChecker {
	return []IndividualChecker{}
}

func (oc ObjectCheck) GetObjects() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{}
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It runs two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between objects.
func (oc ObjectCheck) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(oc.runIndividualChecks())
	validations = validations.MergeValidations(oc.runGroupChecks())

	return validations
}

// runGroupChecks runs group checks for all objects passed
func (oc ObjectCheck) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, checker := range oc.GetGroupCheckers() {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

// Runs individual checks for each object in oc.GetObjects
func (oc ObjectCheck) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, object := range oc.GetObjects() {
		validations.MergeValidations(oc.runChecks(object))
	}

	return validations
}

// runChecks runs all the individual checks for a single object and appends the result into validations.
func (oc ObjectCheck) runChecks(object kubernetes.IstioObject) models.IstioValidations {
	objectName := object.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: objectName, ObjectType: oc.GetType()}
	rrValidation := &models.IstioValidation{
		Name:       objectName,
		ObjectType: oc.GetType(),
		Valid:      true,
		Checks:     []*models.IstioCheck{},
	}

	for _, checker := range oc.GetIndividualCheckers(object) {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
