package business

import (
	"context"
	"fmt"
	"sync"
	"time"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util/sliceutil"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	conf          *config.Config
	kialiCache    cache.KialiCache
	businessLayer *Layer
	prom          prometheus.ClientInterface
	userClients   map[string]kubernetes.UserClientInterface
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

	ctx, end = observability.StartSpan(ctx, "GetServiceList",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, criteria.Cluster),
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
			if cluster == in.conf.KubernetesConfig.ClusterName {
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

func (in *SvcService) GetServiceListForCluster(ctx context.Context, criteria ServiceCriteria, cluster string) (*models.ServiceList, error) {
	svcs, err := in.getServiceListForCluster(ctx, criteria, cluster)
	if err != nil {
		return nil, err
	}

	// Filter out services that are not in accessible namespaces since it's valid to pass `""` for the namespace
	// which means list across all namespaces.
	accessibleNamespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return nil, err
	}

	namespaceSet := make(map[string]struct{})
	for _, ns := range accessibleNamespaces {
		namespaceSet[ns.Name] = struct{}{}
	}

	sliceutil.Filter(svcs.Services, func(svc models.ServiceOverview) bool {
		_, ok := namespaceSet[svc.Namespace]
		return ok
	})

	return svcs, nil
}

func (in *SvcService) getServiceListForCluster(ctx context.Context, criteria ServiceCriteria, cluster string) (*models.ServiceList, error) {
	var (
		svcs            []core_v1.Service
		pods            []core_v1.Pod
		deployments     []apps_v1.Deployment
		istioConfigList models.IstioConfigList
		err             error
		kubeCache       client.Reader
	)

	kubeCache, err = in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return nil, err
	}

	var selectorLabels map[string]string
	if criteria.ServiceSelector != "" {
		if selector, err := labels.ConvertSelectorToLabelsMap(criteria.ServiceSelector); err == nil {
			selectorLabels = selector
		} else {
			log.Warningf("Services not filtered. Selector %s not valid", criteria.ServiceSelector)
		}
	}

	svcList := &core_v1.ServiceList{}
	if err := kubeCache.List(ctx, svcList, client.InNamespace(criteria.Namespace)); err != nil {
		return nil, fmt.Errorf("Error fetching Services per namespace %s: %s", criteria.Namespace, err)
	}
	svcs = kubernetes.FilterServicesBySelector(svcList.Items, selectorLabels)

	if !criteria.IncludeOnlyDefinitions {
		podList := &core_v1.PodList{}
		if err := kubeCache.List(ctx, podList, client.InNamespace(criteria.Namespace)); err != nil {
			return nil, fmt.Errorf("Error fetching Pods per namespace %s: %s", criteria.Namespace, err)
		}
		pods = podList.Items
	}

	if !criteria.IncludeOnlyDefinitions {
		depList := &apps_v1.DeploymentList{}
		if err := kubeCache.List(ctx, depList, client.InNamespace(criteria.Namespace)); err != nil {
			return nil, fmt.Errorf("Error fetching Deployments per namespace %s: %s", criteria.Namespace, err)
		}
		deployments = depList.Items
	}

	// ServiceEntries are always fetched because buildServiceEntryOverviews needs
	// them to produce SE-backed services (replacing the old Istio Service Registry).
	// The remaining Istio resources are only needed for building references/badges.
	istioCriteria := IstioConfigCriteria{
		IncludeServiceEntries: true,
	}
	if criteria.IncludeIstioResources {
		istioCriteria.IncludeDestinationRules = true
		istioCriteria.IncludeGateways = true
		istioCriteria.IncludeK8sGateways = true
		istioCriteria.IncludeK8sGRPCRoutes = true
		istioCriteria.IncludeK8sHTTPRoutes = true
		istioCriteria.IncludeK8sInferencePools = true
		istioCriteria.IncludeK8sReferenceGrants = true
		istioCriteria.IncludeVirtualServices = true
	}
	istioConfigs, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, istioCriteria)
	if err != nil {
		log.Errorf("Error fetching IstioConfigList per cluster [%s] per namespace [%s]: %s", cluster, criteria.Namespace, err)
		return nil, err
	}
	istioConfigList = *istioConfigs

	// Convert to Kiali model
	services := in.buildServiceList(cluster, criteria.Namespace, svcs, pods, deployments, istioConfigList, criteria)

	// Check if we need to add health

	if criteria.IncludeHealth {
		// Try to get cached health for this namespace
		cachedHealth, _ := in.kialiCache.GetHealth(cluster, criteria.Namespace, internalmetrics.HealthTypeService)

		for i, sv := range services.Services {
			// Try cache first, fall back to on-demand calculation
			if cachedHealth != nil {
				if health, found := cachedHealth.ServiceHealth[sv.Name]; found {
					services.Services[i].Health = *health
					continue
				}
			}
			// Cache miss - compute on-demand (also updates cache)
			if cachedHealth != nil {
				log.Debugf("Service health cache miss for cluster=%s namespace=%s service=%s", cluster, criteria.Namespace, sv.Name)
			} else {
				log.Debugf("Service health cache miss (no namespace data) for cluster=%s namespace=%s service=%s", cluster, criteria.Namespace, sv.Name)
			}
			services.Services[i].Health, err = in.businessLayer.Health.GetServiceHealth(ctx, criteria.Namespace, sv.Cluster, sv.Name, criteria.RateInterval, criteria.QueryTime, sv.ParseToService())
			if err != nil {
				log.Errorf("Error fetching health per service %s: %s", sv.Name, err)
			}
		}
	}

	return services, nil
}

func getVSKialiScenario(vs []*networking_v1.VirtualService) string {
	scenario := ""
	for _, v := range vs {
		if scenario, ok := v.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func getDRKialiScenario(dr []*networking_v1.DestinationRule) string {
	scenario := ""
	for _, d := range dr {
		if scenario, ok := d.Labels["kiali_wizard"]; ok {
			return scenario
		}
	}
	return scenario
}

func (in *SvcService) buildServiceList(cluster string, namespace string, svcs []core_v1.Service, pods []core_v1.Pod, deployments []apps_v1.Deployment, istioConfigList models.IstioConfigList, criteria ServiceCriteria) *models.ServiceList {
	services := []models.ServiceOverview{}
	validations := models.IstioValidations{}
	if !criteria.IncludeOnlyDefinitions {
		validations = in.getServiceValidations(svcs, deployments, pods)
	}

	kubernetesServices := in.buildKubernetesServices(svcs, pods, istioConfigList, criteria.IncludeOnlyDefinitions, cluster)
	services = append(services, kubernetesServices...)
	for i := range services {
		services[i].Cluster = cluster
	}

	// Add ServiceEntry-backed services that have no corresponding K8s Service
	seServices := in.buildServiceEntryOverviews(istioConfigList.ServiceEntries, svcs, namespace, istioConfigList, cluster)
	services = append(services, seServices...)
	return &models.ServiceList{Namespace: namespace, Services: services, Validations: validations}
}

func (in *SvcService) buildKubernetesServices(svcs []core_v1.Service, pods []core_v1.Pod, istioConfigList models.IstioConfigList, onlyDefinitions bool, cluster string) []models.ServiceOverview {
	services := make([]models.ServiceOverview, len(svcs))

	// Convert each k8sClients service into our model
	for i, item := range svcs {
		var kialiWizard string
		hasSidecar := true
		hasAmbient := false
		svcReferences := make([]*models.IstioValidationKey, 0)

		if !onlyDefinitions {
			sPods := kubernetes.FilterPodsByService(&item, pods)
			/** Check if Service has istioSidecar deployed */
			// TODO: This won't work if pods are scaled to zero.
			mPods := models.Pods{}
			mPods.Parse(sPods, in.businessLayer.Mesh.IsControlPlane)
			hasSidecar = mPods.HasAnyIstioSidecar()
			hasAmbient = mPods.HasAnyAmbient()
			svcVirtualServices := kubernetes.FilterAutogeneratedVirtualServices(kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, item.Namespace, item.Name, in.conf))
			svcDestinationRules := kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, item.Namespace, item.Name, in.conf)
			svcGateways := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, svcVirtualServices)
			svcK8sGRPCRoutes := kubernetes.FilterK8sGRPCRoutesByService(istioConfigList.K8sGRPCRoutes, istioConfigList.K8sReferenceGrants, item.Namespace, item.Name, in.conf)
			svcK8sHTTPRoutes := kubernetes.FilterK8sHTTPRoutesByService(istioConfigList.K8sHTTPRoutes, istioConfigList.K8sReferenceGrants, item.Namespace, item.Name, in.conf)
			svcK8sGateways := append(kubernetes.FilterK8sGatewaysByRoutes(istioConfigList.K8sGateways, svcK8sHTTPRoutes, svcK8sGRPCRoutes), kubernetes.FilterK8sGatewaysByLabel(kubernetes.FilterByNamespaceNames(istioConfigList.K8sGateways, []string{item.Namespace}), item.Labels[in.conf.IstioLabels.AmbientWaypointGatewayLabel])...)
			svcK8sInferencePools := kubernetes.FilterK8sInferencePoolByService(istioConfigList.K8sInferencePools, item.Namespace, item.Name)

			for _, vs := range svcVirtualServices {
				ref := models.BuildKey(kubernetes.VirtualServices, vs.Name, vs.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, dr := range svcDestinationRules {
				ref := models.BuildKey(kubernetes.DestinationRules, dr.Name, dr.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, gw := range svcGateways {
				ref := models.BuildKey(kubernetes.Gateways, gw.Name, gw.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, gw := range svcK8sGateways {
				// Should be K8s type to generate correct link
				ref := models.BuildKey(kubernetes.K8sGateways, gw.Name, gw.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, route := range svcK8sGRPCRoutes {
				// Should be K8s type to generate correct link
				ref := models.BuildKey(kubernetes.K8sGRPCRoutes, route.Name, route.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, route := range svcK8sHTTPRoutes {
				// Should be K8s type to generate correct link
				ref := models.BuildKey(kubernetes.K8sHTTPRoutes, route.Name, route.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			for _, pool := range svcK8sInferencePools {
				ref := models.BuildKey(kubernetes.K8sInferencePools, pool.Name, pool.Namespace, cluster)
				svcReferences = append(svcReferences, &ref)
			}
			svcReferences = FilterUniqueIstioReferences(svcReferences)
			kialiWizard = getVSKialiScenario(svcVirtualServices)
			if kialiWizard == "" {
				kialiWizard = getDRKialiScenario(svcDestinationRules)
			}
		}

		/** Check if Service has the label app required by Istio */
		_, appLabelNameFound := in.conf.GetAppLabelName(item.Spec.Selector)

		/** Check if Service has additional item icon */
		services[i] = models.ServiceOverview{
			Name:                   item.Name,
			Namespace:              item.Namespace,
			IstioSidecar:           hasSidecar,
			IsAmbient:              hasAmbient,
			AppLabel:               appLabelNameFound,
			AdditionalDetailSample: models.GetFirstAdditionalIcon(in.conf, item.Annotations),
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

// buildServiceEntryOverviews converts ServiceEntry resources into ServiceOverview entries
// for the service list. Only SE hosts in the target namespace that don't overlap with an
// existing K8s Service (by name) are included.
//
// This replaces the old buildRegistryServices which consumed Istio's /debug/registryz
// endpoint. Because the Istio registry is no longer available, some fields are less rich:
//   - AppLabel is always false: the registry carried resolved label selectors that let us
//     check for an "app" label; ServiceEntry resources have no selector concept.
//   - Selector is always empty for the same reason.
//   - Labels come from the ServiceEntry object metadata rather than from Istio's internal
//     resolved view, so they may differ from what the registry previously reported.
func (in *SvcService) buildServiceEntryOverviews(serviceEntries []*networking_v1.ServiceEntry, existingServices []core_v1.Service, namespace string, istioConfigList models.IstioConfigList, cluster string) []models.ServiceOverview {
	services := []models.ServiceOverview{}
	existingSet := make(map[string]struct{}, len(existingServices))
	clusterNamespaces := make([]string, 0, len(existingServices))
	clusterNamespaceSet := make(map[string]struct{}, len(existingServices))
	for _, svc := range existingServices {
		if namespace != "" && svc.Namespace != namespace {
			continue
		}
		existingSet[fmt.Sprintf("%s/%s", svc.Namespace, svc.Name)] = struct{}{}
		if _, found := clusterNamespaceSet[svc.Namespace]; !found {
			clusterNamespaceSet[svc.Namespace] = struct{}{}
			clusterNamespaces = append(clusterNamespaces, svc.Namespace)
		}
	}

	addedHosts := make(map[string]struct{})
	for _, se := range serviceEntries {
		if namespace != "" && se.Namespace != namespace {
			continue
		}
		for _, hostname := range se.Spec.Hosts {
			host := kubernetes.GetHost(hostname, se.Namespace, clusterNamespaces, in.conf)
			dedupServiceName, dedupNamespace := kubernetes.ParseTwoPartHost(host)
			if dedupNamespace != "" && dedupServiceName != "" {
				if _, exists := existingSet[fmt.Sprintf("%s/%s", dedupNamespace, dedupServiceName)]; exists {
					continue
				}
			}

			addedHostKey := fmt.Sprintf("%s/%s", se.Namespace, hostname)
			if _, alreadyAdded := addedHosts[addedHostKey]; alreadyAdded {
				continue
			}
			addedHosts[addedHostKey] = struct{}{}

			svcServiceEntries := kubernetes.FilterServiceEntriesByHostname(istioConfigList.ServiceEntries, hostname)
			svcDestinationRules := kubernetes.FilterDestinationRulesByHostname(istioConfigList.DestinationRules, hostname)
			svcVirtualServices := kubernetes.FilterVirtualServicesByHostname(istioConfigList.VirtualServices, hostname)
			svcGateways := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, svcVirtualServices)

			svcReferences := make([]*models.IstioValidationKey, 0)
			for _, ref := range svcServiceEntries {
				key := models.BuildKey(kubernetes.ServiceEntries, ref.Name, ref.Namespace, cluster)
				svcReferences = append(svcReferences, &key)
			}
			for _, ref := range svcVirtualServices {
				key := models.BuildKey(kubernetes.VirtualServices, ref.Name, ref.Namespace, cluster)
				svcReferences = append(svcReferences, &key)
			}
			for _, ref := range svcDestinationRules {
				key := models.BuildKey(kubernetes.DestinationRules, ref.Name, ref.Namespace, cluster)
				svcReferences = append(svcReferences, &key)
			}
			for _, ref := range svcGateways {
				key := models.BuildKey(kubernetes.Gateways, ref.Name, ref.Namespace, cluster)
				svcReferences = append(svcReferences, &key)
			}
			svcReferences = FilterUniqueIstioReferences(svcReferences)

			services = append(services, models.ServiceOverview{
				Cluster:           cluster,
				Health:            models.EmptyServiceHealth(),
				HealthAnnotations: map[string]string{},
				IstioReferences:   svcReferences,
				IstioSidecar:      true,
				Labels:            se.Labels,
				Name:              hostname,
				Namespace:         se.Namespace,
				ServiceRegistry:   "External",
			})
		}
	}
	return services
}

// GetService returns a single service and associated data using the interval and queryTime
// includeValidations: Service specific validations outside the istio configs
func (in *SvcService) GetServiceDetails(ctx context.Context, cluster, namespace, service, interval string, queryTime time.Time, includeValidations bool) (*models.ServiceDetails, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceDetails",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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

	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return nil, err
	}

	var pods []core_v1.Pod
	var hth models.ServiceHealth
	var istioConfigList *models.IstioConfigList
	var ws models.Workloads
	var namespaceSvcs []core_v1.Service
	var nsmtls models.MTLSStatus

	wg := sync.WaitGroup{}
	// Max possible number of errors. It's ok if the buffer size exceeds the number of goroutines
	// in cases where istio api is disabled.
	errChan := make(chan error, 8)

	labelsSelector := labels.Set(svc.Selectors).String()
	// If service doesn't have any selector, we can't know which are the pods and workloads applying.
	if labelsSelector != "" {
		podList := &core_v1.PodList{}
		if err := kubeCache.List(ctx, podList, client.MatchingLabels(svc.Selectors), client.InNamespace(namespace)); err != nil {
			return nil, fmt.Errorf("Error fetching Pods per namespace %s: %s", namespace, err)
		}
		pods = podList.Items

		wg.Add(1)
		go func(ctx context.Context) {
			defer wg.Done()
			var err2 error
			ws, err2 = in.businessLayer.Workload.GetNamespaceWorkloads(ctx, cluster, namespace, labelsSelector)
			if err2 != nil {
				log.Errorf("Error fetching Workloads per namespace %s and service %s: %s", namespace, service, err2)
				errChan <- err2
			}
		}(ctx)

		nsSvcList := &core_v1.ServiceList{}
		if err := kubeCache.List(ctx, nsSvcList, client.InNamespace(namespace)); err == nil {
			namespaceSvcs = nsSvcList.Items
		}
	}

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
			IncludeDestinationRules: true,
			// TODO the frontend is merging the Gateways per ServiceDetails but it would be a clean design to locate it here
			IncludeGateways:           true,
			IncludeK8sGateways:        true,
			IncludeK8sGRPCRoutes:      true,
			IncludeK8sHTTPRoutes:      true,
			IncludeK8sInferencePools:  true,
			IncludeK8sReferenceGrants: true,
			IncludeServiceEntries:     true,
			IncludeVirtualServices:    true,
		}
		istioConfigList, err2 = in.businessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, cluster, namespace, criteria)
		if err2 != nil {
			log.Errorf("Error fetching IstioConfigList per namespace %s: %s", namespace, err2)
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
		vsCreate, vsUpdate, vsDelete = getPermissions(context.TODO(), userClient, cluster, namespace, kubernetes.VirtualServices, in.conf)
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	wo := models.WorkloadOverviews{}
	isAmbient := len(ws) > 0
	for _, w := range ws {
		wi := &models.WorkloadListItem{}
		wi.ParseWorkload(w, in.conf)
		wo = append(wo, wi)
		// The service is not marked as Ambient if any of the workloads is Ambient
		if !w.IsAmbient {
			isAmbient = false
		}
	}

	waypointWk := in.GetWaypointsForService(ctx, &svc)

	serviceOverviews := make([]*models.ServiceOverview, 0)
	appLabelName, appLabelNameFound := in.conf.GetAppLabelName(svc.Selectors)
	if appLabelNameFound {
		appLabelValue := svc.Selectors[appLabelName]
		for _, item := range namespaceSvcs {
			if selectorValue, ok := item.Spec.Selector[appLabelName]; ok && selectorValue == appLabelValue {
				if _, verLabelNameFound := in.conf.GetVersionLabelName(item.Spec.Selector); verLabelNameFound {
					ports := map[string]int{}
					for _, port := range item.Spec.Ports {
						ports[port.Name] = int(port.Port)
					}
					serviceOverviews = append(serviceOverviews, &models.ServiceOverview{
						Name:  item.Name,
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
	s.SetPods(pods, in.businessLayer.Mesh.IsControlPlane)
	s.Endpoints = *models.GetEndpointsFromPods(pods)
	if s.Service.Type == "External" {
		s.IstioSidecar = true
	} else {
		s.SetIstioSidecar(wo)
	}
	s.IstioPermissions = models.ResourcePermissions{
		Create: vsCreate,
		Update: vsUpdate,
		Delete: vsDelete,
	}
	s.VirtualServices = kubernetes.FilterAutogeneratedVirtualServices(kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, namespace, service, in.conf))
	s.DestinationRules = kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, namespace, service, in.conf)
	s.K8sHTTPRoutes = kubernetes.FilterK8sHTTPRoutesByService(istioConfigList.K8sHTTPRoutes, istioConfigList.K8sReferenceGrants, namespace, service, in.conf)
	s.K8sGRPCRoutes = kubernetes.FilterK8sGRPCRoutesByService(istioConfigList.K8sGRPCRoutes, istioConfigList.K8sReferenceGrants, namespace, service, in.conf)
	s.K8sInferencePools = kubernetes.FilterK8sInferencePoolByService(istioConfigList.K8sInferencePools, namespace, service)
	if s.Service.Type == "External" {
		s.ServiceEntries = kubernetes.FilterServiceEntriesByHostname(istioConfigList.ServiceEntries, s.Service.Name)
	}
	s.IsAmbient = isAmbient
	if s.IsAmbient && len(waypointWk) > 0 {
		s.WaypointWorkloads = waypointWk
	}

	if includeValidations {
		svcList := &core_v1.ServiceList{}
		if err := kubeCache.List(ctx, svcList, client.InNamespace(namespace)); err != nil {
			return nil, fmt.Errorf("Error fetching Services per namespace %s: %s", namespace, err)
		}
		svcs := kubernetes.FilterServicesBySelector(svcList.Items, svc.Labels)
		depList := &apps_v1.DeploymentList{}
		if err := kubeCache.List(ctx, depList, client.InNamespace(namespace)); err != nil {
			return nil, fmt.Errorf("Error fetching deployments per namespace %s: %s", namespace, err)
		}
		deployments := depList.Items
		s.Validations = in.getServiceValidations(svcs, deployments, pods)
	}
	return &s, nil
}

// getCapturingWaypoints returns waypoint references that capture the service. Only the active waypoint is returned unless <all>
// is true, in which case all capturing waypoints will be returned. If so, they are returned in order of priority, so [0]
// reflects the active waypoint, the others have been overriden.
func (in *SvcService) getCapturingWaypoints(svc *models.Service, all bool) ([]models.Waypoint, bool) {
	waypoints := make([]models.Waypoint, 0, 2)

	// the highest level of override is service level, if necessary
	// - note that workloads with no labels (and therefore no service selector) are not associated with a service
	waypointUse, waypointUseFound := svc.Labels[config.WaypointUseLabel]
	waypointUseNamespace, waypointUseNamespaceFound := svc.Labels[config.WaypointUseNamespaceLabel]
	if waypointUseFound {
		if waypointUse == config.WaypointNone {
			return waypoints, false
		}
		if !waypointUseNamespaceFound {
			waypointUseNamespace = svc.Namespace
		}
		waypoints = append(waypoints, models.Waypoint{Name: waypointUse, Type: "service", Namespace: waypointUseNamespace, Cluster: svc.Cluster})
		if !all {
			return waypoints, true
		}
	}

	// If we don't have a service override, look for a namespace-level waypoint
	if ns, nsFound := in.kialiCache.GetNamespace(svc.Cluster, in.userClients[svc.Cluster].GetToken(), svc.Namespace); nsFound {
		waypointUse, waypointUseFound = ns.Labels[config.WaypointUseLabel]
		waypointUseNamespace, waypointUseNamespaceFound = ns.Labels[config.WaypointUseNamespaceLabel]

		if waypointUseFound {
			if waypointUse == config.WaypointNone {
				return waypoints, false
			}
			if !waypointUseNamespaceFound {
				waypointUseNamespace = svc.Namespace
			}
			waypoints = append(waypoints, models.Waypoint{Name: waypointUse, Type: "namespace", Namespace: waypointUseNamespace, Cluster: svc.Cluster})
			if !all {
				return waypoints, true
			}
		}
	}

	return waypoints, len(waypoints) > 0
}

// GetWaypointsForService returns a list of waypoint workloads that captured traffic for a specific service
// It should be just one
func (in *SvcService) GetWaypointsForService(ctx context.Context, svc *models.Service) []models.WorkloadReferenceInfo {
	workloadsList := []models.WorkloadReferenceInfo{}
	workloadsMap := map[string]bool{} // Ensure unique

	if svc.Labels[config.WaypointUseLabel] == config.WaypointNone {
		return workloadsList
	}

	waypoints, found := in.getCapturingWaypoints(svc, false)
	if !found {
		return workloadsList
	}

	// then, get the waypoint workloads to filter out "forNone" waypoints
	for _, waypoint := range waypoints {
		waypointWorkload, err := in.businessLayer.Workload.GetWorkload(ctx, WorkloadCriteria{Cluster: svc.Cluster, Namespace: waypoint.Namespace, WorkloadName: waypoint.Name, WorkloadGVK: schema.GroupVersionKind{}, IncludeWaypoints: false})
		if err != nil {
			log.Debugf("GetWaypointsForService: Error fetching waypoint workload %s", err.Error())
			return nil
		}
		waypointFor, waypointForFound := waypointWorkload.Labels[config.WaypointFor]
		if !waypointForFound || waypointFor != config.WaypointForNone {
			key := fmt.Sprintf("%s_%s_%s", svc.Cluster, waypoint.Namespace, waypoint.Name)
			if waypointWorkload != nil && !workloadsMap[key] {
				workloadsList = append(workloadsList, models.WorkloadReferenceInfo{Name: waypoint.Name, Namespace: waypoint.Namespace, Cluster: waypoint.Cluster, Type: waypointWorkload.WaypointFor()})
				workloadsMap[key] = true
			}
		}
	}

	return workloadsList
}

// ListWaypointServices returns a list of services which traffic is handled by a specific waypoint
// It should return just one (If there are more, that might be a validation error)
func (in *SvcService) ListWaypointServices(ctx context.Context, name, namespace, cluster string) []models.ServiceReferenceInfo {
	var serviceInfoList []models.ServiceReferenceInfo
	// This is to verify there is no duplicated services
	servicesMap := make(map[string]bool)

	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		log.Infof("ListWaypointServices: error getting kube cache: %s", err.Error())
		return serviceInfoList
	}
	namespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err == nil {
		for _, ns := range namespaces {
			svcList := &core_v1.ServiceList{}
			if err := kubeCache.List(ctx, svcList, client.InNamespace(ns.Name), client.MatchingLabels(map[string]string{config.WaypointUseLabel: name})); err != nil {
				log.Infof("Error getting services %s", err.Error())
			} else {
				for _, service := range svcList.Items {
					key := fmt.Sprintf("%s_%s_%s", service.Name, service.Namespace, cluster)
					if !servicesMap[key] && (service.Namespace == namespace || service.Labels[config.WaypointUseNamespaceLabel] == namespace) {
						serviceInfoList = append(serviceInfoList, models.ServiceReferenceInfo{Name: service.Name, Namespace: service.Namespace, LabelType: "service", Cluster: cluster})
						servicesMap[key] = true
					}
				}
			}
		}
	}

	return serviceInfoList
}

func (in *SvcService) UpdateService(ctx context.Context, cluster, namespace, service string, interval string, queryTime time.Time, jsonPatch string, patchType string) (*models.ServiceDetails, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateService",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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

	svc, err := userClient.UpdateService(namespace, service, jsonPatch, patchType)
	if err != nil {
		return nil, err
	}

	in.waitForCacheUpdate(ctx, cluster, svc)

	// After the update we fetch the whole workload
	return in.GetServiceDetails(ctx, cluster, namespace, service, interval, queryTime, false)
}

func (in *SvcService) waitForCacheUpdate(ctx context.Context, cluster string, updatedService *core_v1.Service) {
	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		log.Errorf("Svc Service cannot get cache so cannot wait for object to update in cache. You may see stale data but the update was processed correctly. Error: %s", err)
		return
	}

	if err := kubernetes.WaitForObjectUpdateInCache(ctx, kubeCache, updatedService); err != nil {
		// It won't break anything if we return the object before it is updated in the cache.
		// We will just show stale data so just log an error here instead of failing.
		log.Errorf("Svc Service failed waiting for object to update in cache. You may see stale data but the update was processed correctly. Error: %s", err)
		return
	}
}

func (in *SvcService) GetService(ctx context.Context, cluster, namespace, service string) (models.Service, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetService",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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
	// If it doesn't exist, try to find it via ServiceEntry hostnames.
	kSvc := &core_v1.Service{}
	if err := cache.Get(ctx, client.ObjectKey{Name: service, Namespace: namespace}, kSvc); err != nil {
		istioCriteria := IstioConfigCriteria{
			IncludeServiceEntries: true,
		}
		istioConfigs, err2 := in.businessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, cluster, namespace, istioCriteria)
		if err2 == nil {
			for _, se := range istioConfigs.ServiceEntries {
				for _, host := range se.Spec.Hosts {
					if host == service {
						svc.ParseServiceEntryService(cluster, se, host)
						break
					}
				}
				if svc.Name != "" {
					break
				}
			}
		}
		if svc.Name == "" {
			return svc, kubernetes.NewNotFound(service, "Kiali", "Service")
		}
	} else {
		svc.Parse(cluster, kSvc, in.conf)
	}

	return svc, nil
}

func (in *SvcService) getServiceValidations(services []core_v1.Service, deployments []apps_v1.Deployment, pods []core_v1.Pod) models.IstioValidations {
	validations := checkers.NewServiceChecker("", deployments, in.businessLayer.Mesh.discovery, pods, services).Check()

	return validations
}

// GetServiceTracingName returns a struct with all the information needed for tracing lookup
// The "Application" name (app label) that relates to a service
// This label is taken from the service selector, which means it is assumed that pods are selected using that label
// If the application has any Waypoint, the information is included, as it will be the search name in the tracing backend
func (in *SvcService) GetServiceTracingName(ctx context.Context, cluster, namespace, service string) (models.TracingName, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetServiceTracingName",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
	)
	defer end()

	tracingName := models.TracingName{App: service, Lookup: service}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return tracingName, err
	}

	svc, err := in.GetService(ctx, cluster, namespace, service)
	if err != nil {
		return tracingName, fmt.Errorf("Service [cluster: %s] [namespace: %s] [name: %s] doesn't exist", cluster, namespace, service)
	}

	appLabelName, found := in.conf.GetAppLabelName(svc.Selectors)
	// the prior code assumed the svc.Selectors had the configured appLabelName entry. I'm going to assume the same
	// thing in the new code, that a valid appLabelName is found. I will log something if the assumption proves false.
	if !found {
		log.Debugf("Expected appLabelName not found in svc.Selectors for [%s:%s:%s]", svc.Cluster, svc.Namespace, svc.Name)
	}
	app := svc.Selectors[appLabelName]

	// Waypoint proxies don't have the label app, but they do have traces
	if IsWaypoint(svc) {
		tracingName.Lookup = svc.Name
		return tracingName, nil
	}
	waypoints := in.GetWaypointsForService(ctx, &svc)
	if len(waypoints) > 0 {
		if in.conf.ExternalServices.Tracing.UseWaypointName {
			tracingName.WaypointName = waypoints[0].Name
			tracingName.WaypointNamespace = waypoints[0].Namespace
			tracingName.Lookup = waypoints[0].Name
			return tracingName, nil
		}

		lookupName := ""
		if in.conf.ExternalServices.Tracing.NamespaceSelector {
			lookupName = fmt.Sprintf("%s.%s.%s", app, namespace, in.conf.ExternalServices.Istio.IstioIdentityDomain)
		} else {
			lookupName = fmt.Sprintf("%s.%s", app, in.conf.ExternalServices.Istio.IstioIdentityDomain)
		}
		tracingName.Lookup = lookupName
		tracingName.WaypointName = lookupName
		return tracingName, nil
	}

	tracingName.App = app
	tracingName.Lookup = app
	return tracingName, nil
}

// GetServiceRouteURL returns "" for non-OpenShift, or if the route can not be found
func (in *SvcService) GetServiceRouteURL(ctx context.Context, cluster, namespace, service string) (url string) {
	url = ""
	userClient, found := in.userClients[cluster]

	if !found {
		log.Debugf("userClient not found for cluster [%s]", cluster)
		return
	}

	if !userClient.IsOpenShift() {
		log.Debugf("[%s] Client is not Openshift, route url is only supported in Openshift", cluster)
		return
	}

	// Assuming service name == route name
	route, err := userClient.GetRoute(ctx, namespace, service)
	if err != nil {
		log.Debugf("[%s][%s][%s] ServiceRouteURL discovery failed: %v", cluster, namespace, service, err)
		return
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		url = "https://" + host
	} else {
		url = "http://" + host
	}

	return
}

// IsWaypoint returns true if the service is from a Waypoint proxy, based on the service labels
func IsWaypoint(service models.Service) bool {
	return config.IsWaypoint(service.Labels)
}
