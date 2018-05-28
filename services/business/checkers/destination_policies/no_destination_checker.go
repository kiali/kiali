package destination_policies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type NoDestinationChecker struct {
	Namespace         string
	ServiceNames      []string
	DestinationPolicy kubernetes.IstioObject
}

func (destinationPolicy NoDestinationChecker) Check() ([]*models.IstioCheck, bool) {
	valid := false
	validations := make([]*models.IstioCheck, 0)

	for _, serviceName := range destinationPolicy.ServiceNames {
		if valid = kubernetes.FilterByDestination(destinationPolicy.DestinationPolicy.GetSpec(), destinationPolicy.Namespace, serviceName, ""); valid {
			break
		}
	}

	if !valid {
		validation := models.BuildCheck("Destination doesn't have a valid service", "error", "spec/destination")
		validations = append(validations, &validation)
	}

	return validations, valid
}
