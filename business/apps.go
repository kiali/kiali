package business

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// AppService deals with fetching Workloads group by "app" label, which will be identified as an "application"
type AppService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
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

// GetAppList is the API handler to fetch the list of applications in a given namespace
func (in *AppService) GetAppList(namespace string, linkIstioResources bool) (models.AppList, error) {
	appList := &models.AppList{
		Namespace: models.Namespace{Name: namespace},
		Apps:      []models.AppListItem{},
	}

	var err error
	var apps namespaceApps

	var virtualServices []kubernetes.IstioObject
	var destinationRules []kubernetes.IstioObject
	var gateways []kubernetes.IstioObject
	var authorizationPolicies []kubernetes.IstioObject
	var peerAuthentications []kubernetes.IstioObject
	var sidecars []kubernetes.IstioObject
	var requestAuthentications []kubernetes.IstioObject
	var envoyFilters []kubernetes.IstioObject

	nFetches := 1
	if linkIstioResources {
		nFetches = 9
	}

	wg := sync.WaitGroup{}
	wg.Add(nFetches)
	errChan := make(chan error, nFetches)

	go func() {
		defer wg.Done()
		var err2 error
		apps, err2 = fetchNamespaceApps(in.businessLayer, namespace, "")
		if err2 != nil {
			log.Errorf("Error fetching Applications per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}()

	if linkIstioResources {
		go func() {
			defer wg.Done()
			var err error
			if IsNamespaceCached(namespace) {
				virtualServices, err = kialiCache.GetIstioObjects(namespace, kubernetes.VirtualServices, "")
			} else {
				virtualServices, err = in.k8s.GetIstioObjects(namespace, kubernetes.VirtualServices, "")
			}
			if err != nil {
				log.Errorf("Error fetching Istio VirtualServices per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}()

		go func() {
			defer wg.Done()
			var err error
			if IsNamespaceCached(namespace) {
				destinationRules, err = kialiCache.GetIstioObjects(namespace, kubernetes.DestinationRules, "")
			} else {
				destinationRules, err = in.k8s.GetIstioObjects(namespace, kubernetes.DestinationRules, "")
			}
			if err != nil {
				log.Errorf("Error fetching Istio DestinationRules per namespace %s: %s", namespace, err)
				errChan <- err
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				gateways, err = kialiCache.GetIstioObjects(namespace, kubernetes.Gateways, "")
			} else {
				gateways, err = in.k8s.GetIstioObjects(namespace, kubernetes.Gateways, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio Gateways per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				authorizationPolicies, err = kialiCache.GetIstioObjects(namespace, kubernetes.AuthorizationPolicies, "")
			} else {
				authorizationPolicies, err = in.k8s.GetIstioObjects(namespace, kubernetes.AuthorizationPolicies, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio AuthorizationPolicies per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				peerAuthentications, err = kialiCache.GetIstioObjects(namespace, kubernetes.PeerAuthentications, "")
			} else {
				peerAuthentications, err = in.k8s.GetIstioObjects(namespace, kubernetes.PeerAuthentications, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio PeerAuthentications per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				sidecars, err = kialiCache.GetIstioObjects(namespace, kubernetes.Sidecars, "")
			} else {
				sidecars, err = in.k8s.GetIstioObjects(namespace, kubernetes.Sidecars, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio Sidecars per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				requestAuthentications, err = kialiCache.GetIstioObjects(namespace, kubernetes.RequestAuthentications, "")
			} else {
				requestAuthentications, err = in.k8s.GetIstioObjects(namespace, kubernetes.RequestAuthentications, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio Sidecars per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			if IsNamespaceCached(namespace) {
				envoyFilters, err = kialiCache.GetIstioObjects(namespace, kubernetes.EnvoyFilters, "")
			} else {
				envoyFilters, err = in.k8s.GetIstioObjects(namespace, kubernetes.EnvoyFilters, "")
			}
			if err2 != nil {
				log.Errorf("Error fetching Istio EnvoyFilters per namespace %s: %s", namespace, err2)
				errChan <- err2
			}
		}()
	}

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return *appList, err
	}

	for keyApp, valueApp := range apps {
		appItem := &models.AppListItem{
			Name:         keyApp,
			IstioSidecar: true,
		}
		applabels := make(map[string][]string)
		apVsNames := make([]string, 0)
		apDrNames := make([]string, 0)
		for _, srv := range valueApp.Services {
			joinMap(applabels, srv.Labels)

			svcVirtualServices := kubernetes.FilterVirtualServices(virtualServices, srv.Namespace, srv.Name)
			apVsNames = append(apVsNames, getIstioResourcesNames(svcVirtualServices)...)

			svcDestinationRules := kubernetes.FilterDestinationRules(destinationRules, srv.Namespace, srv.Name)
			apDrNames = append(apDrNames, getIstioResourcesNames(svcDestinationRules)...)
		}
		appItem.VirtualServices = apVsNames
		appItem.DestinationRules = apDrNames

		apGwNames := make([]string, 0)
		apApNames := make([]string, 0)
		apPaNames := make([]string, 0)
		apScNames := make([]string, 0)
		apRaNames := make([]string, 0)
		apEfNames := make([]string, 0)
		for _, wrk := range valueApp.Workloads {
			joinMap(applabels, wrk.Labels)

			wSelector := labels.Set(wrk.Labels).AsSelector().String()
			wGw := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, gateways)
			apGwNames = append(apGwNames, getIstioResourcesNames(wGw)...)

			wAp := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, authorizationPolicies)
			apApNames = append(apApNames, getIstioResourcesNames(wAp)...)

			wPa := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, peerAuthentications)
			apPaNames = append(apPaNames, getIstioResourcesNames(wPa)...)

			wSc := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, sidecars)
			apScNames = append(apScNames, getIstioResourcesNames(wSc)...)

			wRa := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, requestAuthentications)
			apRaNames = append(apRaNames, getIstioResourcesNames(wRa)...)

			wEf := kubernetes.FilterIstioObjectsForWorkloadSelector(wSelector, envoyFilters)
			apEfNames = append(apEfNames, getIstioResourcesNames(wEf)...)
		}
		appItem.Labels = buildFinalLabels(applabels)
		appItem.Gateways = apGwNames
		appItem.AuthorizationPolicies = apApNames
		appItem.PeerAuthentications = apPaNames
		appItem.Sidecars = apScNames
		appItem.RequestAuthentications = apRaNames
		appItem.EnvoyFilters = apEfNames

		for _, w := range valueApp.Workloads {
			if appItem.IstioSidecar = w.IstioSidecar; !appItem.IstioSidecar {
				break
			}
		}

		(*appList).Apps = append((*appList).Apps, *appItem)
	}

	return *appList, nil
}

// GetApp is the API handler to fetch the details for a given namespace and app name
func (in *AppService) GetApp(namespace string, appName string) (models.App, error) {
	appInstance := &models.App{Namespace: models.Namespace{Name: namespace}, Name: appName}
	namespaceApps, err := fetchNamespaceApps(in.businessLayer, namespace, appName)
	if err != nil {
		return *appInstance, err
	}

	var appDetails *appDetails
	var ok bool
	// Send a NewNotFound if the app is not found in the deployment list, instead to send an empty result
	if appDetails, ok = namespaceApps[appName]; !ok {
		return *appInstance, kubernetes.NewNotFound(appName, "Kiali", "App")
	}

	(*appInstance).Workloads = make([]models.WorkloadItem, len(appDetails.Workloads))
	for i, wkd := range appDetails.Workloads {
		wkdSvc := &models.WorkloadItem{WorkloadName: wkd.Name}
		wkdSvc.IstioSidecar = wkd.IstioSidecar
		(*appInstance).Workloads[i] = *wkdSvc
	}

	(*appInstance).ServiceNames = make([]string, len(appDetails.Services))
	for i, svc := range appDetails.Services {
		(*appInstance).ServiceNames[i] = svc.Name
	}

	pods := models.Pods{}
	for _, workload := range appDetails.Workloads {
		pods = append(pods, workload.Pods...)
	}
	(*appInstance).Runtimes = NewDashboardsService().GetCustomDashboardRefs(namespace, appName, "", pods)

	return *appInstance, nil
}

// AppDetails holds Services and Workloads having the same "app" label
type appDetails struct {
	app       string
	Services  []core_v1.Service
	Workloads models.Workloads
}

// NamespaceApps is a map of app_name x AppDetails
type namespaceApps = map[string]*appDetails

func castAppDetails(services []core_v1.Service, ws models.Workloads) namespaceApps {
	allEntities := make(namespaceApps)
	appLabel := config.Get().IstioLabels.AppLabelName
	for _, service := range services {
		if app, ok := service.Spec.Selector[appLabel]; ok {
			if appEntities, ok := allEntities[app]; ok {
				appEntities.Services = append(appEntities.Services, service)
			} else {
				allEntities[app] = &appDetails{
					app:      app,
					Services: []core_v1.Service{service},
				}
			}
		}
	}
	for _, w := range ws {
		if app, ok := w.Labels[appLabel]; ok {
			if appEntities, ok := allEntities[app]; ok {
				appEntities.Workloads = append(appEntities.Workloads, w)
			} else {
				allEntities[app] = &appDetails{
					app:       app,
					Workloads: models.Workloads{w},
				}
			}
		}
	}
	return allEntities
}

// Helper method to fetch all applications for a given namespace.
// Optionally if appName parameter is provided, it filters apps for that name.
// Return an error on any problem.
func fetchNamespaceApps(layer *Layer, namespace string, appName string) (namespaceApps, error) {
	var services []core_v1.Service
	var ws models.Workloads
	cfg := config.Get()

	labelSelector := cfg.IstioLabels.AppLabelName
	if appName != "" {
		labelSelector = fmt.Sprintf("%s=%s", cfg.IstioLabels.AppLabelName, appName)
	}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := layer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err error
		// Check if namespace is cached
		if IsNamespaceCached(namespace) {
			services, err = kialiCache.GetServices(namespace, nil)
		} else {
			services, err = layer.k8s.GetServices(namespace, nil)
		}
		if appName != "" {
			selector := labels.Set(map[string]string{cfg.IstioLabels.AppLabelName: appName}).AsSelector()
			services = kubernetes.FilterServicesForSelector(selector, services)
		}
		if err != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		ws, err = fetchWorkloads(layer, namespace, labelSelector)
		if err != nil {
			log.Errorf("Error fetching Workload per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return nil, err
	}

	return castAppDetails(services, ws), nil
}
