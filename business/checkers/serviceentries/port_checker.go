package serviceentries

import (
	"fmt"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type PortChecker struct {
	ServiceEntry networking_v1beta1.ServiceEntry
}

func (p PortChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	for portIndex, port := range p.ServiceEntry.Spec.Ports {
		if port == nil {
			continue
		}
		if !kubernetes.ValidatePort(port) {
			validation := models.Build("port.name.mismatch",
				fmt.Sprintf("spec/ports[%d]/name", portIndex))
			validations = append(validations, &validation)
		}
	}
	return validations, len(validations) == 0
}
