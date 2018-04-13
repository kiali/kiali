package business

import (
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

// GetServiceHealth returns a service health from just namespace and service (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetServiceHealth(namespace, service string) models.Health {
	health := models.Health{}

	// Pod status
	details, _ := in.k8s.GetServiceDetails(namespace, service)
	if details != nil {
		health.DeploymentStatuses = castDeploymentsStatuses(&details.Deployments.Items)
	}

	// Envoy health
	healthy, total, _ := in.prom.GetServiceHealth(namespace, service)
	health.Envoy = models.EnvoyHealth{Healthy: healthy, Total: total}
	return health
}

func (in *HealthService) getServiceHealthFromDeployments(namespace, service string, deployments *[]v1beta1.Deployment) models.Health {
	statuses := castDeploymentsStatuses(deployments)
	healthy, total, _ := in.prom.GetServiceHealth(namespace, service)
	return models.Health{
		Envoy:              models.EnvoyHealth{Healthy: healthy, Total: total},
		DeploymentStatuses: statuses}
}

func castDeploymentsStatuses(deployments *[]v1beta1.Deployment) []models.DeploymentStatus {
	statuses := make([]models.DeploymentStatus, len(*deployments))
	for i, deployment := range *deployments {
		statuses[i] = models.DeploymentStatus{
			Name:              deployment.Name,
			Replicas:          deployment.Status.Replicas,
			AvailableReplicas: deployment.Status.AvailableReplicas}
	}
	return statuses
}
