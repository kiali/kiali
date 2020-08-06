package checkers

import (
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const RequestAuthenticationCheckerType = "requestauthentication"

type RequestAuthenticationChecker struct {
	RequestAuthentications []kubernetes.IstioObject
	WorkloadList           models.WorkloadList
}

func (m RequestAuthenticationChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(common.SelectorMultiMatchChecker(RequestAuthenticationCheckerType, m.RequestAuthentications, m.WorkloadList).Check())

	for _, peerAuthn := range m.RequestAuthentications {
		validations.MergeValidations(m.runChecks(peerAuthn))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m RequestAuthenticationChecker) runChecks(requestAuthn kubernetes.IstioObject) models.IstioValidations {
	requestAuthnName := requestAuthn.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(requestAuthnName, requestAuthn.GetObjectMeta().Namespace, RequestAuthenticationCheckerType)

	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(RequestAuthenticationCheckerType, requestAuthn, m.WorkloadList),
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
