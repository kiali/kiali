package business

import (
	"strings"
	"sync"

	"github.com/prometheus/common/model"
	"k8s.io/api/apps/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/models"
)

// HealthService deals with fetching health from various sources and convert to kiali model
type HealthService struct {
	prom prometheus.ClientInterface
	k8s  kubernetes.IstioClientInterface
}

// NamespaceHealth is an alias of map of service name x health
type NamespaceHealth map[string]*models.Health

// GetServiceHealth returns a service health from just Namespace and service (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetServiceHealth(namespace, service, rateInterval string) models.Health {
	// Fill all parts
	health := models.Health{}
	in.fillMissingParts(namespace, service, rateInterval, &health)
	return health
}

// GetNamespaceHealth returns a health for all services in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceHealth(namespace, rateInterval string) (NamespaceHealth, error) {
	serviceList, err := in.k8s.GetFullServices(namespace)
	if err != nil {
		return nil, err
	}
	return in.getNamespaceHealth(namespace, serviceList, rateInterval), nil
}

func (in *HealthService) getNamespaceHealth(namespace string, sl *kubernetes.ServiceList, rateInterval string) NamespaceHealth {
	allHealth := make(NamespaceHealth)

	// Extract deployment statuses
	for _, item := range sl.Services.Items {
		sPods := kubernetes.FilterPodsForService(&item, sl.Pods)
		depls := kubernetes.FilterDeploymentsForService(&item, sPods, sl.Deployments)
		statuses := castDeploymentsStatuses(depls)
		allHealth[item.Name] = &models.Health{
			DeploymentStatuses: statuses,
			DeploymentsFetched: true}
	}

	// Fetch services requests rates
	inRates, outRates, _ := in.prom.GetNamespaceServicesRequestRates(namespace, rateInterval)

	// Fill with collected request rates
	// Note: we must match each service with inRates and outRates separately, else we would generate duplicates
	fillRequestRates(allHealth, inRates, outRates)

	var wg sync.WaitGroup
	wg.Add(len(allHealth))

	// Finally complete missing health information
	for s, h := range allHealth {
		service, health := s, h
		go func() {
			defer wg.Done()
			// rateinterval not necessary here since we already fetched the request rates
			in.fillMissingParts(namespace, service, "", health)
		}()
	}

	wg.Wait()

	return allHealth
}

// fillRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillRequestRates(allHealth NamespaceHealth, inRates, outRates model.Vector) {
	// Inbound
	for _, sample := range inRates {
		serviceName := strings.SplitN(string(sample.Metric["destination_service"]), ".", 2)[0]
		if health, ok := allHealth[serviceName]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
	}
	// Outbound
	for _, sample := range outRates {
		serviceName := strings.SplitN(string(sample.Metric["source_service"]), ".", 2)[0]
		if health, ok := allHealth[serviceName]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
	}
	// Mark all as fetched
	for _, health := range allHealth {
		health.Requests.Fetched = true
	}
}

func (in *HealthService) fillMissingParts(namespace, service, rateInterval string, health *models.Health) {
	// Pod statuses
	health.FillDeploymentStatusesIfMissing(func() []models.DeploymentStatus {
		details, _ := in.k8s.GetServiceDetails(namespace, service)
		if details != nil {
			return castDeploymentsStatuses(details.Deployments.Items)
		}
		return []models.DeploymentStatus{}
	})

	// Envoy health
	health.Envoy.FillIfMissing(func() prometheus.EnvoyHealth {
		health, _ := in.prom.GetServiceHealth(namespace, service)
		return health
	})

	// Request errors
	health.Requests.FillIfMissing(func() (float64, float64) {
		rqHealth := in.getRequestsHealth(namespace, service, rateInterval)
		return rqHealth.RequestErrorCount, rqHealth.RequestCount
	})
}

func (in *HealthService) getRequestsHealth(namespace, service, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, outbound, _ := in.prom.GetServiceRequestRates(namespace, service, rateInterval)
	all := append(inbound, outbound...)
	for _, sample := range all {
		sumRequestCounters(&rqHealth, sample)
	}
	return rqHealth
}

func sumRequestCounters(rqHealth *models.RequestHealth, sample *model.Sample) {
	rqHealth.RequestCount += float64(sample.Value)
	responseCode := sample.Metric["response_code"][0]
	if responseCode == '5' || responseCode == '4' {
		rqHealth.RequestErrorCount += float64(sample.Value)
	}
}

func castDeploymentsStatuses(deployments []v1beta1.Deployment) []models.DeploymentStatus {
	statuses := make([]models.DeploymentStatus, len(deployments))
	for i, deployment := range deployments {
		statuses[i] = models.DeploymentStatus{
			Name:              deployment.Name,
			Replicas:          deployment.Status.Replicas,
			AvailableReplicas: deployment.Status.AvailableReplicas}
	}
	return statuses
}
