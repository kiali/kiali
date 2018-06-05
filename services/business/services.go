package business

import (
	"fmt"
	"strings"

	"github.com/prometheus/common/model"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
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

	// Fetch services requests rates
	inRates, outRates, _ := in.prom.GetNamespaceServicesRequestRates(namespace, rateInterval)

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, kubernetesServices, inRates, outRates), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *kubernetes.ServiceList, inRates, outRates model.Vector) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Services.Items))

	// Convert each k8s service into our model
	for i, item := range sl.Services.Items {
		depls := kubernetes.FilterDeploymentsForService(&item, sl.Pods, sl.Deployments)
		services[i] = in.castServiceOverview(&item, depls)
	}

	// Fill with collected request rates
	// Note: we must match each service with inRates and outRates separately, else we would generate duplicates
	processRequestRates(services, inRates, "destination_service")
	processRequestRates(services, outRates, "source_service")

	// Finally complete missing health information
	for idx := range services {
		s := &services[idx]
		// rateinterval not necessary here since we already fetched the request rates
		// mark request health as fetched
		s.Health.Requests.Fetched = true
		in.health.fillMissingParts(namespace.Name, s.Name, "", &s.Health)
	}

	return &models.ServiceList{Namespace: namespace, Services: services}
}

func (in *SvcService) castServiceOverview(s *v1.Service, deployments []v1beta1.Deployment) models.ServiceOverview {
	hasSideCar := hasIstioSideCar(deployments)
	statuses := castDeploymentsStatuses(deployments)
	health := models.Health{
		DeploymentStatuses: statuses,
		DeploymentsFetched: true}
	return models.ServiceOverview{
		Name:         s.Name,
		IstioSidecar: hasSideCar,
		Health:       health}
}

func hasIstioSideCar(deployments []v1beta1.Deployment) bool {
	for _, deployment := range deployments {
		if deployment.Spec.Template.Annotations != nil {
			if _, exists := deployment.Spec.Template.Annotations[config.Get().Products.Istio.IstioSidecarAnnotation]; exists {
				return true
			}
		}
	}
	return false
}

// processRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the service list.
func processRequestRates(services []models.ServiceOverview, rates model.Vector, matchLabel model.LabelName) {
	// Sum rates per service
	for _, sample := range rates {
		serviceName := strings.SplitN(string(sample.Metric[matchLabel]), ".", 2)[0]
		for idx := range services {
			service := &services[idx]
			if service.Name == serviceName {
				sumRequestCounters(service.Name, &service.Health.Requests, sample)
				break
			}
		}
	}
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
