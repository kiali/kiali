package serviceentries

import (
	"fmt"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type PortChecker struct {
	ServiceEntry kubernetes.IstioObject
}

func (p PortChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if portsSpec, found := p.ServiceEntry.GetSpec()["ports"]; found {
		if ports, ok := portsSpec.([]interface{}); ok {
			for portIndex, port := range ports {
				if portDef, ok := port.(map[string]interface{}); ok {
					if !kubernetes.ValidatePort(portDef) {
						validation := models.Build("port.name.mismatch",
							fmt.Sprintf("spec/ports[%d]/name", portIndex))
						validations = append(validations, &validation)
					}
				}
			}
		}
	}

	return validations, len(validations) == 0
}
