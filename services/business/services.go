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
func (in *SvcService) GetServiceList(namespace, rateInterval string) (*models.ServiceList, error) {
	// Fetch services list
	kubernetesServices, err := in.k8s.GetServices(namespace)
	if err != nil {
		return nil, err
	}
	nsHealth := in.health.getNamespaceHealth(namespace, kubernetesServices, rateInterval)

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, kubernetesServices, nsHealth), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *kubernetes.ServiceList, nsHealth NamespaceHealth) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Services.Items))

	// Convert each k8s service into our model
	for i, item := range sl.Services.Items {
		sPods := kubernetes.FilterPodsForService(&item, sl.Pods)
		hasSideCar := hasIstioSideCar(sPods)
		overview := models.ServiceOverview{
			Name:         item.Name,
			IstioSidecar: hasSideCar,
		}
		if health, ok := nsHealth[item.Name]; ok {
			overview.Health = *health
		}
		services[i] = overview
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

	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Istio details: %s", err.Error())
	}

	prometheusDetails, err := in.prom.GetSourceServices(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Source services: %s", err.Error())
	}

	statuses := castDeploymentsStatuses(serviceDetails.Deployments.Items)
	health := models.Health{
		DeploymentStatuses: statuses,
		DeploymentsFetched: true}
	in.health.fillMissingParts(namespace, service, interval, &health)

	s := models.Service{
		Namespace: models.Namespace{Name: namespace},
		Name:      service,
		Health:    health}
	s.SetServiceDetails(serviceDetails, istioDetails, prometheusDetails)
	return &s, nil
}
