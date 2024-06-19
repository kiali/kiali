package business

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

func NewAppService(businessLayer *Layer, conf *config.Config, prom prometheus.ClientInterface, grafana *grafana.Service, userClients map[string]kubernetes.ClientInterface) AppService {
	return AppService{
		businessLayer: businessLayer,
		conf:          conf,
		grafana:       grafana,
		prom:          prom,
		userClients:   userClients,
	}
}

// AppService deals with fetching Workloads group by "app" label, which will be identified as an "application"
type AppService struct {
	businessLayer *Layer
	conf          *config.Config
	grafana       *grafana.Service
	prom          prometheus.ClientInterface
	userClients   map[string]kubernetes.ClientInterface
}

type AppCriteria struct {
	Namespace             string
	Cluster               string
	AppName               string
	IncludeIstioResources bool
	IncludeHealth         bool
	RateInterval          string
	QueryTime             time.Time
}

func joinMap(m1 map[string][]string, m2 map[string]string) {
	for k, v2 := range m2 {
		dup := false
		for _, v1 := range m1[k] {
			if v1 == v2 {
				dup = true
				break
			}
		}
		if !dup {
			m1[k] = append(m1[k], v2)
		}
	}
}

func buildFinalLabels(m map[string][]string) map[string]string {
	consolidated := make(map[string]string, len(m))
	for k, list := range m {
		sort.Strings(list)
		consolidated[k] = strings.Join(list, ",")
	}
	return consolidated
}

// GetClusterAppList is the API handler to fetch the list of applications in a given namespace and cluster
func (in *AppService) GetClusterAppList(ctx context.Context, criteria AppCriteria) (models.ClusterApps, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetClusterAppList",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("includeHealth", criteria.IncludeHealth),
		observability.Attribute("includeIstioResources", criteria.IncludeIstioResources),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	appList := &models.ClusterApps{
		Apps: []models.AppListItem{},
	}

	namespace := criteria.Namespace
	cluster := criteria.Cluster

	if _, ok := in.userClients[cluster]; !ok {
		return *appList, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return *appList, err
	}

	allApps, err := in.businessLayer.App.fetchNamespaceApps(ctx, namespace, cluster, "")
	if err != nil {
		log.Errorf("Error fetching Applications for cluster %s per namespace %s: %s", cluster, namespace, err)
		return *appList, err
	}

	icCriteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeEnvoyFilters:           true,
		IncludeGateways:               true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
	}
	istioConfigList := &models.IstioConfigList{}

	if criteria.IncludeIstioResources {
		istioConfigList, err = in.businessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, cluster, namespace, icCriteria)
		if err != nil {
			log.Errorf("Error fetching Istio Config for Cluster %s per namespace %s: %s", cluster, namespace, err)
			return *appList, err
		}
	}

	for keyApp, valueApp := range allApps {
		appItem := &models.AppListItem{
			Name:         keyApp,
			IstioSidecar: true,
			Health:       models.EmptyAppHealth(),
		}
		applabels := make(map[string][]string)
		svcReferences := make([]*models.IstioValidationKey, 0)
		for _, srv := range valueApp.Services {
			joinMap(applabels, srv.Labels)
			if criteria.IncludeIstioResources {
				vsFiltered := kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, srv.Namespace, srv.Name)
				for _, v := range vsFiltered {
					ref := models.BuildKey(v.Kind, v.Name, v.Namespace)
					svcReferences = append(svcReferences, &ref)
				}
				drFiltered := kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, srv.Namespace, srv.Name)
				for _, d := range drFiltered {
					ref := models.BuildKey(d.Kind, d.Name, d.Namespace)
					svcReferences = append(svcReferences, &ref)
				}
				gwFiltered := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, istioConfigList.VirtualServices)
				for _, g := range gwFiltered {
					ref := models.BuildKey(g.Kind, g.Name, g.Namespace)
					svcReferences = append(svcReferences, &ref)
				}

			}

		}

		wkdReferences := make([]*models.IstioValidationKey, 0)
		for _, wrk := range valueApp.Workloads {
			joinMap(applabels, wrk.Labels)
			if criteria.IncludeIstioResources {
				wSelector := labels.Set(wrk.Labels).AsSelector().String()
				wkdReferences = append(wkdReferences, FilterWorkloadReferences(wSelector, *istioConfigList)...)
			}
		}
		appItem.Labels = buildFinalLabels(applabels)
		appItem.IstioReferences = FilterUniqueIstioReferences(append(svcReferences, wkdReferences...))

		for _, w := range valueApp.Workloads {
			if appItem.IstioSidecar = w.IstioSidecar; !appItem.IstioSidecar {
				break
			}
		}
		for _, w := range valueApp.Workloads {
			if appItem.IsAmbient = w.HasIstioAmbient(); !appItem.IsAmbient {
				break
			}
		}
		if criteria.IncludeHealth {
			appItem.Health, err = in.businessLayer.Health.GetAppHealth(ctx, criteria.Namespace, valueApp.cluster, appItem.Name, criteria.RateInterval, criteria.QueryTime, valueApp)
			if err != nil {
				log.Errorf("Error fetching Health in namespace %s for app %s: %s", criteria.Namespace, appItem.Name, err)
			}
		}
		appItem.Cluster = cluster
		appItem.Namespace = namespace
		appList.Apps = append(appList.Apps, *appItem)
	}

	return *appList, nil
}

// GetAppList is the API handler to fetch the list of applications in a given namespace
func (in *AppService) GetAppList(ctx context.Context, criteria AppCriteria) (models.AppList, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetAppList",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("includeHealth", criteria.IncludeHealth),
		observability.Attribute("includeIstioResources", criteria.IncludeIstioResources),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	appList := &models.AppList{
		Namespace: models.Namespace{Name: criteria.Namespace},
		Cluster:   criteria.Cluster,
		Apps:      []models.AppListItem{},
	}

	var err error
	var allApps []namespaceApps

	wg := &sync.WaitGroup{}
	type result struct {
		cluster string
		nsApps  namespaceApps
		err     error
	}
	resultsCh := make(chan result)

	// TODO: Use a context to define a timeout. The context should be passed to the k8s client
	go func() {
		for cluster := range in.userClients {
			wg.Add(1)
			go func(c string) {
				defer wg.Done()
				nsApps, error2 := in.fetchNamespaceApps(ctx, criteria.Namespace, c, "")
				if error2 != nil {
					resultsCh <- result{cluster: c, nsApps: nil, err: error2}
				} else {
					resultsCh <- result{cluster: c, nsApps: nsApps, err: nil}
				}
			}(cluster)
		}
		wg.Wait()
		close(resultsCh)
	}()

	// Combine namespace data
	for resultCh := range resultsCh {
		if resultCh.err != nil {
			// Return failure if we are in single cluster
			if resultCh.cluster == in.conf.KubernetesConfig.ClusterName && len(in.userClients) == 1 {
				log.Errorf("Error fetching Applications for local cluster %s: %s", resultCh.cluster, resultCh.err)
				return models.AppList{}, resultCh.err
			} else {
				log.Infof("Error fetching Applications for cluster %s: %s", resultCh.cluster, resultCh.err)
			}
		}
		allApps = append(allApps, resultCh.nsApps)
	}

	icCriteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeEnvoyFilters:           true,
		IncludeGateways:               true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
	}
	var istioConfigMap models.IstioConfigMap

	// TODO: MC
	if criteria.IncludeIstioResources {
		istioConfigMap, err = in.businessLayer.IstioConfig.GetIstioConfigMap(ctx, criteria.Namespace, icCriteria)
		if err != nil {
			log.Errorf("Error fetching Istio Config per namespace %s: %s", criteria.Namespace, err)
			return models.AppList{}, err
		}
	}

	for _, clusterApps := range allApps {
		for keyApp, valueApp := range clusterApps {
			appItem := &models.AppListItem{
				Name:         keyApp,
				IstioSidecar: true,
				Health:       models.EmptyAppHealth(),
			}
			istioConfigList := models.IstioConfigList{}
			if _, ok := istioConfigMap[valueApp.cluster]; ok {
				istioConfigList = istioConfigMap[valueApp.cluster]
			}
			applabels := make(map[string][]string)
			svcReferences := make([]*models.IstioValidationKey, 0)
			for _, srv := range valueApp.Services {
				joinMap(applabels, srv.Labels)
				if criteria.IncludeIstioResources {
					vsFiltered := kubernetes.FilterVirtualServicesByService(istioConfigList.VirtualServices, srv.Namespace, srv.Name)
					for _, v := range vsFiltered {
						ref := models.BuildKey(v.Kind, v.Name, v.Namespace)
						svcReferences = append(svcReferences, &ref)
					}
					drFiltered := kubernetes.FilterDestinationRulesByService(istioConfigList.DestinationRules, srv.Namespace, srv.Name)
					for _, d := range drFiltered {
						ref := models.BuildKey(d.Kind, d.Name, d.Namespace)
						svcReferences = append(svcReferences, &ref)
					}
					gwFiltered := kubernetes.FilterGatewaysByVirtualServices(istioConfigList.Gateways, istioConfigList.VirtualServices)
					for _, g := range gwFiltered {
						ref := models.BuildKey(g.Kind, g.Name, g.Namespace)
						svcReferences = append(svcReferences, &ref)
					}

				}

			}

			wkdReferences := make([]*models.IstioValidationKey, 0)
			for _, wrk := range valueApp.Workloads {
				joinMap(applabels, wrk.Labels)
				if criteria.IncludeIstioResources {
					wSelector := labels.Set(wrk.Labels).AsSelector().String()
					wkdReferences = append(wkdReferences, FilterWorkloadReferences(wSelector, istioConfigList)...)
				}
			}
			appItem.Labels = buildFinalLabels(applabels)
			appItem.IstioReferences = FilterUniqueIstioReferences(append(svcReferences, wkdReferences...))

			for _, w := range valueApp.Workloads {
				if appItem.IstioSidecar = w.IstioSidecar; !appItem.IstioSidecar {
					break
				}
			}
			for _, w := range valueApp.Workloads {
				if appItem.IsAmbient = w.HasIstioAmbient(); !appItem.IsAmbient {
					break
				}
			}
			if criteria.IncludeHealth {
				appItem.Health, err = in.businessLayer.Health.GetAppHealth(ctx, criteria.Namespace, valueApp.cluster, appItem.Name, criteria.RateInterval, criteria.QueryTime, valueApp)
				if err != nil {
					log.Errorf("Error fetching Health in namespace %s for app %s: %s", criteria.Namespace, appItem.Name, err)
				}
			}
			appItem.Cluster = valueApp.cluster
			appItem.Namespace = criteria.Namespace
			appList.Apps = append(appList.Apps, *appItem)
		}
	}

	return *appList, nil
}

// GetApp is the API handler to fetch the details for a given namespace and app name
func (in *AppService) GetAppDetails(ctx context.Context, criteria AppCriteria) (models.App, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetApp",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("appName", criteria.AppName),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	appInstance := &models.App{Namespace: models.Namespace{Name: criteria.Namespace}, Name: criteria.AppName, Health: models.EmptyAppHealth(), Cluster: criteria.Cluster}
	ns, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, criteria.Namespace, criteria.Cluster)
	if err != nil {
		return *appInstance, err
	}
	appInstance.Namespace = *ns

	namespaceApps, err := in.fetchNamespaceApps(ctx, criteria.Namespace, criteria.Cluster, criteria.AppName)
	if err != nil {
		return *appInstance, err
	}

	var appDetails *appDetails
	var ok bool
	// Send a NewNotFound if the app is not found in the deployment list, instead to send an empty result
	if appDetails, ok = namespaceApps[criteria.AppName]; !ok {
		return *appInstance, kubernetes.NewNotFound(criteria.AppName, "Kiali", "App")
	}

	appInstance.Workloads = make([]models.WorkloadItem, len(appDetails.Workloads))
	for i, wkd := range appDetails.Workloads {
		appInstance.Workloads[i] = models.WorkloadItem{WorkloadName: wkd.Name, IstioSidecar: wkd.IstioSidecar, Labels: wkd.Labels, IsAmbient: wkd.IsAmbient, ServiceAccountNames: wkd.Pods.ServiceAccounts()}
	}

	appInstance.ServiceNames = make([]string, len(appDetails.Services))
	for i, svc := range appDetails.Services {
		appInstance.ServiceNames[i] = svc.Name
	}

	pods := models.Pods{}
	isAmbient := len(appDetails.Workloads) > 0

	for _, workload := range appDetails.Workloads {
		pods = append(pods, workload.Pods...)
		if !workload.IsAmbient {
			isAmbient = false
		}
	}

	appInstance.Runtimes = NewDashboardsService(in.conf, in.grafana, ns, nil).GetCustomDashboardRefs(criteria.Namespace, criteria.AppName, "", pods)
	if criteria.IncludeHealth {
		appInstance.Health, err = in.businessLayer.Health.GetAppHealth(ctx, criteria.Namespace, criteria.Cluster, criteria.AppName, criteria.RateInterval, criteria.QueryTime, appDetails)
		if err != nil {
			log.Errorf("Error fetching Health in namespace %s for app %s: %s", criteria.Namespace, criteria.AppName, err)
		}
	}
	appInstance.IsAmbient = isAmbient
	appInstance.Cluster = appDetails.cluster

	return *appInstance, nil
}

// AppDetails holds Services and Workloads having the same "app" label
type appDetails struct {
	app       string
	cluster   string
	Services  []models.ServiceOverview
	Workloads models.Workloads
}

// NamespaceApps is a map of app_name and cluster x AppDetails
type namespaceApps = map[string]*appDetails

func castAppDetails(appLabel string, allEntities namespaceApps, ss *models.ServiceList, w *models.Workload, cluster string) {
	if app, ok := w.Labels[appLabel]; ok {
		if appEntities, ok := allEntities[app]; ok {
			appEntities.Workloads = append(appEntities.Workloads, w)
		} else {
			allEntities[app] = &appDetails{
				app:       app,
				cluster:   cluster,
				Workloads: models.Workloads{w},
			}
		}
		if ss != nil {
			for _, service := range ss.Services {
				if appEntities, ok := allEntities[app]; ok {
					found := false
					for _, s := range appEntities.Services {
						if s.Name == service.Name && s.Namespace == service.Namespace {
							found = true
						}
					}
					if !found {
						appEntities.Services = append(appEntities.Services, service)
					}
				}
			}
		}
	}
}

// Helper method to fetch all applications for a given namespace.
// Optionally if appName parameter is provided, it filters apps for that name.
// Return an error on any problem.
func (in *AppService) fetchNamespaceApps(ctx context.Context, namespace string, cluster string, appName string) (namespaceApps, error) {
	var ss *models.ServiceList
	var ws models.Workloads

	appNameSelector := ""
	if appName != "" {
		selector := labels.Set(map[string]string{in.conf.IstioLabels.AppLabelName: appName})
		appNameSelector = selector.String()
	}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	var err error
	ws, err = in.businessLayer.Workload.fetchWorkloadsFromCluster(ctx, cluster, namespace, appNameSelector)
	if err != nil {
		return nil, err
	}
	allEntities := make(namespaceApps)
	for _, w := range ws {
		// Check if namespace is cached
		serviceCriteria := ServiceCriteria{
			Cluster:                cluster,
			Namespace:              namespace,
			IncludeHealth:          false,
			IncludeIstioResources:  false,
			IncludeOnlyDefinitions: true,
			ServiceSelector:        labels.Set(w.Labels).String(),
		}
		ss, err = in.businessLayer.Svc.GetServiceList(ctx, serviceCriteria)
		if err != nil {
			return nil, err
		}
		castAppDetails(in.conf.IstioLabels.AppLabelName, allEntities, ss, w, cluster)
	}

	return allEntities, nil
}
