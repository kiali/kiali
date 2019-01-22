package virtual_services

import (
	"fmt"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Namespace         string
	ServiceNames      []string
	VirtualService    kubernetes.IstioObject
	ServiceEntryHosts map[string]struct{}
}

func (virtualService NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	routeProtocols := []string{"http", "tcp", "tls"}
	if valid = kubernetes.FilterByRoute(virtualService.VirtualService.GetSpec(), routeProtocols, virtualService.ServiceNames, virtualService.Namespace, virtualService.ServiceEntryHosts); !valid {
		for _, protocol := range routeProtocols {
			if _, ok := virtualService.VirtualService.GetSpec()[protocol]; ok {
				validation := models.BuildCheck("DestinationWeight on route doesn't have a valid service (host not found)", "error", fmt.Sprintf("spec/%s", protocol))
				validations = append(validations, &validation)
			}
		}
		if len(validations) == 0 {
			validation := models.BuildCheck("VirtualService doesn't define any route protocol", "error", "")
			validations = append(validations, &validation)
		}
	}

	return validations, valid
}
