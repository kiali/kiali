package virtual_services

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type NoHostChecker struct {
	Namespace      string
	ServiceNames   []string
	VirtualService kubernetes.IstioObject
}

func (virtualService NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	for _, serviceName := range virtualService.ServiceNames {
		if valid = kubernetes.FilterByHost(virtualService.VirtualService.GetSpec(), serviceName); valid {
			break
		}
	}

	if !valid {
		validation := models.BuildCheck("Hosts doesn't have a valid service", "error", "spec/hosts")
		validations = append(validations, &validation)
	}

	return validations, valid
}
