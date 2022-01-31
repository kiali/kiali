package business

import (
	"context"
	"fmt"
	"sync"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioReferencesService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type ReferenceChecker interface {
	Check() models.IstioReferences
}

// GetIstioObjectReferences returns all references to Configs, Services and Workloads of a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioReferencesService) GetIstioObjectReferences(ctx context.Context, namespace string, objectType string, object string) (models.IstioReferences, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectReferences",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectType", objectType),
		observability.Attribute("object", object),
	)
	defer end()

	var istioConfigList models.IstioConfigList
	var namespaces models.Namespaces
	var services models.ServiceList
	var workloads models.WorkloadList
	var workloadsPerNamespace map[string]models.WorkloadList
	var registryServices []*kubernetes.RegistryService
	var err error
	var referenceCheckers []ReferenceChecker

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return nil, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(4)
	go in.fetchNamespaces(ctx, &namespaces, errChan, &wg)
	go in.fetchRegistryConfigs(ctx, &istioConfigList, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, errChan, &wg)
	go in.fetchRegistryServices(&registryServices, errChan, &wg)
	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, IstioConfigList: istioConfigList, ExportedResources: &exportedResources, ServiceList: services, WorkloadList: workloads, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices}

	switch objectType {
	case kubernetes.Gateways:
		// References on Gateways
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: exportedResources.VirtualServices, DestinationRules: exportedResources.DestinationRules}
		referenceCheckers = []ReferenceChecker{noServiceChecker, virtualServiceChecker}
	case kubernetes.DestinationRules:
		// References on DestinationRules are not yet in place
	case kubernetes.ServiceEntries:
		// References on ServiceEntries are not yet in place
	case kubernetes.Sidecars:
		// References on Sidecars are not yet in place
	case kubernetes.AuthorizationPolicies:
		// References on AuthorizationPolicies are not yet in place
	case kubernetes.PeerAuthentications:
		// References on PeerAuthentications are not yet in place
	case kubernetes.RequestAuthentications:
		// Validation on RequestAuthentications are not yet in place
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
	}

	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, err
		}
	}

	if referenceCheckers == nil {
		return models.IstioReferences{}, err
	}

	return runObjectCheckers(referenceCheckers).FilterByKey(models.ObjectTypeSingular[objectType], object), nil
}

func runObjectReferences(referenceCheckers []ReferenceChecker) models.IstioReferences {
	objectTypeValidations := models.IstioReferences{}

	// Run checks for each IstioObject type
	for _, referenceChecker := range referenceCheckers {
		objectTypeValidations.MergeValidations(runObjectChecker(referenceChecker))
	}

	objectTypeValidations.StripIgnoredChecks()

	return objectTypeValidations
}

func runObjectReference(referenceChecker ReferenceChecker) models.IstioReferences {
	// tracking the time it takes to execute the Check
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(fmt.Sprintf("%T", referenceChecker))
	defer promtimer.ObserveDuration()
	return referenceChecker.Check()
}

func (in *IstioReferencesService) fetchRegistryConfigs(ctx context.Context, rValue *models.IstioConfigList, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}
	criteria := IstioConfigCriteria{
		AllNamespaces:                 true,
		IncludeDestinationRules:       true,
		IncludeGateways:               true,
		IncludeServiceEntries:         true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
		IncludeRequestAuthentications: true,
		IncludeWorkloadEntries:        true,
	}
	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
	if err != nil {
		select {
		case errChan <- err:
		default:
		}
	} else {
		*rValue = istioConfigList
	}
}
