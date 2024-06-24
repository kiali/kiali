package gateways

import (
	"fmt"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type PortChecker struct {
	Gateway *networking_v1.Gateway
}

func (p PortChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	for serverIndex, server := range p.Gateway.Spec.Servers {
		if server == nil {
			continue
		}
		if !kubernetes.ValidatePort(server.Port) {
			validation := models.Build("port.name.mismatch",
				fmt.Sprintf("spec/servers[%d]/port/name", serverIndex))
			validations = append(validations, &validation)
		}
	}
	return validations, len(validations) == 0
}
