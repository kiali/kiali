package business

import (
	"sync"

	"github.com/prometheus/common/model"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"

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
func (in *HealthService) GetServiceHealth(namespace, service, rateInterval string) (*models.ServiceHealth, error) {
	svc, err := in.k8s.GetService(namespace, service)
	if err != nil {
		return nil, err
	}
	h := in.getServiceHealth(namespace, service, rateInterval, svc)
	return &h, nil
}

func (in *HealthService) getServiceHealth(namespace, service, rateInterval string, svc *v1.Service) models.ServiceHealth {
	var envoyHealth prometheus.EnvoyServiceHealth
	var ports []int32
	for _, port := range svc.Spec.Ports {
		ports = append(ports, port.Port)
	}
	envoyHealth, _ = in.prom.GetServiceHealth(namespace, service, ports)
	rqHealth := in.getServiceRequestsHealth(namespace, service, rateInterval)
	return models.ServiceHealth{
		Envoy:    envoyHealth,
		Requests: rqHealth,
	}
}

// GetAppHealth returns an app health from just Namespace and app name (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetAppHealth(namespace, app, rateInterval string) (*models.AppHealth, error) {
	details, err := in.k8s.GetAppDetails(namespace, app)
	if err != nil {
		return nil, err
	}
	h := in.getAppHealth(namespace, app, rateInterval, details)
	return &h, nil
}

func (in *HealthService) getAppHealth(namespace, app, rateInterval string, details kubernetes.AppDetails) models.AppHealth {
	health := models.EmptyAppHealth()

	var wg sync.WaitGroup
	wg.Add(len(details.Services))

	for _, service := range details.Services {
		go func(service v1.Service) {
			defer wg.Done()
			var ports []int32
			for _, port := range service.Spec.Ports {
				ports = append(ports, port.Port)
			}
			envoy, _ := in.prom.GetServiceHealth(namespace, service.Name, ports)
			health.Envoy = append(health.Envoy, models.EnvoyHealthWrapper{
				Service:            service.Name,
				EnvoyServiceHealth: envoy,
			})
		}(service)
	}

	// Fetch services requests rates
	health.Requests = in.getAppRequestsHealth(namespace, app, rateInterval)

	// Deployment status
	health.DeploymentStatuses = castDeploymentsStatuses(details.Deployments)

	wg.Wait()
	return health
}

// GetWorkloadHealth returns a workload health from just Namespace and workload (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetWorkloadHealth(namespace, workload, rateInterval string) (*models.WorkloadHealth, error) {
	// Fill all parts
	health := models.WorkloadHealth{}
	deployment, err := in.k8s.GetDeployment(namespace, workload)
	if err != nil {
		return nil, err
	}
	health.DeploymentStatus = models.DeploymentStatus{
		Name:              deployment.Name,
		Replicas:          deployment.Status.Replicas,
		AvailableReplicas: deployment.Status.AvailableReplicas}
	health.Requests = in.getWorkloadRequestsHealth(namespace, workload, rateInterval)
	return &health, nil
}

// GetNamespaceAppHealth returns a health for all apps in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceAppHealth(namespace, rateInterval string) (models.NamespaceAppHealth, error) {
	appEntities, err := in.k8s.GetNamespaceAppsDetails(namespace)
	if err != nil {
		return nil, err
	}
	return in.getNamespaceAppHealth(namespace, appEntities, rateInterval), nil
}

func (in *HealthService) getNamespaceAppHealth(namespace string, appEntities kubernetes.NamespaceApps, rateInterval string) models.NamespaceAppHealth {
	allHealth := make(models.NamespaceAppHealth)

	// Prepare all data
	for app := range appEntities {
		if app != "" {
			h := models.EmptyAppHealth()
			allHealth[app] = &h
		}
	}

	// Fetch services requests rates
	rates, _ := in.prom.GetAllRequestRates(namespace, rateInterval)

	// Fill with collected request rates
	fillAppRequestRates(allHealth, rates)

	var wg sync.WaitGroup
	wg.Add(len(allHealth))

	// Finally complete missing health information
	for app, health := range allHealth {
		entities := appEntities[app]
		go func(app string, health *models.AppHealth) {
			defer wg.Done()
			if entities != nil {
				health.DeploymentStatuses = castDeploymentsStatuses(entities.Deployments)
				for _, service := range entities.Services {
					var ports []int32
					for _, port := range service.Spec.Ports {
						ports = append(ports, port.Port)
					}
					envoy, _ := in.prom.GetServiceHealth(namespace, service.Name, ports)
					health.Envoy = append(health.Envoy, models.EnvoyHealthWrapper{
						Service:            service.Name,
						EnvoyServiceHealth: envoy,
					})
				}
			}
		}(app, health)
	}

	wg.Wait()
	return allHealth
}

// GetNamespaceWorkloadHealth returns a health for all workloads in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceWorkloadHealth(namespace, rateInterval string) (models.NamespaceWorkloadHealth, error) {
	depls, err := in.k8s.GetDeployments(namespace, "")
	if err != nil {
		return nil, err
	}
	return in.getNamespaceWorkloadHealth(namespace, depls, rateInterval), nil
}

func (in *HealthService) getNamespaceWorkloadHealth(namespace string, dl *v1beta1.DeploymentList, rateInterval string) models.NamespaceWorkloadHealth {
	allHealth := make(models.NamespaceWorkloadHealth)
	deploymentsMap := make(map[string]v1beta1.Deployment)

	// Prepare all data
	for _, item := range dl.Items {
		allHealth[item.Name] = &models.WorkloadHealth{}
		deploymentsMap[item.Name] = item
	}

	// Fetch services requests rates
	rates, _ := in.prom.GetAllRequestRates(namespace, rateInterval)

	// Fill with collected request rates
	fillWorkloadRequestRates(allHealth, rates)

	var wg sync.WaitGroup
	wg.Add(len(allHealth))

	// Finally complete missing health information
	for workload, health := range allHealth {
		depl, hasDepl := deploymentsMap[workload]
		go func(workload string, health *models.WorkloadHealth) {
			defer wg.Done() // Pod statuses
			if hasDepl {
				health.DeploymentStatus = models.DeploymentStatus{
					Name:              depl.Name,
					Replicas:          depl.Status.Replicas,
					AvailableReplicas: depl.Status.AvailableReplicas}
			}
		}(workload, health)
	}

	wg.Wait()
	return allHealth
}

// fillAppRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillAppRequestRates(allHealth models.NamespaceAppHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_app")
	lblSrc := model.LabelName("source_app")
	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		if health, ok := allHealth[name]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
	}
}

// fillWorkloadRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillWorkloadRequestRates(allHealth models.NamespaceWorkloadHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_workload")
	lblSrc := model.LabelName("source_workload")
	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		if health, ok := allHealth[name]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			sumRequestCounters(&health.Requests, sample)
		}
	}
}

func (in *HealthService) getServiceRequestsHealth(namespace, service, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, _ := in.prom.GetServiceRequestRates(namespace, service, rateInterval)
	for _, sample := range inbound {
		sumRequestCounters(&rqHealth, sample)
	}
	return rqHealth
}

func (in *HealthService) getAppRequestsHealth(namespace, app, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, outbound, _ := in.prom.GetAppRequestRates(namespace, app, rateInterval)
	all := append(inbound, outbound...)
	for _, sample := range all {
		sumRequestCounters(&rqHealth, sample)
	}
	return rqHealth
}

func (in *HealthService) getWorkloadRequestsHealth(namespace, workload, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, outbound, _ := in.prom.GetWorkloadRequestRates(namespace, workload, rateInterval)
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
