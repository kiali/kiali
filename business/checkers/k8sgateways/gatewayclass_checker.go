package k8sgateways

import (
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/models"
)

type GatewayClassChecker struct {
	K8sGateway     *k8s_networking_v1beta1.Gateway
	GatewayClasses []*k8s_networking_v1beta1.GatewayClass
}

// Check verifies that the K8s Gateway's selector's gatewayClassName is pointing to existing GatewayClass
func (s GatewayClassChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	if !s.hasMatchingGatewayClass(string(s.K8sGateway.Spec.GatewayClassName)) {
		validation := models.Build("k8sgateways.gatewayclassnotfound", "spec/gatewayClassName")
		validations = append(validations, &validation)
	}
	return validations, len(validations) == 0
}

func (s GatewayClassChecker) hasMatchingGatewayClass(gatewayClassName string) bool {
	for _, cls := range s.GatewayClasses {
		if cls.Name == gatewayClassName {
			return true
		}
	}
	return false
}
