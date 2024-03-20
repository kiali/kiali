package checkers

import (
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/models"
)

const RequestAuthenticationCheckerType = "requestauthentication"

type RequestAuthenticationChecker struct {
	RequestAuthentications []*security_v1beta.RequestAuthentication
	WorkloadsPerNamespace  map[string]models.WorkloadList
	Cluster                string
}

func (m RequestAuthenticationChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(common.RequestAuthenticationMultiMatchChecker(m.Cluster, RequestAuthenticationCheckerType, m.RequestAuthentications, m.WorkloadsPerNamespace).Check())

	for _, peerAuthn := range m.RequestAuthentications {
		validations.MergeValidations(m.runChecks(peerAuthn))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m RequestAuthenticationChecker) runChecks(requestAuthn *security_v1beta.RequestAuthentication) models.IstioValidations {
	requestAuthnName := requestAuthn.Name
	key, rrValidation := EmptyValidValidation(requestAuthnName, requestAuthn.Namespace, RequestAuthenticationCheckerType, m.Cluster)
	matchLabels := make(map[string]string)
	if requestAuthn.Spec.Selector != nil {
		matchLabels = requestAuthn.Spec.Selector.MatchLabels
	}
	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(RequestAuthenticationCheckerType, matchLabels, m.WorkloadsPerNamespace),
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	iv := make(models.IstioValidations)
	iv[key] = rrValidation
	return iv
}
