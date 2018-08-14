package business

import (
	"fmt"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/models"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom   prometheus.ClientInterface
	k8s    kubernetes.IstioClientInterface
	health *HealthService
}

// GetServiceList returns a list of all services for a given Namespace
func (in *SvcService) GetServiceList(namespace string) (*models.ServiceList, error) {
	// Fetch services list
	kubernetesServices, err := in.k8s.GetFullServices(namespace)
	if err != nil {
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, kubernetesServices), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *kubernetes.ServiceList) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Services.Items))

	// Convert each k8s service into our model
	for i, item := range sl.Services.Items {
		sPods := kubernetes.FilterPodsForService(&item, sl.Pods)
		/** Check if Service has istioSidecar deployed */
		mPods := models.Pods{}
		mPods.Parse(sPods)
		hasSideCar := mPods.HasIstioSideCar()
		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector["app"]
		services[i] = models.ServiceOverview{
			Name:         item.Name,
			IstioSidecar: hasSideCar,
			AppLabel:     appLabel,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services}
}

// GetService returns a single service
func (in *SvcService) GetService(namespace, service, interval string) (*models.ServiceDetails, error) {
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Service details: %s", err.Error())
	}

	health := in.health.getServiceHealth(namespace, service, interval, serviceDetails)

	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Istio details: %s", err.Error())
	}

	prometheusDetails, err := in.prom.GetSourceWorkloads(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Source services: %s", err.Error())
	}

	s := models.ServiceDetails{
		Namespace: models.Namespace{Name: namespace},
		Name:      service,
		Health:    health}
	s.SetServiceDetails(serviceDetails, istioDetails, prometheusDetails)
	return &s, nil
}

// GetApps returns a list of "app" label values used for the Deployments covered by this service
//	DEPRECATED this should only be used temporarily, until it's possible the get metrics for a given app label
//	Ultimately, service metrics will not gather full apps metrics.
func (in *SvcService) GetApps(namespace, service string) ([]string, error) {
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("GetApps: %s", err.Error())
	}

	// Make a map to avoid repeated values
	apps := make(map[string]bool)
	for _, pod := range serviceDetails.Pods {
		if app, ok := pod.Labels["app"]; ok {
			apps[app] = true
		}
	}

	// Make an array of the apps found
	uniqueApps := make([]string, len(apps))
	i := 0
	for k := range apps {
		uniqueApps[i] = k
		i++
	}

	return uniqueApps, nil
}
