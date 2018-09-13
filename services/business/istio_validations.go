package business

import (
	"fmt"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
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
	svc, err := in.k8s.GetService(namespace, service)
	if err != nil {
		return nil, err
	}

	// Get Gateways and ServiceEntries to validate VirtualServices
	wg := sync.WaitGroup{}
	errChan := make(chan error, 5)

	vs := make([]kubernetes.IstioObject, 0)
	dr := make([]kubernetes.IstioObject, 0)
	gws := make([]kubernetes.IstioObject, 0)
	ses := make([]kubernetes.IstioObject, 0)
	var pl *v1.PodList

	wg.Add(5)
	go fetch(&vs, namespace, service, in.k8s.GetVirtualServices, &wg, errChan)
	go fetch(&dr, namespace, service, in.k8s.GetDestinationRules, &wg, errChan)
	go fetchNoEntry(&gws, namespace, in.k8s.GetGateways, &wg, errChan)
	go fetchNoEntry(&ses, namespace, in.k8s.GetServiceEntries, &wg, errChan)
	go func() {
		defer wg.Done()
		var err error
		pl, err = in.k8s.GetPods(namespace, labels.Set(svc.Spec.Selector).String())
		if err != nil {
			errChan <- err
		}
	}()
	wg.Wait()
	/* TODO revisit if Gateways and ServiceEntries are used here, something seems missing
	   istioDetails is not passed
	if len(errChan) == 0 {
		istioDetails.Gateways = gws
		istioDetails.ServiceEntries = ses
	} else {
		err = <-errChan
		return nil, err
	}
	*/
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}
	objectCheckers := []ObjectChecker{
		checkers.VirtualServiceChecker{namespace, dr, vs},
		checkers.PodChecker{Pods: pl.Items},
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

	serviceList, err := in.k8s.GetServices(namespace, nil)
	if err != nil {
		return nil, err
	}

	// Get Gateways and ServiceEntries to validate VirtualServices
	wg := sync.WaitGroup{}
	errChan := make(chan error, 2)

	gws := make([]kubernetes.IstioObject, 0)
	ses := make([]kubernetes.IstioObject, 0)

	wg.Add(2)
	go fetchNoEntry(&gws, namespace, in.k8s.GetGateways, &wg, errChan)
	go fetchNoEntry(&ses, namespace, in.k8s.GetServiceEntries, &wg, errChan)
	wg.Wait()
	if len(errChan) == 0 {
		istioDetails.Gateways = gws
		istioDetails.ServiceEntries = ses
	} else {
		err = <-errChan
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
	deployment, err := in.k8s.GetDeployment(namespace, workload)
	if err != nil {
		return nil, err
	}
	selector, _ := kubernetes.GetSelectorAsString(deployment)
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
	serviceList, err := in.k8s.GetServices(namespace, nil)
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

	switch objectType {
	case "gateways":
		// Validations on Gateways are not yet in place
	case "virtualservices":
		wg.Add(3)
		errChan := make(chan error, 3)
		go fetch(&vss, namespace, "", in.k8s.GetVirtualServices, &wg, errChan)
		go fetch(&drs, namespace, "", in.k8s.GetDestinationRules, &wg, errChan)
		go fetchNoEntry(&gws, namespace, in.k8s.GetGateways, &wg, errChan)
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

func fetch(rValue *[]kubernetes.IstioObject, namespace string, service string, fetcher func(string, string) ([]kubernetes.IstioObject, error), wg *sync.WaitGroup, errChan chan error) {
	defer wg.Done()
	fetched, err := fetcher(namespace, service)
	*rValue = append(*rValue, fetched...)
	if err != nil {
		errChan <- err
	}
}

// Identical to above, but since k8s layer has both (namespace, serviceentry) and (namespace) queries, we need two different functions
func fetchNoEntry(rValue *[]kubernetes.IstioObject, namespace string, fetcher func(string) ([]kubernetes.IstioObject, error), wg *sync.WaitGroup, errChan chan error) {
	defer wg.Done()
	fetched, err := fetcher(namespace)
	*rValue = append(*rValue, fetched...)
	if err != nil {
		errChan <- err
	}
}
