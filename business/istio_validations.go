package business

import (
	"fmt"
	"sync"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
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
	promtimer := internalmetrics.GetGoFunctionProcessingTimePrometheusTimer("business", "IstioValidationsService", "GetServiceValidations")
	defer promtimer.ObserveDuration()

	// Ensure the service exists
	if _, err := in.k8s.GetService(namespace, service); err != nil {
		return nil, err
	}

	// Get Gateways and ServiceEntries to validate VirtualServices
	var err error
	wg := sync.WaitGroup{}
	errChan := make(chan error, 2)

	vs := make([]kubernetes.IstioObject, 0)
	drs := make([]kubernetes.IstioObject, 0)

	wg.Add(2)
	go fetch(&vs, namespace, service, in.k8s.GetVirtualServices, &wg, errChan)
	go fetch(&drs, namespace, service, in.k8s.GetDestinationRules, &wg, errChan)
	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}
	objectCheckers := []ObjectChecker{
		checkers.VirtualServiceChecker{namespace, drs, vs},
		checkers.DestinationRulesChecker{DestinationRules: drs},
	}

	// Get group validations for same kind istio objects
	return runObjectCheckers(objectCheckers), nil
}

func (in *IstioValidationsService) GetNamespaceValidations(namespace string) (models.NamespaceValidations, error) {
	promtimer := internalmetrics.GetGoFunctionProcessingTimePrometheusTimer("business", "IstioValidationsService", "GetNamespaceValidations")
	defer promtimer.ObserveDuration()

	// Ensure the Namespace exists
	if _, err := in.k8s.GetNamespace(namespace); err != nil {
		return nil, err
	}

	// Get all the Istio objects from a Namespace
	istioDetails, err := in.k8s.GetIstioDetails(namespace, "")
	if err != nil {
		return nil, err
	}

	services, err := in.k8s.GetServices(namespace, nil)
	if err != nil {
		return nil, err
	}

	// Get Gateways and ServiceEntries to validate VirtualServices
	wg := sync.WaitGroup{}
	errChan := make(chan error, 2)

	gws := make([]kubernetes.IstioObject, 0)
	drs := make([]kubernetes.IstioObject, 0)
	ses := make([]kubernetes.IstioObject, 0)

	wg.Add(3)
	go fetch(&drs, namespace, "", in.k8s.GetDestinationRules, &wg, errChan)
	go fetchNoEntry(&gws, namespace, in.k8s.GetGateways, &wg, errChan)
	go fetchNoEntry(&ses, namespace, in.k8s.GetServiceEntries, &wg, errChan)
	wg.Wait()
	if len(errChan) == 0 {
		istioDetails.Gateways = gws
		istioDetails.ServiceEntries = ses
		istioDetails.DestinationRules = drs
	} else {
		err = <-errChan
		return nil, err
	}

	objectCheckers := []ObjectChecker{
		checkers.VirtualServiceChecker{namespace, istioDetails.DestinationRules,
			istioDetails.VirtualServices},
		checkers.NoServiceChecker{Namespace: namespace, IstioDetails: istioDetails, Services: services},
		checkers.DestinationRulesChecker{DestinationRules: drs},
	}

	return models.NamespaceValidations{namespace: runObjectCheckers(objectCheckers)}, nil
}

func (in *IstioValidationsService) GetIstioObjectValidations(namespace string, objectType string, object string) (models.IstioValidations, error) {
	promtimer := internalmetrics.GetGoFunctionProcessingTimePrometheusTimer("business", "IstioValidationsService", "GetIstioObjectValidations")
	defer promtimer.ObserveDuration()

	services, err := in.k8s.GetServices(namespace, nil)
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
	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, Services: services}
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
		if drs, err := in.k8s.GetDestinationRules(namespace, ""); err == nil {
			for _, o := range drs {
				meta := o.GetObjectMeta()
				if meta.Name == object {
					dr = o
					break
				}
			}
			istioDetails.DestinationRules = []kubernetes.IstioObject{dr} // Single destination rule only available here, not whole namespace
			destinationRulesChecker := checkers.DestinationRulesChecker{DestinationRules: drs}
			objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
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
