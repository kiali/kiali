package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/business/checkers"
	"github.com/kiali/kiali/services/models"
)

type IstioValidationsService struct {
	k8s kubernetes.IstioClientInterface
}

type ObjectChecker interface {
	Check() models.IstioValidations
}

// GetServiceValidations returns an IstioValidations object with all the checks found when running
// all the enabled checkers.
func (in *IstioValidationsService) GetServiceValidations(namespace, service string) (models.IstioValidations, error) {
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

	objectCheckers := []ObjectChecker{
		checkers.RouteRuleChecker{namespace, pods.Items, istioDetails.RouteRules},
		&checkers.PodChecker{Pods: pods.Items},
	}

	// Get groupal validations for same kind istio objects
	return runObjectCheckers(objectCheckers), nil
}

func (in *IstioValidationsService) GetNamespaceValidations(namespace string) (models.NamespaceValidations, error) {
	// Get all the Istio objects from a Namespace
	istioDetails, err := in.k8s.GetIstioDetails(namespace, "")
	if err != nil {
		return nil, err
	}

	serviceList, err := in.k8s.GetServices(namespace)
	if err != nil {
		return nil, err
	}

	pods, err := in.k8s.GetNamespacePods(namespace)
	if err != nil {
		log.Warningf("Cannot get pods for namespace %v.", namespace)
		return nil, err
	}

	objectCheckers := []ObjectChecker{
		checkers.RouteRuleChecker{Namespace: namespace, PodList: pods.Items, RouteRules: istioDetails.RouteRules},
		checkers.NoServiceChecker{IstioDetails: istioDetails, ServiceList: serviceList},
	}

	return models.NamespaceValidations{namespace: runObjectCheckers(objectCheckers)}, nil
}

func runObjectCheckers(objectCheckers []ObjectChecker) models.IstioValidations {
	objectTypeValidations := models.IstioValidations{}
	validationsChannels := make([]chan models.IstioValidations, len(objectCheckers))

	// Run checks for each IstioObject type
	for i, objectChecker := range objectCheckers {
		validationsChannels[i] = make(chan models.IstioValidations)
		go func(channel chan models.IstioValidations, checker ObjectChecker) {
			channel <- checker.Check()
			close(channel)
		}(validationsChannels[i], objectChecker)
	}

	// Receive validations and merge them into one object
	for _, validation := range validationsChannels {
		objectTypeValidations.MergeValidations(<-validation)
	}
	return objectTypeValidations
}
