package destination_rules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type NoNameChecker struct {
	Namespace       string
	ServiceNames    []string
	DestinationRule kubernetes.IstioObject
}

func (destinationRule NoNameChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	for _, serviceName := range destinationRule.ServiceNames {
		if name, ok := destinationRule.DestinationRule.GetSpec()["host"]; ok && name == serviceName {
			valid = true
			break
		}
	}

	if !valid {
		validation := models.BuildCheck("Name doesn't have a valid service", "error", "spec/name")
		validations = append(validations, &validation)
	}

	return validations, valid
}
