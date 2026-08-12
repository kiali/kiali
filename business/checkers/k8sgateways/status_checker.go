package k8sgateways

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// K8sGatewayConditionStatus maps Gateway-level condition types to the status value that
// indicates a problem. Maps include GEP-1364 conditions (Accepted, Programmed) and legacy
// types (Scheduled, Ready) so both modern and older controllers are covered.
// Programmed=False is only flagged when the reason is not benign (see
// isBenignPositiveConditionFalse).
var K8sGatewayConditionStatus = map[string]string{
	"Accepted":   "False",
	"Programmed": "False",
	"Ready":      "False",
	"Scheduled":  "False",
}

// K8sGatewayListenersStatus maps Listener condition types to problematic values. Includes
// GEP-1364 conditions (Accepted, Programmed, ResolvedRefs, Conflicted) and legacy types
// (Detached, Ready). Programmed=False uses the same benign-reason filter as gateway-level.
var K8sGatewayListenersStatus = map[string]string{
	"Accepted":     "False",
	"Conflicted":   "True",
	"Detached":     "True",
	"Programmed":   "False",
	"Ready":        "False",
	"ResolvedRefs": "False",
}

// Check validates that no two gateways share the same host+port combination
func (m StatusChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	for i, c := range m.K8sGateway.Status.Conditions {
		if isProblematicGatewayCondition(c) {
			check := createGwChecker(fmt.Sprintf("%s. GWAPI errors should be changed in the spec.", c.Message), fmt.Sprintf("status/conditions[%d]/reason/%s", i, c.Reason))
			validations = append(validations, &check)
		}
	}

	for i, l := range m.K8sGateway.Status.Listeners {
		for _, c := range l.Conditions {
			if isProblematicListenerCondition(c) {
				check := createGwChecker(fmt.Sprintf("%s. GWAPI errors should be changed in the spec.", c.Message), fmt.Sprintf("status/conditions[%d]/type/%s", i, c.Reason))
				validations = append(validations, &check)
			}
		}
	}

	return validations, len(validations) == 0
}

func isProblematicGatewayCondition(c metav1.Condition) bool {
	return isProblematicCondition(c, K8sGatewayConditionStatus)
}

func isProblematicListenerCondition(c metav1.Condition) bool {
	return isProblematicCondition(c, K8sGatewayListenersStatus)
}

func isProblematicCondition(c metav1.Condition, problematicStatus map[string]string) bool {
	expectedStatus, ok := problematicStatus[c.Type]
	if !ok || string(c.Status) != expectedStatus {
		return false
	}
	if isBenignPositiveConditionFalse(c.Type, c.Status, c.Reason) {
		return false
	}
	return true
}

// isBenignPositiveConditionFalse reports positive-polarity conditions set to False for
// transitional controller states (no routes yet, listeners skipped, etc.), not spec errors.
func isBenignPositiveConditionFalse(condType string, status metav1.ConditionStatus, reason string) bool {
	if status != metav1.ConditionFalse {
		return false
	}
	switch condType {
	case "Accepted", "Programmed", "Ready", "ResolvedRefs", "Scheduled":
	default:
		return false
	}
	switch reason {
	case "Pending", "ListenersNotValid", "ListenerSetsNotValid":
		return true
	default:
		return false
	}
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
