package k8sgateways

import (
	"github.com/kiali/kiali/models"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
)

type StatusChecker struct {
	K8sGateway *k8s_networking_v1alpha2.Gateway
}

type K8sGatewayStatus struct {
	ObjectField string
	Status      string
}

// K8sGatewayStatusMessages represents the status failures for a Condition in a K8sGateway
var K8sGatewayConditionStatus = []K8sGatewayStatus{
	{ObjectField: "Scheduled", Status: "False"},
	{ObjectField: "Ready", Status: "False"},
}

/*	"Conditions": {
		{ObjectField: "Scheduled", Value: "False"},
		{ObjectField: "Ready", Value: "False"},
	},
	"Listeners": {
		{ObjectField: "Conflicted", Value: "True"},
		{ObjectField: "Detached", Value: "True"},
		{ObjectField: "Ready", Value: "False"},
		{ObjectField: "ResolvedRefs", Value: "False"},
	},
}*/

// Check validates that no two gateways share the same host+port combination
func (m StatusChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	for _, c := range m.K8sGateway.Status.Conditions {
		if K8sGatewayStatusContains(K8sGatewayConditionStatus, c.Type, string(c.Status)) {
			check := models.IstioCheck{
				Message:  c.Message,
				Severity: "warning",
				Path:     "status/conditions/type/" + c.Type,
			}
			validations = append(validations, &check)
		}
	}

	return validations, len(validations) == 0
}

func K8sGatewayStatusContains(status []K8sGatewayStatus, t string, c string) bool {
	for _, st := range status {
		if st.ObjectField == t && st.Status == c {
			return true
		}
	}
	return false
}
