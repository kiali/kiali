package business

import (
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom   prometheus.ClientInterface
	k8s    kubernetes.IstioClientInterface
	health *HealthService
}

// GetServiceList returns a list of all services for a given namespace
func (in *SvcService) GetServiceList(namespace, rateInterval string) (*models.ServiceList, error) {
	// Fetch services list
	kubernetesServices, err := in.k8s.GetServices(namespace)
	if err != nil {
		return nil, err
	}

	// Fetch services requests counters
	requestCounters := in.prom.GetNamespaceServicesRequestCounters(namespace, rateInterval)

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, kubernetesServices, &requestCounters), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *kubernetes.ServiceList, requestCounters *prometheus.MetricsVector) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Services.Items))

	for i, item := range sl.Services.Items {
		depls := getDeploymentsMatchingService(&item, sl.Deployments)
		services[i] = in.castServiceOverview(&item, depls)
	}
	processRequestCounters(services, requestCounters)

	return &models.ServiceList{Namespace: namespace, Services: services}
}

func getDeploymentsMatchingService(s *v1.Service, deployments *v1beta1.DeploymentList) []v1beta1.Deployment {
	depls := make([]v1beta1.Deployment, len(deployments.Items))
	i := 0
	for _, depl := range deployments.Items {
		if kubernetes.LabelsMatch(depl.ObjectMeta.Labels, s.Spec.Selector) {
			depls[i] = depl
			i++
		}
	}
	return depls[:i]
}

func (in *SvcService) castServiceOverview(s *v1.Service, deployments []v1beta1.Deployment) models.ServiceOverview {
	hasSideCar := hasIstioSideCar(deployments)
	health := in.health.getServiceHealthFromDeployments(s.Namespace, s.Name, deployments)
	return models.ServiceOverview{
		Name:         s.Name,
		IstioSidecar: hasSideCar,
		Health:       health}
}

func hasIstioSideCar(deployments []v1beta1.Deployment) bool {
	for _, deployment := range deployments {
		if deployment.Spec.Template.Annotations != nil {
			if _, exists := deployment.Spec.Template.Annotations[config.Get().IstioSidecarAnnotation]; exists {
				return true
			}
		}
	}
	return false
}

// processRequestCounters aggregates requests counts from metrics fetched from Prometheus,
// calculates error rates for each service and stores the result in the service list.
func processRequestCounters(services []models.ServiceOverview, requestCounters *prometheus.MetricsVector) {
	// First, aggregate request counters (both in and out)
	for _, sample := range requestCounters.Vector {
		serviceDst := strings.SplitN(string(sample.Metric["destination_service"]), ".", 2)[0]
		serviceSrc := strings.SplitN(string(sample.Metric["source_service"]), ".", 2)[0]
		servicesFound := 0

		for idx := range services {
			service := &services[idx]
			if service.Name == serviceDst || service.Name == serviceSrc {
				servicesFound++
				responseCode := sample.Metric["response_code"][0]

				service.RequestCount += sample.Value
				if responseCode == '5' || responseCode == '4' {
					service.RequestErrorCount += sample.Value
				}

				if servicesFound >= 2 {
					break
				}
			}
		}
	}

	// Then, calculate error rates
	for idx := range services {
		service := &services[idx]
		if service.RequestCount != 0 {
			service.ErrorRate = service.RequestErrorCount / service.RequestCount
		} else {
			service.ErrorRate = 0
		}
	}
}

// GetService returns a single service
func (in *SvcService) GetService(namespace, service string) (*models.Service, error) {
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, err
	}

	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, err
	}

	prometheusDetails, err := in.prom.GetSourceServices(namespace, service)
	if err != nil {
		return nil, err
	}

	health := in.health.getServiceHealthFromDeployments(namespace, service, serviceDetails.Deployments.Items)

	s := models.Service{
		Namespace: models.Namespace{Name: namespace},
		Name:      service,
		Health:    health}
	s.SetServiceDetails(serviceDetails, istioDetails, prometheusDetails)
	return &s, nil
}
