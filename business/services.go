package business

import (
	"context"
	"fmt"
	"sync"
	"time"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	config        config.Config
	kialiCache    cache.KialiCache
	businessLayer *Layer
	prom          prometheus.ClientInterface
	userClients   map[string]kubernetes.ClientInterface
}

type ServiceCriteria struct {
	Cluster                string
	Namespace              string
	IncludeHealth          bool
	IncludeIstioResources  bool
	IncludeOnlyDefinitions bool
	ServiceSelector        string
	RateInterval           string
	QueryTime              time.Time
}

// GetServiceList returns a list of all services for a given criteria
func (in *SvcService) GetServiceList(ctx context.Context, criteria ServiceCriteria) (*models.ServiceList, error) {
	var end observability.EndFunc
	conf := config.Get()

	ctx, end = observability.StartSpan(ctx, "GetServiceList",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("includeHealth", criteria.IncludeHealth),
		observability.Attribute("includeIstioResources", criteria.IncludeIstioResources),
		observability.Attribute("includeOnlyDefinitions", criteria.IncludeOnlyDefinitions),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	serviceList := models.ServiceList{
		Services:    []models.ServiceOverview{},
		Validations: models.IstioValidations{},
	}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	for cluster := range in.userClients {
		if criteria.Cluster != "" && cluster != criteria.Cluster {
			continue
		}

		if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, criteria.Namespace, cluster); err != nil {
			// We want to throw an error if we're single vs. multi cluster to be backward compatible
			// TODO: Probably need this in a few other places as well. It'd be nice to have a
			// centralized check for this in the config instead of this hacky one.
			if len(in.userClients) == 1 {
				return nil, err
			}

			if errors.IsNotFound(err) || errors.IsForbidden(err) {
				// If a cluster is not found or not accessible, then we skip it
				log.Debugf("Error while accessing to cluster [%s]: %s", cluster, err.Error())
				continue
			}

			// On any other error, abort and return the error.
			return nil, err
		}

		singleClusterSVCList, err := in.getServiceListForCluster(ctx, criteria, cluster)
		if err != nil {
			if cluster == conf.KubernetesConfig.ClusterName {
				return nil, err
			}

			log.Errorf("Unable to get services list from cluster: %s. Err: %s. Skipping", cluster, err)
			continue
		}

		serviceList.Services = append(serviceList.Services, singleClusterSVCList.Services...)
		serviceList.Namespace = singleClusterSVCList.Namespace
		serviceList.Validations = serviceList.Validations.MergeValidations(singleClusterSVCList.Validations)
	}

	return &serviceList, nil
}

func (in *SvcService) getServiceListForCluster(ctx context.Context, criteria ServiceCriteria, cluster string) (*models.ServiceList, error) {
	var (
		svcs            []core_v1.Service
		rSvcs           []*kubernetes.RegistryService
		pods            []core_v1.Pod
		deployments     []apps_v1.Deployment
		istioConfigList models.IstioConfigList
		err             error
		kubeCache       cache.KubeCache
	)

	kubeCache, err = in.kialiCache.GetKubeCache(cluster)
	if err != nil {
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
		svcs, err2 = kubeCache.GetServicesBySelectorLabels(criteria.Namespace, selectorLabels)
		if err2 != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", criteria.Namespace, err2)
			errChan <- err2
		}
	}()

	if in.config.ExternalServices.Istio.IstioAPIEnabled && cluster == in.config.KubernetesConfig.ClusterName {
		registryCriteria := RegistryCriteria{
			Namespace:       criteria.Namespace,
			ServiceSelector: criteria.ServiceSelector,
			Cluster:         cluster,
		}
		rSvcs = in.businessLayer.RegistryStatus.GetRegistryServices(registryCriteria)
	}

	go func() {
		defer wg.Done()
		var err2 error
		if !criteria.IncludeOnlyDefinitions {
			pods, err2 = kubeCache.GetPods(criteria.Namespace, "")
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
			deployments, err2 = kubeCache.GetDeployments(criteria.Namespace)
			if err2 != nil {
				log.Errorf("Error fetching Deployments per namespace %s: %s", criteria.Namespace, err2)
				errChan <- err2
			}
		}
	}()

	// Cross-namespace query of all Istio Resources to find references
	// References MAY have visibility for a user but not access if they are not allowed to access to the namespace
	if criteria.IncludeIstioResources {
		criteria := IstioConfigCriteria{
			AllNamespaces:             true,
			Cluster:                   cluster,
			Namespace:                 criteria.Namespace,
			IncludeDestinationRules:   true,
			IncludeGateways:           true,
			IncludeK8sGateways:        true,
			IncludeK8sHTTPRoutes:      true,
			IncludeK8sReferenceGrants: true,
			IncludeServiceEntries:     true,
			IncludeVirtualServices:    true,
		}
		go func() {
			defer wg.Done()
			var err2 error
			istioConfigList, err2 = in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
			if err2 != nil {
				log.Errorf("Error fetching IstioConfigList per cluster %s per namespace %s: %s", cluster, criteria.Namespace, err2)
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
	services := in.buildServiceList(cluster, models.Namespace{Name: criteria.Namespace}, svcs, rSvcs, pods, deployments, istioConfigList, criteria)

	// Check if we need to add health

	if criteria.IncludeHealth {
		for i, sv := range services.Services {
			// TODO: Fix health for multi-cluster
			services.Services[i].Health, err = in.businessLayer.Health.GetServiceHealth(ctx, criteria.Namespace, sv.Cluster, sv.Name, criteria.RateInterval, criteria.QueryTime, sv.ParseToService())
			if err != nil {
				log.Errorf("Error fetching health per service %s: %s", sv.Name, err)
			}
		}
	}

	return services, nil
}

func getVSKialiScenario(vs []*networking_v1beta1.VirtualService) string {
	scenario := ""
	for _, v := range vs {
		if scenario, ok := v.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func getDRKialiScenario(dr []*networking_v1beta1.DestinationRule) string {
	scenario := ""
	for _, d := range dr {
		if scenario, ok := d.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func (in *SvcService) buildServiceList(cluster string, namespace models.Namespace, svcs []core_v1.Service, rSvcs []*kubernetes.RegistryService, pods []core_v1.Pod, deployments []apps_v1.Deployment, istioConfigList models.IstioConfigList, criteria ServiceCriteria) *models.ServiceList {
	services := []models.ServiceOverview{}
	validations := models.IstioValidations{}
	if !criteria.IncludeOnlyDefinitions {
		validations = in.getServiceValidations(svcs, deployments, pods)
	}

	kubernetesServices := in.buildKubernetesServices(svcs, pods, istioConfigList, criteria.IncludeOnlyDefinitions)
	services = append(services, kubernetesServices...)
	// Add cluster to each kube service
	for i := range services {
		services[i].Cluster = cluster
	}

	// Add Istio Registry Services that are not present in the Kubernetes list
	// TODO: Registry services are not associated to a cluster. They can have multiple clusters under
	// "clusterVIPs". We need to decide how to handle this.
	rSvcs = kubernetes.FilterRegistryServicesByServices(rSvcs, svcs)
	registryServices := in.buildRegistryServices(rSvcs, istioConfigList)
	services = append(services, registryServices...)
	return &models.ServiceList{Namespace: namespace, Services: services, Validations: validations}
}

func (in *SvcService) buildKubernetesServices(svcs []core_v1.Service, pods []core_v1.Pod, istioConfigList models.IstioConfigList, onlyDefinitions bool) []models.ServiceOverview {
	services := make([]models.ServiceOverview, len(svcs))
	conf := in.config

	// Convert each k8sClients service into our model
	for i, item := range svcs {
		var kialiWizard string
		hasSidecar := true
		hasAmbient := false
		svcReferences := make([]*models.IstioValidationKey, 0)

		if !onlyDefinitions {
			sPods := kubernetes.FilterPodsByService(&item, pods)
			/** Check if Service has istioSidecar deployed */
			mPods := models.Pods{}
			mPods.Parse(sPods)
			hasSidecar = mPods.HasAnyIstioSidecar()
			hasAmbient = mPods.HasAnyAmbient()
			svcVirtualServices := kubernetes.FilterAutogeneratedVirtualServices(kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, item.Namespace, item.Name))
			svcDestinationRules := kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, item.Namespace, item.Name)
			svcGateways := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, svcVirtualServices)
			svcK8sHTTPRoutes := kubernetes.FilterK8sHTTPRoutesByService(istioConfigList.K8sHTTPRoutes, istioConfigList.K8sReferenceGrants, item.Namespace, item.Name)
			svcK8sGateways := kubernetes.FilterK8sGatewaysByHTTPRoutes(istioConfigList.K8sGateways, svcK8sHTTPRoutes)

			for _, vs := range svcVirtualServices {
				ref := models.BuildKey(vs.Kind, vs.Name, vs.Namespace)
				svcReferences = append(svcReferences, &ref)
			}
			for _, dr := range svcDestinationRules {
				ref := models.BuildKey(dr.Kind, dr.Name, dr.Namespace)
				svcReferences = append(svcReferences, &ref)
			}
			for _, gw := range svcGateways {
				ref := models.BuildKey(gw.Kind, gw.Name, gw.Namespace)
				svcReferences = append(svcReferences, &ref)
			}
			for _, gw := range svcK8sGateways {
				// Should be K8s type to generate correct link
				ref := models.BuildKey(kubernetes.K8sGatewayType, gw.Name, gw.Namespace)
				svcReferences = append(svcReferences, &ref)
			}
			for _, route := range svcK8sHTTPRoutes {
				// Should be K8s type to generate correct link
				ref := models.BuildKey(kubernetes.K8sHTTPRouteType, route.Name, route.Namespace)
				svcReferences = append(svcReferences, &ref)
			}
			svcReferences = FilterUniqueIstioReferences(svcReferences)
			kialiWizard = getVSKialiScenario(svcVirtualServices)
			if kialiWizard == "" {
				kialiWizard = getDRKialiScenario(svcDestinationRules)
			}
		}

		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector[conf.IstioLabels.AppLabelName]
		/** Check if Service has additional item icon */
		services[i] = models.ServiceOverview{
			Name:                   item.Name,
			Namespace:              item.Namespace,
			IstioSidecar:           hasSidecar,
			IstioAmbient:           hasAmbient,
			AppLabel:               appLabel,
			AdditionalDetailSample: models.GetFirstAdditionalIcon(&conf, item.ObjectMeta.Annotations),
			Health:                 models.EmptyServiceHealth(),
			HealthAnnotations:      models.GetHealthAnnotation(item.Annotations, models.GetHealthConfigAnnotation()),
			Labels:                 item.Labels,
			Selector:               item.Spec.Selector,
			IstioReferences:        svcReferences,
			KialiWizard:            kialiWizard,
			ServiceRegistry:        "Kubernetes",
		}
	}
	return services
}

func filterIstioServiceByClusterId(clusterId string, item *kubernetes.RegistryService) bool {
	if clusterId == "Kubernetes" {
		return true
	}
	// External and Federation services are always local to the control plane
	if item.Attributes.ServiceRegistry != "Kubernetes" {
		return true
	}
	if _, ok := item.ClusterVIPs12.Addresses[clusterId]; ok {
		return true
	}
	if _, ok := item.ClusterVIPs11[clusterId]; ok {
		return true
	}
	return false
}

func (in *SvcService) buildRegistryServices(rSvcs []*kubernetes.RegistryService, istioConfigList models.IstioConfigList) []models.ServiceOverview {
	services := []models.ServiceOverview{}
	conf := in.config

	// The istiod registry doesn't have a explicit flag when a service is deployed in a different control plane.
	// The only way to identify it is to check that the service has an address in the current cluster.
	// To avoid side effects, Kiali will process only services that belongs to the current cluster.
	// This should be revisited on more multi-cluster deployments scenarios.
	//
	//	{
	//		"hostname": "test-svc.evil.svc.cluster.local",
	//		"clusterVIPs": {
	//			"Addresses": {
	//				"istio-west": [
	//					"0.0.0.0"
	//				]
	//			}
	//	}
	// By default Istio uses "Kubernetes" as clusterId for single control planes scenarios.
	// This clusterId is propagated into the Istio Registry and we need it to filter services in multi-cluster scenarios.
	// I.e.:
	//    "clusterVIPs": {
	//      "Addresses": {
	//        "Kubernetes": [
	//          "10.217.4.189"
	//        ]
	//      }
	//    }
	clusterId := conf.KubernetesConfig.ClusterName
	for _, item := range rSvcs {
		if !filterIstioServiceByClusterId(clusterId, item) {
			continue
		}
		_, appLabel := item.Attributes.LabelSelectors[conf.IstioLabels.AppLabelName]
		// ServiceEntry/External and Federation will be marked as hasSidecar == true as they will have telemetry
		hasSidecar := true
		if item.Attributes.ServiceRegistry != "External" && item.Attributes.ServiceRegistry != "Federation" {
			hasSidecar = false
		}
		// TODO wildcards may force additional checks on hostnames ?
		svcServiceEntries := kubernetes.FilterServiceEntriesByHostname(istioConfigList.ServiceEntries, item.Hostname)
		svcDestinationRules := kubernetes.FilterDestinationRulesByHostname(istioConfigList.DestinationRules, item.Hostname)
		svcVirtualServices := kubernetes.FilterVirtualServicesByHostname(istioConfigList.VirtualServices, item.Hostname)
		svcGateways := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, svcVirtualServices)
		svcReferences := make([]*models.IstioValidationKey, 0)
		for _, se := range svcServiceEntries {
			ref := models.BuildKey(se.Kind, se.Name, se.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		for _, vs := range svcVirtualServices {
			ref := models.BuildKey(vs.Kind, vs.Name, vs.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		for _, dr := range svcDestinationRules {
			ref := models.BuildKey(dr.Kind, dr.Name, dr.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		for _, gw := range svcGateways {
			ref := models.BuildKey(gw.Kind, gw.Name, gw.Namespace)
			svcReferences = append(svcReferences, &ref)
		}
		svcReferences = FilterUniqueIstioReferences(svcReferences)
		// External Istio registries may have references to ServiceEntry and/or Federation
		service := models.ServiceOverview{
			Name:              item.Attributes.Name,
			Namespace:         item.Attributes.Namespace,
			IstioSidecar:      hasSidecar,
			AppLabel:          appLabel,
			Health:            models.EmptyServiceHealth(),
			HealthAnnotations: map[string]string{},
			Labels:            item.Attributes.Labels,
			Selector:          item.Attributes.LabelSelectors,
			IstioReferences:   svcReferences,
			ServiceRegistry:   item.Attributes.ServiceRegistry,
		}
		services = append(services, service)
	}
	return services
}

// GetService returns a single service and associated data using the interval and queryTime
func (in *SvcService) GetServiceDetails(ctx context.Context, cluster, namespace, service, interval string, queryTime time.Time) (*models.ServiceDetails, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceDetails",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("interval", interval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	svc, err := in.GetService(ctx, cluster, namespace, service)
	if err != nil {
		return nil, err
	}

	var eps *core_v1.Endpoints
	var pods []core_v1.Pod
	var hth models.ServiceHealth
	var istioConfigList models.IstioConfigList
	var ws models.Workloads
	var rSvcs []*kubernetes.RegistryService
	var nsmtls models.MTLSStatus

	wg := sync.WaitGroup{}
	// Max possible number of errors. It's ok if the buffer size exceeds the number of goroutines
	// in cases where istio api is disabled.
	errChan := make(chan error, 8)

	labelsSelector := labels.Set(svc.Selectors).String()
	// If service doesn't have any selector, we can't know which are the pods and workloads applying.
	if labelsSelector != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var err2 error
			pods, err2 = in.kialiCache.GetPods(namespace, labelsSelector)
			if err2 != nil {
				errChan <- err2
			}
		}()

		wg.Add(1)
		go func(ctx context.Context) {
			defer wg.Done()
			var err2 error
			ws, err2 = in.businessLayer.Workload.fetchWorkloadsFromCluster(ctx, cluster, namespace, labelsSelector)
			if err2 != nil {
				log.Errorf("Error fetching Workloads per namespace %s and service %s: %s", namespace, service, err2)
				errChan <- err2
			}
		}(ctx)

		if in.config.ExternalServices.Istio.IstioAPIEnabled {
			registryCriteria := RegistryCriteria{
				Namespace: namespace,
				Cluster:   cluster,
			}
			rSvcs = in.businessLayer.RegistryStatus.GetRegistryServices(registryCriteria)
		}
	}

	wg.Add(1)
	go func(ctx context.Context) {
		defer wg.Done()
		var err2 error
		eps, err2 = in.kialiCache.GetEndpoints(namespace, service)
		if err2 != nil && !errors.IsNotFound(err2) {
			log.Errorf("Error fetching Endpoints namespace %s and service %s: %s", namespace, service, err2)
			errChan <- err2
		}
	}(ctx)

	wg.Add(1)
	go func(ctx context.Context) {
		defer wg.Done()
		var err2 error
		// TODO: Fix health for multi-cluster
		hth, err2 = in.businessLayer.Health.GetServiceHealth(ctx, namespace, cluster, service, interval, queryTime, &svc)
		if err2 != nil {
			errChan <- err2
		}
	}(ctx)

	wg.Add(1)
	go func(ctx context.Context) {
		defer wg.Done()
		var err2 error
		nsmtls, err2 = in.businessLayer.TLS.NamespaceWidemTLSStatus(ctx, namespace, cluster)
		if err2 != nil {
			errChan <- err2
		}
	}(ctx)

	wg.Add(1)
	go func(ctx context.Context) {
		defer wg.Done()
		var err2 error
		criteria := IstioConfigCriteria{
			AllNamespaces:           true,
			Cluster:                 cluster,
			Namespace:               namespace,
			IncludeDestinationRules: true,
			// TODO the frontend is merging the Gateways per ServiceDetails but it would be a clean design to locate it here
			IncludeGateways:           true,
			IncludeK8sGateways:        true,
			IncludeK8sHTTPRoutes:      true,
			IncludeK8sReferenceGrants: true,
			IncludeServiceEntries:     true,
			IncludeVirtualServices:    true,
		}
		istioConfigList, err2 = in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
		if err2 != nil {
			log.Errorf("Error fetching IstioConfigList per namespace %s: %s", criteria.Namespace, err2)
			errChan <- err2
		}
	}(ctx)

	var vsCreate, vsUpdate, vsDelete bool
	wg.Add(1)
	go func() {
		defer wg.Done()
		/*
			We can safely assume that permissions for VirtualServices will be similar as DestinationRules.

			Synced with:
			https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
		*/
		userClient, found := in.userClients[cluster]
		if !found {
			errChan <- fmt.Errorf("client not found for cluster: %s", cluster)
			return
		}
		vsCreate, vsUpdate, vsDelete = getPermissions(context.TODO(), userClient, cluster, namespace, kubernetes.VirtualServices)
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

	serviceOverviews := make([]*models.ServiceOverview, 0)
	// Convert filtered k8sClients services into ServiceOverview, only several attributes are needed
	for _, item := range rSvcs {
		// app label selector of services should match, loading all versions
		if selector, err3 := labels.ConvertSelectorToLabelsMap(labelsSelector); err3 == nil {
			if appSelector, ok := item.Attributes.LabelSelectors["app"]; ok && selector.Has("app") && appSelector == selector.Get("app") {
				if _, ok1 := item.Attributes.LabelSelectors["version"]; ok1 {
					ports := map[string]int{}
					for _, port := range item.Ports {
						ports[port.Name] = port.Port
					}
					serviceOverviews = append(serviceOverviews, &models.ServiceOverview{
						Name:  item.Attributes.Name,
						Ports: ports,
					})
				}
			}
		}
	}
	// loading the single service if no versions
	if len(serviceOverviews) == 0 {
		ports := map[string]int{}
		for _, port := range svc.Ports {
			ports[port.Name] = int(port.Port)
		}
		serviceOverviews = append(serviceOverviews, &models.ServiceOverview{
			Name:  svc.Name,
			Ports: ports,
		})
	}

	s := models.ServiceDetails{Workloads: wo, Health: hth, NamespaceMTLS: nsmtls, SubServices: serviceOverviews}
	s.Service = svc
	s.SetPods(kubernetes.FilterPodsByEndpoints(eps, pods))
	// ServiceDetail will consider if the Service is a External/Federation entry
	if s.Service.Type == "External" || s.Service.Type == "Federation" {
		s.IstioSidecar = true
	} else {
		s.SetIstioSidecar(wo)
	}
	s.SetEndpoints(eps)
	s.IstioPermissions = models.ResourcePermissions{
		Create: vsCreate,
		Update: vsUpdate,
		Delete: vsDelete,
	}
	s.VirtualServices = kubernetes.FilterAutogeneratedVirtualServices(kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, namespace, service))
	s.DestinationRules = kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, namespace, service)
	s.K8sHTTPRoutes = kubernetes.FilterK8sHTTPRoutesByService(istioConfigList.K8sHTTPRoutes, istioConfigList.K8sReferenceGrants, namespace, service)
	if s.Service.Type == "External" || s.Service.Type == "Federation" {
		// On ServiceEntries cases the Service name is the hostname
		s.ServiceEntries = kubernetes.FilterServiceEntriesByHostname(istioConfigList.ServiceEntries, s.Service.Name)
	}
	s.Cluster = cluster

	return &s, nil
}

func (in *SvcService) UpdateService(ctx context.Context, cluster, namespace, service string, interval string, queryTime time.Time, jsonPatch string, patchType string) (*models.ServiceDetails, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateService",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("interval", interval),
		observability.Attribute("queryTime", queryTime),
		observability.Attribute("jsonPatch", jsonPatch),
		observability.Attribute("patchType", patchType),
	)
	defer end()

	// Identify controller and apply patch to workload
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(context.TODO(), namespace, cluster); err != nil {
		return nil, err
	}

	userClient, found := in.userClients[cluster]
	if !found {
		return nil, fmt.Errorf("cluster: %s not found", cluster)
	}

	if err := userClient.UpdateService(namespace, service, jsonPatch, patchType); err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	in.kialiCache.Refresh(namespace)

	// After the update we fetch the whole workload
	return in.GetServiceDetails(ctx, cluster, namespace, service, interval, queryTime)
}

func (in *SvcService) GetService(ctx context.Context, cluster, namespace, service string) (models.Service, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetService",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
	)
	defer end()

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return models.Service{}, err
	}

	cache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return models.Service{}, err
	}

	svc := models.Service{}
	// First try to get the service from kube.
	// If it doesn't exist, try to get it from the Istio Registry.
	kSvc, err := cache.GetService(namespace, service)
	if err != nil {
		// Check if this service is in the Istio Registry
		criteria := RegistryCriteria{
			Namespace: namespace,
			Cluster:   cluster,
		}
		rSvcs := in.businessLayer.RegistryStatus.GetRegistryServices(criteria)
		for _, rSvc := range rSvcs {
			if rSvc.Attributes.Name == service {
				svc.ParseRegistryService(rSvc)
				break
			}
		}
		// Service not found in Kubernetes and Istio
		if svc.Name == "" {
			return svc, kubernetes.NewNotFound(service, "Kiali", "Service")
		}
	} else {
		svc.Parse(kSvc)
	}

	return svc, nil
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
func (in *SvcService) GetServiceAppName(ctx context.Context, cluster, namespace, service string) (string, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceAppName",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
	)
	defer end()

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return "", err
	}

	svc, err := in.GetService(ctx, cluster, namespace, service)
	if err != nil {
		return "", fmt.Errorf("Service [cluster: %s] [namespace: %s] [name: %s] doesn't exist.", cluster, namespace, service)
	}

	appLabelName := in.config.IstioLabels.AppLabelName
	app := svc.Selectors[appLabelName]
	return app, nil
}
