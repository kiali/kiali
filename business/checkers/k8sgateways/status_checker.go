package k8sgateways

import (
	"fmt"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/models"
)

type StatusChecker struct {
	K8sGateway *k8s_networking_v1.Gateway
}

type K8sGatewayStatus struct {
	ObjectField string
	Status      string
}

const GwAPICheckerCode string = "GWAPI"

// K8sGatewayConditionStatus represents the status failures for a Condition in a K8sGateway
var K8sGatewayConditionStatus = map[string]string{
	"Scheduled": "False",
	"Ready":     "False",
}

// K8sGatewayConditionStatus represents the status failures for a Condition in a K8sGateway
var K8sGatewayListenersStatus = map[string]string{
	"Conflicted":   "True",
	"Detached":     "True",
	"Ready":        "False",
	"ResolvedRefs": "False",
}

// Check validates that no two gateways share the same host+port combination
func (m StatusChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	for i, c := range m.K8sGateway.Status.Conditions {
		if K8sGatewayConditionStatus[c.Type] == string(c.Status) {
			check := createGwChecker(fmt.Sprintf("%s. GWAPI errors should be changed in the spec.", c.Message), fmt.Sprintf("status/conditions[%d]/reason/%s", i, c.Reason))
			validations = append(validations, &check)
		}
	}

	for i, l := range m.K8sGateway.Status.Listeners {
		for _, c := range l.Conditions {
			if K8sGatewayListenersStatus[c.Type] == string(c.Status) {
				check := createGwChecker(fmt.Sprintf("%s. GWAPI errors should be changed in the spec.", c.Message), fmt.Sprintf("status/conditions[%d]/type/%s", i, c.Reason))
				validations = append(validations, &check)
			}
		}
	}

	return validations, len(validations) == 0
}

// Create checker for GW validation (Gateway status)
func createGwChecker(msg string, path string) models.IstioCheck {
	check := models.IstioCheck{
		Code:     GwAPICheckerCode,
		Message:  msg,
		Severity: models.WarningSeverity,
		Path:     path,
	}
	return check
}
