package business

import (
	"context"
	"fmt"
	"sync"

	"github.com/kiali/kiali/business/references"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioReferencesService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type ReferenceChecker interface {
	References() models.IstioReferences
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

	var namespaces models.Namespaces
	var istioConfigDetails models.IstioConfigDetails
	var err error
	var referenceChecker ReferenceChecker

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return models.IstioReferences{}, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(2)
	go in.fetchNamespaces(ctx, &namespaces, errChan, &wg)
	go in.fetchIstioConfigDetails(ctx, &istioConfigDetails, namespace, objectType, object, errChan, &wg)
	wg.Wait()

	switch objectType {
	case kubernetes.Gateways:
		// References on Gateways
	case kubernetes.VirtualServices:
		referenceChecker = references.VirtualServiceReferences{Namespace: namespace, Namespaces: namespaces, VirtualService: *istioConfigDetails.VirtualService}
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
			return models.IstioReferences{}, err
		}
	}

	if referenceChecker == nil {
		return models.IstioReferences{}, err
	}

	return runObjectReference(referenceChecker), nil
}

func runObjectReference(referenceChecker ReferenceChecker) models.IstioReferences {
	// tracking the time it takes to execute the Check
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(fmt.Sprintf("%T", referenceChecker))
	defer promtimer.ObserveDuration()
	return referenceChecker.References()
}

func (in *IstioReferencesService) fetchIstioConfigDetails(ctx context.Context, rValue *models.IstioConfigDetails, namespace string, objectType string, object string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	istioConfigDetails, err := in.businessLayer.IstioConfig.GetIstioConfigDetails(ctx, namespace, objectType, object)
	if err != nil {
		select {
		case errChan <- err:
		default:
		}
	} else {
		*rValue = istioConfigDetails
	}
}

func (in *IstioReferencesService) fetchNamespaces(ctx context.Context, rValue *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		namespaces, err := in.businessLayer.Namespace.GetNamespaces(ctx)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = namespaces
		}
	}
}
