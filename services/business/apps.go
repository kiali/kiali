package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// AppService deals with fetching Workloads group by "app" label, which will be identified as an "application"
type AppService struct {
	k8s kubernetes.IstioClientInterface
}

// Temporal type to collect Name and IstioFlag validation per Workload
type appWorkload struct {
	Workload  string
	IstioFlag bool
}

// Temporal map of Workloads group by app label
type appsWorkload map[string][]appWorkload

// GetAppList is the API handler to fetch the list of applications in a given namespace
func (in *AppService) GetAppList(namespace string) (models.AppList, error) {
	deployments, err := in.k8s.GetDeployments(namespace)
	appList := &models.AppList{}
	if err != nil {
		return *appList, err
	}

	appList.Namespace = models.Namespace{Name: namespace}

	apps := make(appsWorkload)
	for _, deployment := range deployments.Items {
		if appLabel, ok := deployment.Labels["app"]; ok {
			selector, _ := in.k8s.GetDeploymentSelector(namespace, deployment.Name)
			dPods, _ := in.k8s.GetPods(namespace, selector)

			mPods := &models.Pods{}
			mPods.Parse(dPods.Items)
			appWkld := &appWorkload{Workload: deployment.Name, IstioFlag: mPods.HasIstioSideCar()}
			apps[appLabel] = append(apps[appLabel], *appWkld)
		}
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
