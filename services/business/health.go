package business

import (
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

// GetServiceHealth returns a service health from just Namespace and service (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetServiceHealth(namespace, service, rateInterval string) models.Health {
	// Fill all parts
	health := models.Health{}
	in.fillMissingParts(namespace, service, rateInterval, &health)
	return health
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
	health.Envoy.FillIfMissing(func() (int, int) {
		healthy, total, _ := in.prom.GetServiceHealth(namespace, service)
		return healthy, total
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
		sumRequestCounters(service, &rqHealth, sample)
	}
	return rqHealth
}

func sumRequestCounters(toRemoveServiceName string, rqHealth *models.RequestHealth, sample *model.Sample) {
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
