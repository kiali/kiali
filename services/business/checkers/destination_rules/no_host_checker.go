package destination_rules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type NoHostChecker struct {
	Namespace       string
	ServiceNames    []string
	DestinationRule kubernetes.IstioObject
}

func (destinationRule NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	for _, serviceName := range destinationRule.ServiceNames {
		if host, ok := destinationRule.DestinationRule.GetSpec()["host"]; ok {
			if dHost, ok := host.(string); ok && kubernetes.CheckHostnameService(dHost, serviceName, destinationRule.Namespace) {
				valid = true
				break
			}
		}
	}

	if !valid {
		validation := models.BuildCheck("Host doesn't have a valid service", "error", "spec/host")
		validations = append(validations, &validation)
	}

	return validations, valid
}
