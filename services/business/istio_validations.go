package business

import (
	"fmt"

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
		checkers.VirtualServiceChecker{namespace, istioDetails.DestinationRules,
			istioDetails.VirtualServices},
		checkers.PodChecker{Pods: pods.Items},
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

	objectCheckers := []ObjectChecker{
		checkers.VirtualServiceChecker{namespace, istioDetails.DestinationRules,
			istioDetails.VirtualServices},
		checkers.NoServiceChecker{Namespace: namespace, IstioDetails: istioDetails, ServiceList: serviceList},
	}

	return models.NamespaceValidations{namespace: runObjectCheckers(objectCheckers)}, nil
}

func (in *IstioValidationsService) GetIstioObjectValidations(namespace string, objectType string, object string) (models.IstioValidations, error) {
	serviceList, err := in.k8s.GetServices(namespace)
	if err != nil {
		return nil, err
	}

	// Get only the given Istio Object
	var vs, dr kubernetes.IstioObject
	var objectCheckers []ObjectChecker
	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, ServiceList: serviceList}
	istioDetails := kubernetes.IstioDetails{}
	noServiceChecker.IstioDetails = &istioDetails
	switch objectType {
	case "gateways":
		// Validations on Gateways are not yet in place
	case "virtualservices":
		if vs, err = in.k8s.GetVirtualService(namespace, object); err == nil {
			if drs, err := in.k8s.GetDestinationRules(namespace, ""); err == nil {
				istioDetails.VirtualServices = []kubernetes.IstioObject{vs}
				istioDetails.DestinationRules = drs
				virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, VirtualServices: istioDetails.VirtualServices, DestinationRules: istioDetails.DestinationRules}
				objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
			}
		}
	case "destinationrules":
		if dr, err = in.k8s.GetDestinationRule(namespace, object); err == nil {
			istioDetails.DestinationRules = []kubernetes.IstioObject{dr}
			objectCheckers = []ObjectChecker{noServiceChecker}
		}
	case "serviceentries":
		// Validations on ServiceEntries are not yet in place
	case "rules":
		// Validations on Istio Rules are not yet in place
	case "quotaspecs":
		// Validations on QuotaSpecs are not yet in place
	case "quotaspecbindings":
		// Validations on QuotaSpecBindings are not yet in place
	default:
		err = fmt.Errorf("Object type not found: %v", objectType)
	}

	if objectCheckers == nil || err != nil {
		return models.IstioValidations{}, err
	}

	return runObjectCheckers(objectCheckers), nil
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
