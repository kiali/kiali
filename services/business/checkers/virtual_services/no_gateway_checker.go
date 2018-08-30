package virtual_services

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type NoGatewayChecker struct {
	VirtualService kubernetes.IstioObject
	GatewayNames   map[string]struct{}
}

// Check validates that all the
func (s NoGatewayChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	if valid = kubernetes.ValidateVirtualServiceGateways(s.VirtualService.GetSpec(), s.GatewayNames); !valid {
		validation := models.BuildCheck("VirtualService is pointing to a non-existent gateway", "error", "")
		validations = append(validations, &validation)
	}
	return validations, valid
}
