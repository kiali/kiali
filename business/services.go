package business

import (
	"fmt"
	"sync"
	"time"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

// GetServiceList returns a list of all services for a given Namespace
func (in *SvcService) GetServiceList(namespace string) (*models.ServiceList, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetServiceList")
	defer promtimer.ObserveNow(&err)

	var svcs []core_v1.Service
	var pods []core_v1.Pod
	var deployments []apps_v1.Deployment

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	wg := sync.WaitGroup{}
	wg.Add(3)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err2 error
		// Check if namespace is cached
		// Namespace access is checked in the upper call
		if IsNamespaceCached(namespace) {
			svcs, err2 = kialiCache.GetServices(namespace, nil)
		} else {
			svcs, err2 = in.k8s.GetServices(namespace, nil)
		}
		if err2 != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		// Check if namespace is cached
		// Namespace access is checked in the upper call
		if IsNamespaceCached(namespace) {
			pods, err2 = kialiCache.GetPods(namespace, "")
		} else {
			pods, err2 = in.k8s.GetPods(namespace, "")
		}
		if err2 != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		// Check if namespace is cached
		// Namespace access is checked in the upper call
		if IsNamespaceCached(namespace) {
			deployments, err = kialiCache.GetDeployments(namespace)
		} else {
			deployments, err = in.k8s.GetDeployments(namespace)
		}
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, svcs, pods, deployments), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, svcs []core_v1.Service, pods []core_v1.Pod, deployments []apps_v1.Deployment) *models.ServiceList {
	services := make([]models.ServiceOverview, len(svcs))
	conf := config.Get()
	validations := in.getServiceValidations(svcs, deployments, pods)
	// Convert each k8s service into our model
	for i, item := range svcs {
		sPods := kubernetes.FilterPodsForService(&item, pods)
		/** Check if Service has istioSidecar deployed */
		mPods := models.Pods{}
		mPods.Parse(sPods)
		hasSidecar := mPods.HasIstioSidecar()
		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector[conf.IstioLabels.AppLabelName]
		/** Check if Service has additional item icon */
		services[i] = models.ServiceOverview{
			Name:                   item.Name,
			IstioSidecar:           hasSidecar,
			AppLabel:               appLabel,
			AdditionalDetailSample: models.GetFirstAdditionalIcon(conf, item.ObjectMeta.Annotations),
			HealthAnnotations:      models.GetHealthAnnotation(item.Annotations, models.GetHealthConfigAnnotation()),
			Labels:                 item.Labels,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services, Validations: validations}
}

// GetService returns a single service and associated data using the interval and queryTime
func (in *SvcService) GetService(namespace, service, interval string, queryTime time.Time) (*models.ServiceDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetService")
	defer promtimer.ObserveNow(&err)

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	svc, eps, err := in.getServiceDefinition(namespace, service)
	if err != nil {
		return nil, err
	}

	var pods []core_v1.Pod
	var hth models.ServiceHealth
	var vs, dr []kubernetes.IstioObject
	var ws models.Workloads
	var nsmtls models.MTLSStatus

	conf := config.Get()
	additionalDetails := models.GetAdditionalDetails(conf, svc.ObjectMeta.Annotations)

	wg := sync.WaitGroup{}
	wg.Add(5)
	errChan := make(chan error, 5)

	labelsSelector := labels.Set(svc.Spec.Selector).String()
	// If service doesn't have any selector, we can't know which are the pods and workloads applying.
	if labelsSelector != "" {
		wg.Add(2)

		go func() {
			defer wg.Done()
			var err2 error
			// Check if namespace is cached
			// Namespace access is checked in the upper caller
			if IsNamespaceCached(namespace) {
				pods, err2 = kialiCache.GetPods(namespace, labelsSelector)
			} else {
				pods, err2 = in.k8s.GetPods(namespace, labelsSelector)
			}
			if err2 != nil {
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			ws, err2 = fetchWorkloads(in.businessLayer, namespace, labelsSelector)
			if err2 != nil {
				log.Errorf("Error fetching Workloads per namespace %s and service %s: %s", namespace, service, err2)
				errChan <- err2
			}
		}()
	}

	go func() {
		defer wg.Done()
		var err2 error
		hth, err2 = in.businessLayer.Health.GetServiceHealth(namespace, service, interval, queryTime)
		if err2 != nil {
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		nsmtls, err2 = in.businessLayer.TLS.NamespaceWidemTLSStatus(namespace)
		if err2 != nil {
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		// Check if namespace is cached
		// Namespace access is checked in the upper caller
		if IsResourceCached(namespace, kubernetes.VirtualServices) {
			vs, err2 = kialiCache.GetIstioObjects(namespace, kubernetes.VirtualServices, "")
		} else {
			vs, err2 = in.k8s.GetIstioObjects(namespace, kubernetes.VirtualServices, "")
		}
		if err2 != nil {
			errChan <- err2
		} else {
			vs = kubernetes.FilterVirtualServices(vs, namespace, service)
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		if IsResourceCached(namespace, kubernetes.DestinationRules) {
			dr, err2 = kialiCache.GetIstioObjects(namespace, kubernetes.DestinationRules, "")
		} else {
			dr, err2 = in.k8s.GetIstioObjects(namespace, kubernetes.DestinationRules, "")
		}
		if err2 != nil {
			errChan <- err2
		} else {
			dr = kubernetes.FilterDestinationRules(dr, namespace, service)
		}
	}()

	var vsCreate, vsUpdate, vsDelete bool
	var drCreate, drUpdate, drDelete bool
	go func() {
		defer wg.Done()
		/*
			We can safely assume that permissions for VirtualServices will be similar as DestinationRules.

			Synced with:
			https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
		*/
		vsCreate, vsUpdate, vsDelete = getPermissions(in.k8s, namespace, kubernetes.VirtualServices)
		drCreate = vsCreate
		drUpdate = vsUpdate
		drDelete = vsDelete
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	wo := models.WorkloadOverviews{}
	for _, w := range ws {
		wi := &models.WorkloadListItem{}
		wi.ParseWorkload(w)
		wo = append(wo, wi)
	}

	s := models.ServiceDetails{Workloads: wo, Health: hth, NamespaceMTLS: nsmtls, AdditionalDetails: additionalDetails}
	s.SetService(svc)
	s.SetPods(kubernetes.FilterPodsForEndpoints(eps, pods))
	s.SetEndpoints(eps)
	s.SetVirtualServices(vs, vsCreate, vsUpdate, vsDelete)
	s.SetDestinationRules(dr, drCreate, drUpdate, drDelete)
	return &s, nil
}

func (in *SvcService) UpdateService(namespace, service string, interval string, queryTime time.Time, jsonPatch string) (*models.ServiceDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetService")
	defer promtimer.ObserveNow(&err)

	// Identify controller and apply patch to workload
	err = updateService(in.businessLayer, namespace, service, jsonPatch)
	if err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.RefreshNamespace(namespace)
	}

	// After the update we fetch the whole workload
	return in.GetService(namespace, service, interval, queryTime)
}

// GetServiceDefinition returns a single service definition (the service object and endpoints), no istio or runtime information
func (in *SvcService) GetServiceDefinition(namespace, service string) (*models.ServiceDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetServiceDefinition")
	defer promtimer.ObserveNow(&err)

	svc, eps, err := in.getServiceDefinition(namespace, service)
	if err != nil {
		return nil, err
	}

	s := models.ServiceDetails{}
	s.SetService(svc)
	s.SetEndpoints(eps)
	return &s, nil
}

func (in *SvcService) getService(namespace, service string) (svc *core_v1.Service, err error) {
	if IsNamespaceCached(namespace) {
		// Cache uses Kiali ServiceAccount, check if user can access to the namespace
		if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err == nil {
			svc, err = kialiCache.GetService(namespace, service)
		}
	} else {
		svc, err = in.k8s.GetService(namespace, service)
	}
	return svc, err
}

func (in *SvcService) getServiceDefinition(namespace, service string) (svc *core_v1.Service, eps *core_v1.Endpoints, err error) {
	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err2 error
		svc, err2 = in.getService(namespace, service)
		if err2 != nil {
			log.Errorf("Error fetching definition for service [%s:%s]: %s", namespace, service, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		if IsNamespaceCached(namespace) {
			// Cache uses Kiali ServiceAccount, check if user can access to the namespace
			if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err == nil {
				eps, err = kialiCache.GetEndpoints(namespace, service)
			}
		} else {
			eps, err2 = in.k8s.GetEndpoints(namespace, service)
		}
		if err2 != nil && !errors.IsNotFound(err2) {
			log.Errorf("Error fetching Endpoints  namespace %s and service %s: %s", namespace, service, err2)
			errChan <- err2
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, nil, err
	}
	if svc == nil {
		return nil, nil, kubernetes.NewNotFound(service, "Kiali", "Service")
	}

	return svc, eps, nil
}

// GetServiceDefinitionList returns service definitions for the namespace (the service object only), no istio or runtime information
func (in *SvcService) GetServiceDefinitionList(namespace string) (*models.ServiceDefinitionList, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetServiceDefinitionList")
	defer promtimer.ObserveNow(&err)

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	var svcs []core_v1.Service
	// Check if namespace is cached
	if IsNamespaceCached(namespace) {
		svcs, err = kialiCache.GetServices(namespace, nil)
	} else {
		svcs, err = in.k8s.GetServices(namespace, nil)
	}
	if err != nil {
		log.Errorf("Error fetching Service definitions for namespace %s: %s", namespace, err)
	}

	// Convert to Kiali model
	sdl := models.ServiceDefinitionList{
		Namespace:          models.Namespace{Name: namespace},
		ServiceDefinitions: []models.ServiceDetails{},
	}
	for _, svc := range svcs {
		s := models.ServiceDetails{}
		s.SetService(&svc)
		sdl.ServiceDefinitions = append(sdl.ServiceDefinitions, s)
	}
	return &sdl, nil
}

func (in *SvcService) getServiceValidations(services []core_v1.Service, deployments []apps_v1.Deployment, pods []core_v1.Pod) models.IstioValidations {
	validations := checkers.ServiceChecker{
		Services:    services,
		Deployments: deployments,
		Pods:        pods,
	}.Check()

	return validations
}

// GetServiceAppName returns the "Application" name (app label) that relates to a service
// This label is taken from the service selector, which means it is assumed that pods are selected using that label
func (in *SvcService) GetServiceAppName(namespace, service string) (string, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return "", err
	}

	svc, err := in.getService(namespace, service)
	if svc == nil || err != nil {
		return "", fmt.Errorf("Service [namespace: %s] [name: %s] doesn't exist.", namespace, service)
	}

	appLabelName := config.Get().IstioLabels.AppLabelName
	app := svc.Spec.Selector[appLabelName]
	return app, nil
}

func updateService(layer *Layer, namespace string, service string, jsonPatch string) error {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := layer.Namespace.GetNamespace(namespace); err != nil {
		return err
	}

	return layer.k8s.UpdateService(namespace, service, jsonPatch)
}
