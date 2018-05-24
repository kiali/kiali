package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/business/checkers"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

type IstioValidationsService struct {
	k8s kubernetes.IstioClientInterface
}

type ObjectChecker interface {
	Check() *models.IstioTypeValidations
}

func (in *IstioValidationsService) GetServiceValidations(namespace, service string) (models.IstioTypeValidations, error) {
	// Get all the Istio objects from a Namespace and service
	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, err
	}

	pods, err := in.k8s.GetServicePods(namespace, service, "")
	if err != nil {
		log.Warningf("Cannot get pods for service %v.%v.", namespace, service)
		return nil, err
	}

	objectCheckers := enabledCheckersFor(istioDetails, pods)
	objectCheckersCount := len(objectCheckers)

	objectTypeValidations := models.IstioTypeValidations{}
	validationsChannels := make([]chan *models.IstioTypeValidations, objectCheckersCount)

	// Run checks for each IstioObject type
	for i, objectChecker := range objectCheckers {
		validationsChannels[i] = make(chan *models.IstioTypeValidations)
		go func(channel chan *models.IstioTypeValidations, checker ObjectChecker) {
			channel <- checker.Check()
			close(channel)
		}(validationsChannels[i], objectChecker)
	}

	// Receive validations and merge them into one object
	for _, validation := range validationsChannels {
		objectTypeValidations.MergeValidations(<-validation)
	}

	// Get groupal validations for same kind istio objects
	return objectTypeValidations, nil
}

func enabledCheckersFor(istioDetails *kubernetes.IstioDetails, pods *v1.PodList) []ObjectChecker {
	return []ObjectChecker{
		checkers.RouteRuleChecker{istioDetails.RouteRules},
		&checkers.PodChecker{Pods: pods.Items},
	}
}
