package checkers

import (
	"github.com/kiali/kiali/services/business/checkers/pods"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

type PodChecker struct {
	Pods []v1.Pod
}

const podsCheckerType = "pod"

// Runs all checkers for Pod objects passed into the PodChecker
func (checker PodChecker) Check() *models.IstioTypeValidations {
	return checker.runIndividualChecks()
}

// Runs individual checks for each pod in pod checker.
func (checker PodChecker) runIndividualChecks() *models.IstioTypeValidations {
	typeValidations := models.IstioTypeValidations{}
	if len(checker.Pods) == 0 {
		return &typeValidations
	}

	nameValidations := models.IstioNameValidations{}
	typeValidations[podsCheckerType] = &nameValidations

	for _, pod := range checker.Pods {
		validation := models.IstioValidation{
			Name:       pod.ObjectMeta.Name,
			ObjectType: podsCheckerType,
			Valid:      true,
		}
		nameValidations[pod.ObjectMeta.Name] = &validation

		checkers := checker.enabledCheckersFor(&pod)

		for _, podChecker := range checkers {
			checks, isValid := podChecker.Check()
			validation.Checks = append(validation.Checks, checks...)
			validation.Valid = validation.Valid && isValid
		}
	}

	return &typeValidations
}

// Returns a list of all individual enabled checkers
func (checker *PodChecker) enabledCheckersFor(object *v1.Pod) []Checker {
	return []Checker{
		pods.SidecarPresenceChecker{Pod: object},
	}
}
