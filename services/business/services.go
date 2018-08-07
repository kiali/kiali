package business

import (
	"fmt"

	"k8s.io/api/core/v1"

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
		hasSideCar := hasIstioSideCar(sPods)
		services[i] = models.ServiceOverview{
			Name:         item.Name,
			IstioSidecar: hasSideCar,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services}
}

func hasIstioSideCar(pods []v1.Pod) bool {
	mPods := models.Pods{}
	mPods.Parse(pods)
	for _, pod := range mPods {
		if len(pod.IstioContainers) > 0 {
			return true
		}
	}
	return false
}

// GetService returns a single service
func (in *SvcService) GetService(namespace, service, interval string) (*models.Service, error) {
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

	s := models.Service{
		Namespace: models.Namespace{Name: namespace},
		Name:      service,
		Health:    health}
	s.SetServiceDetails(serviceDetails, istioDetails, prometheusDetails)
	return &s, nil
}

// GetApps returns a list of "app" label values used for the Deployments covered by this service
func (in *SvcService) GetApps(namespace, service string) ([]string, error) {
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("GetApps: %s", err.Error())
	}

	var apps []string
	for _, depl := range serviceDetails.Deployments.Items {
		if app, ok := depl.Labels["app"]; ok {
			apps = append(apps, app)
		}
	}
	return apps, nil
}
