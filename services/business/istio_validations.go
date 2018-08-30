package business

import (
	"fmt"
	"sync"

	"github.com/kiali/kiali/kubernetes"
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

	// Get serviceDetails from a Namespace and service
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, err
	}

	objectCheckers := []ObjectChecker{
		checkers.VirtualServiceChecker{namespace, istioDetails.DestinationRules,
			istioDetails.VirtualServices},
		checkers.PodChecker{Pods: serviceDetails.Pods},
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

func (in *IstioValidationsService) GetWorkloadValidations(namespace string, workload string) (models.IstioValidations, error) {
	selector, err := in.k8s.GetDeploymentSelector(namespace, workload)
	if err != nil {
		return nil, err
	}
	dPods, err := in.k8s.GetPods(namespace, selector)
	if err != nil {
		return nil, err
	}

	objectCheckers := []ObjectChecker{
		checkers.PodChecker{Pods: dPods.Items},
	}

	return runObjectCheckers(objectCheckers), nil
}

func (in *IstioValidationsService) GetIstioObjectValidations(namespace string, objectType string, object string) (models.IstioValidations, error) {
	serviceList, err := in.k8s.GetServices(namespace)
	if err != nil {
		return nil, err
	}

	// Get only the given Istio Object
	var dr kubernetes.IstioObject
	vss := make([]kubernetes.IstioObject, 0)
	ses := make([]kubernetes.IstioObject, 0)
	drs := make([]kubernetes.IstioObject, 0)
	gws := make([]kubernetes.IstioObject, 0)
	var objectCheckers []ObjectChecker
	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, ServiceList: serviceList}
	istioDetails := kubernetes.IstioDetails{}
	noServiceChecker.IstioDetails = &istioDetails

	wg := sync.WaitGroup{}
	fetch := func(rValue *[]kubernetes.IstioObject, namespace string, fetcher func(string, string) ([]kubernetes.IstioObject, error), errChan chan error) {
		defer wg.Done()
		fetched, err := fetcher(namespace, "")
		*rValue = append(*rValue, fetched...)
		if err != nil {
			errChan <- err
		}
	}

	// Identical to above, but since k8s layer has both (namespace, serviceentry) and (namespace) queries, we need two different functions
	fetchNoEntry := func(rValue *[]kubernetes.IstioObject, namespace string, fetcher func(string) ([]kubernetes.IstioObject, error), errChan chan error) {
		defer wg.Done()
		fetched, err := fetcher(namespace)
		*rValue = append(*rValue, fetched...)
		if err != nil {
			errChan <- err
		}
	}

	switch objectType {
	case "gateways":
		// Validations on Gateways are not yet in place
	case "virtualservices":
		wg.Add(3)
		errChan := make(chan error, 3)
		go fetch(&vss, namespace, in.k8s.GetVirtualServices, errChan)
		go fetch(&drs, namespace, in.k8s.GetDestinationRules, errChan)
		go fetchNoEntry(&gws, namespace, in.k8s.GetGateways, errChan)
		// We can block current goroutine for the fourth fetch
		ses, err = in.k8s.GetServiceEntries(namespace)
		if err != nil {
			errChan <- err
		}
		wg.Wait()
		if len(errChan) == 0 {
			istioDetails.ServiceEntries = ses
			istioDetails.VirtualServices = vss
			istioDetails.DestinationRules = drs
			istioDetails.Gateways = gws
			virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, VirtualServices: istioDetails.VirtualServices, DestinationRules: istioDetails.DestinationRules}
			objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
		} else {
			err = <-errChan
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

	return runObjectCheckers(objectCheckers).FilterByKey(models.ObjectTypeSingular[objectType], object), nil
}

func runObjectCheckers(objectCheckers []ObjectChecker) models.IstioValidations {
	objectTypeValidations := models.IstioValidations{}

	// Run checks for each IstioObject type
	for _, objectChecker := range objectCheckers {
		objectTypeValidations.MergeValidations(objectChecker.Check())
	}
	return objectTypeValidations
}
