package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers"
	"github.com/kiali/kiali/services/models"
)

type IstioValidationsService struct {
	k8s kubernetes.IstioClientInterface
}

type ObjectChecker interface {
	Check() *models.IstioValidations
}

func (in *IstioValidationsService) GetServiceValidations(namespace, service string) (models.IstioValidations, error) {
	// Get all the Istio objects from a namespace and service
	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, err
	}

	objectCheckers := enabledCheckersFor(istioDetails)
	objectCheckersCount := len(objectCheckers)

	objectValidations := models.IstioValidations{}
	validationsChannel := make(chan *models.IstioValidations, objectCheckersCount)

	// Run checks for each IstioObject type
	for _, objectChecker := range objectCheckers {
		go func() {
			validationsChannel <- objectChecker.Check()
			close(validationsChannel)
		}()
	}

	// Receive validations and merge them into one object
	for validation := range validationsChannel {
		objectValidations.MergeValidations(validation)
	}

	// Get groupal validations for same kind istio objects
	return objectValidations, nil
}

func enabledCheckersFor(istioDetails *kubernetes.IstioDetails) []ObjectChecker {
	return []ObjectChecker{
		checkers.RouteRuleChecker{istioDetails.RouteRules},
	}
}
