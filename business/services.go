package business

import (
	"fmt"
	"sync"
	"time"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"context"
	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type ServiceCriteria struct {
	Namespace              string
	IncludeIstioResources  bool
	IncludeOnlyDefinitions bool
	ServiceSelector        string
}

// GetServiceList returns a list of all services for a given criteria
func (in *SvcService) GetServiceList(criteria ServiceCriteria) (*models.ServiceList, error) {
	var svcs []core_v1.Service
	var pods []core_v1.Pod
	var deployments []apps_v1.Deployment
	var istioConfigList models.IstioConfigList
	var err error
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(criteria.Namespace); err != nil {
		return nil, err
	}

	nFetches := 3
	if criteria.IncludeIstioResources {
		nFetches = 4
	}

	wg := sync.WaitGroup{}
	wg.Add(nFetches)
	errChan := make(chan error, nFetches)

	go func() {
		defer wg.Done()
		var err2 error
		var selectorLabels map[string]string
		if criteria.ServiceSelector != "" {
			if selector, err3 := labels.ConvertSelectorToLabelsMap(criteria.ServiceSelector); err3 == nil {
				selectorLabels = selector
			} else {
				log.Warningf("Services not filtered. Selector %s not valid", criteria.ServiceSelector)
			}
		}
		// Check if namespace is cached
		// Namespace access is checked in the upper call
		if IsNamespaceCached(criteria.Namespace) {
			svcs, err2 = kialiCache.GetServices(criteria.Namespace, selectorLabels)
		} else {
			svcs, err2 = in.k8s.GetServices(criteria.Namespace, selectorLabels)
		}
		if err2 != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", criteria.Namespace, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		if !criteria.IncludeOnlyDefinitions {
			// Check if namespace is cached
			// Namespace access is checked in the upper call
			if IsNamespaceCached(criteria.Namespace) {
				pods, err2 = kialiCache.GetPods(criteria.Namespace, "")
			} else {
				pods, err2 = in.k8s.GetPods(criteria.Namespace, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Pods per namespace %s: %s", criteria.Namespace, err2)
				errChan <- err2
			}
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		if !criteria.IncludeOnlyDefinitions {
			// Check if namespace is cached
			// Namespace access is checked in the upper call
			if IsNamespaceCached(criteria.Namespace) {
				deployments, err2 = kialiCache.GetDeployments(criteria.Namespace)
			} else {
				deployments, err2 = in.k8s.GetDeployments(criteria.Namespace)
			}
			if err2 != nil {
				log.Errorf("Error fetching Deployments per namespace %s: %s", criteria.Namespace, err2)
				errChan <- err2
			}
		}
	}()

	if criteria.IncludeIstioResources {
		criteria := IstioConfigCriteria{
			Namespace:               criteria.Namespace,
			IncludeDestinationRules: true,
			IncludeGateways:         true,
			IncludeVirtualServices:  true,
		}
		go func() {
			defer wg.Done()
			var err2 error
			istioConfigList, err2 = in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
			if err2 != nil {
				log.Errorf("Error fetching IstioConfigList per namespace %s: %s", criteria.Namespace, err2)
				errChan <- err2
			}
		}()
	}

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: criteria.Namespace}, svcs, pods, deployments, istioConfigList), nil
}

func getVSKialiScenario(vs []networking_v1alpha3.VirtualService) string {
	scenario := ""
	for _, v := range vs {
		if scenario, ok := v.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func getDRKialiScenario(dr []networking_v1alpha3.DestinationRule) string {
	scenario := ""
	for _, d := range dr {
		if scenario, ok := d.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func (in *SvcService) buildServiceList(namespace models.Namespace, svcs []core_v1.Service, pods []core_v1.Pod, deployments []apps_v1.Deployment, istioConfigList models.IstioConfigList) *models.ServiceList {
	services := make([]models.ServiceOverview, len(svcs))
	conf := config.Get()
	validations := in.getServiceValidations(svcs, deployments, pods)
	// Convert each k8s service into our model
	for i, item := range svcs {
		sPods := kubernetes.FilterPodsForService(&item, pods)
		/** Check if Service has istioSidecar deployed */
		mPods := models.Pods{}
		mPods.Parse(sPods)
		hasSidecar := mPods.HasAnyIstioSidecar()
		svcVirtualServices := kubernetes.FilterVirtualServices(istioConfigList.VirtualServices, item.Namespace, item.Name)
		svcDestinationRules := kubernetes.FilterDestinationRules(istioConfigList.DestinationRules, item.Namespace, item.Name)
		svcGateways := kubernetes.FilterGatewaysByVS(istioConfigList.Gateways, svcVirtualServices)
		svcReferences := make([]*models.IstioValidationKey, 0)
		for _, vs := range svcVirtualServices {
			ref := models.BuildKey(vs.Kind, vs.Name, vs.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		for _, vs := range svcDestinationRules {
			ref := models.BuildKey(vs.Kind, vs.Name, vs.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		for _, gw := range svcGateways {
			ref := models.BuildKey(gw.Kind, gw.Name, gw.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		svcReferences = FilterUniqueIstioReferences(svcReferences)

		kialiWizard := getVSKialiScenario(svcVirtualServices)
		if kialiWizard == "" {
			kialiWizard = getDRKialiScenario(svcDestinationRules)
		}

		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector[conf.IstioLabels.AppLabelName]
		/** Check if Service has additional item icon */
		services[i] = models.ServiceOverview{
			Name:                   item.Name,
			Namespace:              item.Namespace,
			IstioSidecar:           hasSidecar,
			AppLabel:               appLabel,
			AdditionalDetailSample: models.GetFirstAdditionalIcon(conf, item.ObjectMeta.Annotations),
			HealthAnnotations:      models.GetHealthAnnotation(item.Annotations, models.GetHealthConfigAnnotation()),
			Labels:                 item.Labels,
			Selector:               item.Spec.Selector,
			IstioReferences:        svcReferences,
			KialiWizard:            kialiWizard,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services, Validations: validations}
}

// GetService returns a single service and associated data using the interval and queryTime
func (in *SvcService) GetService(namespace, service, interval string, queryTime time.Time) (*models.ServiceDetails, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	svc, eps, err := in.getServiceDefinition(namespace, service)
	if err != nil {
		return nil, err
	}

	var pods []core_v1.Pod
	var hth models.ServiceHealth
	var vs []networking_v1alpha3.VirtualService
	var dr []networking_v1alpha3.DestinationRule
	var ws models.Workloads
	var nsmtls models.MTLSStatus

	conf := config.Get()
	additionalDetails := models.GetAdditionalDetails(conf, svc.ObjectMeta.Annotations)

	wg := sync.WaitGroup{}
	wg.Add(5)
	errChan := make(chan error, 5)

	ctx := context.TODO()
	listOpts := meta_v1.ListOptions{}

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
			vs, err2 = kialiCache.GetVirtualServices(namespace, "")
		} else {
			vsl, e := in.k8s.Istio().NetworkingV1alpha3().VirtualServices(namespace).List(ctx, listOpts)
			vs = vsl.Items
			err2 = e
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
			dr, err2 = kialiCache.GetDestinationRules(namespace, "")
		} else {
			drl, e := in.k8s.Istio().NetworkingV1alpha3().DestinationRules(namespace).List(ctx, listOpts)
			dr = drl.Items
			err2 = e
		}
		if err2 != nil {
			errChan <- err2
		} else {
			dr = kubernetes.FilterDestinationRules(dr, namespace, service)
		}
	}()

	var vsCreate, vsUpdate, vsDelete bool
	go func() {
		defer wg.Done()
		/*
			We can safely assume that permissions for VirtualServices will be similar as DestinationRules.

			Synced with:
			https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
		*/
		vsCreate, vsUpdate, vsDelete = getPermissions(in.k8s, namespace, kubernetes.VirtualServices)
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
	s.SetIstioSidecar(wo)
	s.SetEndpoints(eps)
	s.IstioPermissions = models.ResourcePermissions{
		Create: vsCreate,
		Update: vsUpdate,
		Delete: vsDelete,
	}
	s.VirtualServices = vs
	s.DestinationRules = dr
	return &s, nil
}

func (in *SvcService) UpdateService(namespace, service string, interval string, queryTime time.Time, jsonPatch string) (*models.ServiceDetails, error) {
	// Identify controller and apply patch to workload
	err := updateService(in.businessLayer, namespace, service, jsonPatch)
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
