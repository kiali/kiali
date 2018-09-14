package business

import (
	"fmt"

	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// AppService deals with fetching Workloads group by "app" label, which will be identified as an "application"
type AppService struct {
	k8s kubernetes.IstioClientInterface
}

// Temporal type to collect Name, Deployment, Pods and IstioFlag validation per Workload
type appWorkload struct {
	Workload   string
	Deployment *v1beta1.Deployment
	Pods       []v1.Pod
	IstioFlag  bool
}

// Temporal map of Workloads group by app label
type appsWorkload map[string][]appWorkload

// Helper method to build a map of workloads for a given labelSelector
func (in *AppService) fetchWorkloadsPerApp(namespace, labelSelector string) (appsWorkload, error) {
	cfg := config.Get()
	deployments, err := in.k8s.GetDeployments(namespace, labelSelector)
	if err != nil {
		return nil, err
	}

	apps := make(appsWorkload)
	for _, deployment := range deployments {
		if appLabel, ok := deployment.Labels[cfg.IstioLabels.AppLabelName]; ok {
			selector, _ := kubernetes.GetSelectorAsString(&deployment)
			dPods, _ := in.k8s.GetPods(namespace, selector)
			mPods := &models.Pods{}
			// Using Parse to calculate the IstioSideCar from Pods
			mPods.Parse(dPods)
			appWkd := &appWorkload{
				Workload:   deployment.Name,
				Deployment: &deployment,
				Pods:       dPods,
				IstioFlag:  mPods.HasIstioSideCar(),
			}
			apps[appLabel] = append(apps[appLabel], *appWkd)
		}
	}

	return apps, nil
}

// GetAppList is the API handler to fetch the list of applications in a given namespace
func (in *AppService) GetAppList(namespace string) (models.AppList, error) {
	cfg := config.Get()
	appList := &models.AppList{}
	appList.Namespace = models.Namespace{Name: namespace}
	apps, err := in.fetchWorkloadsPerApp(namespace, cfg.IstioLabels.AppLabelName)
	if err != nil {
		return *appList, err
	}

	for keyApp, valueApp := range apps {
		appItem := &models.AppListItem{Name: keyApp}
		appItem.IstioSidecar = true
		for _, appWorkload := range valueApp {
			appItem.IstioSidecar = appItem.IstioSidecar && appWorkload.IstioFlag
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

	var appWkd []appWorkload
	var ok bool
	// Send a NewNotFound if the app is not found in the deployment list, instead to send an empty result
	if appWkd, ok = apps[app]; !ok {
		return *appInstance, kubernetes.NewNotFound(app, "Kiali", "App")
	}

	(*appInstance).Workloads = make([]models.WorkloadSvc, len(appWkd))
	for i, wkd := range appWkd {
		wkdSvc := &models.WorkloadSvc{WorkloadName: wkd.Workload}
		services, _ := in.k8s.GetServices(namespace, wkd.Deployment.Labels)
		if err != nil {
			return *appInstance, err
		}
		mPods := &models.Pods{}
		// Using Parse to calculate the IstioSideCar from Pods
		mPods.Parse(wkd.Pods)
		wkdSvc.IstioSidecar = mPods.HasIstioSideCar()
		wkdSvc.ServiceNames = make([]string, len(services))
		for j, service := range services {
			wkdSvc.ServiceNames[j] = service.Name
		}
		(*appInstance).Workloads[i] = *wkdSvc
	}
	return *appInstance, nil
}
