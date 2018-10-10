package business

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

// AppService deals with fetching Workloads group by "app" label, which will be identified as an "application"
type AppService struct {
	k8s kubernetes.IstioClientInterface
}

// Temporal map of Workloads group by app label
type appsWorkload map[string][]*models.Workload

// Helper method to build a map of workloads for a given labelSelector
func (in *AppService) fetchWorkloadsPerApp(namespace, labelSelector string) (appsWorkload, error) {
	cfg := config.Get()

	ws, err := fetchWorkloads(in.k8s, namespace, labelSelector)
	if err != nil {
		return nil, err
	}

	apps := make(appsWorkload)
	for _, w := range ws {
		if appLabel, ok := w.Labels[cfg.IstioLabels.AppLabelName]; ok {
			apps[appLabel] = append(apps[appLabel], w)
		}
	}
	return apps, nil
}

// GetAppList is the API handler to fetch the list of applications in a given namespace
func (in *AppService) GetAppList(namespace string) (models.AppList, error) {
	cfg := config.Get()
	appList := &models.AppList{
		Namespace: models.Namespace{Name: namespace},
		Apps:      []models.AppListItem{},
	}
	apps, err := in.fetchWorkloadsPerApp(namespace, cfg.IstioLabels.AppLabelName)
	if err != nil {
		return *appList, err
	}

	for keyApp, valueApp := range apps {
		appItem := &models.AppListItem{Name: keyApp}
		appItem.IstioSidecar = true
		for _, w := range valueApp {
			appItem.IstioSidecar = appItem.IstioSidecar && w.Pods.HasIstioSideCar()
		}
		(*appList).Apps = append((*appList).Apps, *appItem)
	}

	return *appList, nil
}

// GetApp is the API handler to fetch the details for a given namespace and app name
func (in *AppService) GetApp(namespace string, app string) (models.App, error) {
	cfg := config.Get()
	appInstance := &models.App{Namespace: models.Namespace{Name: namespace}, Name: app}
	apps, err := in.fetchWorkloadsPerApp(namespace, fmt.Sprintf("%s=%s", cfg.IstioLabels.AppLabelName, app))
	if err != nil {
		return *appInstance, err
	}

	var appWkd []*models.Workload
	var ok bool
	// Send a NewNotFound if the app is not found in the deployment list, instead to send an empty result
	if appWkd, ok = apps[app]; !ok {
		return *appInstance, kubernetes.NewNotFound(app, "Kiali", "App")
	}

	(*appInstance).Workloads = make([]models.WorkloadSvc, len(appWkd))
	for i, wkd := range appWkd {
		wkdSvc := &models.WorkloadSvc{WorkloadName: wkd.Name}
		services, _ := in.k8s.GetServices(namespace, wkd.Labels)
		if err != nil {
			return *appInstance, err
		}
		wkdSvc.IstioSidecar = wkd.Pods.HasIstioSideCar()
		wkdSvc.ServiceNames = make([]string, len(services))
		for j, service := range services {
			wkdSvc.ServiceNames[j] = service.Name
		}
		(*appInstance).Workloads[i] = *wkdSvc
	}
	return *appInstance, nil
}
