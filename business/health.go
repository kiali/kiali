package business

import (
	"sync"

	"github.com/prometheus/common/model"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
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
	var services []v1.Service
	var ws models.Workloads

	appLabel := config.Get().IstioLabels.AppLabelName

	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	selectorLabels := make(map[string]string)
	selectorLabels[appLabel] = app
	labelSelector := labels.FormatLabels(selectorLabels)

	go func() {
		defer wg.Done()
		var err error
		services, err = in.k8s.GetServices(namespace, selectorLabels)
		if err != nil {
			log.Errorf("Error fetching Services per namespace %s and app %s: %s", namespace, app, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		ws, err = fetchWorkloads(in.k8s, namespace, labelSelector)
		if err != nil {
			log.Errorf("Error fetching Workloads per namespace %s and app %s: %s", namespace, app, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return nil, err
	}

	h := in.getAppHealth(namespace, app, rateInterval, services, ws)
	return &h, nil
}

func (in *HealthService) getAppHealth(namespace, app, rateInterval string, services []v1.Service, ws models.Workloads) models.AppHealth {
	health := models.EmptyAppHealth()

	var wg sync.WaitGroup
	wg.Add(len(services))

	for _, service := range services {
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
	health.WorkloadStatuses = castWorkloadStatuses(ws)

	wg.Wait()
	return health
}

// GetWorkloadHealth returns a workload health from just Namespace and workload (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetWorkloadHealth(namespace, workload, rateInterval string) (*models.WorkloadHealth, error) {
	// Fill all parts
	health := models.WorkloadHealth{}
	w, err := fetchWorkload(in.k8s, namespace, workload)
	if err != nil {
		return nil, err
	}
	health.WorkloadStatus = models.WorkloadStatus{
		Name:              w.Name,
		Replicas:          w.Replicas,
		AvailableReplicas: w.AvailableReplicas}

	health.Requests = in.getWorkloadRequestsHealth(namespace, workload, rateInterval)
	return &health, nil
}

// GetNamespaceAppHealth returns a health for all apps in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceAppHealth(namespace, rateInterval string) (models.NamespaceAppHealth, error) {
	appEntities, err := fetchNamespaceApps(in.k8s, namespace, "")
	if err != nil {
		return nil, err
	}
	return in.getNamespaceAppHealth(namespace, appEntities, rateInterval), nil
}

func (in *HealthService) getNamespaceAppHealth(namespace string, appEntities namespaceApps, rateInterval string) models.NamespaceAppHealth {
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
		go func(app string, health *models.AppHealth, entities *appDetails) {
			defer wg.Done()
			if entities != nil {
				health.WorkloadStatuses = castWorkloadStatuses(entities.Workloads)
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
		}(app, health, appEntities[app])
	}

	wg.Wait()
	return allHealth
}

// GetNamespaceServiceHealth returns a health for all services in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceServiceHealth(namespace, rateInterval string) (models.NamespaceServiceHealth, error) {
	services, err := in.k8s.GetServices(namespace, nil)
	if err != nil {
		return nil, err
	}
	return in.getNamespaceServiceHealth(namespace, services, rateInterval), nil
}

func (in *HealthService) getNamespaceServiceHealth(namespace string, services []v1.Service, rateInterval string) models.NamespaceServiceHealth {
	allHealth := make(models.NamespaceServiceHealth)

	// Prepare all data
	for _, service := range services {
		h := models.ServiceHealth{}
		allHealth[service.Name] = &h
	}

	// Fetch services requests rates
	rates, _ := in.prom.GetNamespaceServicesRequestRates(namespace, rateInterval)

	// Fill with collected request rates
	fillServiceRequestRates(allHealth, rates)

	var wg sync.WaitGroup
	wg.Add(len(allHealth))

	// Finally complete missing health information
	for _, service := range services {
		health := allHealth[service.Name]
		go func(service v1.Service, health *models.ServiceHealth) {
			defer wg.Done()
			var ports []int32
			for _, port := range service.Spec.Ports {
				ports = append(ports, port.Port)
			}
			health.Envoy, _ = in.prom.GetServiceHealth(namespace, service.Name, ports)
		}(service, health)
	}

	wg.Wait()
	return allHealth
}

// GetNamespaceWorkloadHealth returns a health for all workloads in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceWorkloadHealth(namespace, rateInterval string) (models.NamespaceWorkloadHealth, error) {
	wl, err := fetchWorkloads(in.k8s, namespace, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceWorkloadHealth(namespace, wl, rateInterval), nil
}

func (in *HealthService) getNamespaceWorkloadHealth(namespace string, ws models.Workloads, rateInterval string) models.NamespaceWorkloadHealth {
	allHealth := make(models.NamespaceWorkloadHealth)
	for _, w := range ws {
		allHealth[w.Name] = &models.WorkloadHealth{}
		allHealth[w.Name].WorkloadStatus = models.WorkloadStatus{
			Name:              w.Name,
			Replicas:          w.Replicas,
			AvailableReplicas: w.AvailableReplicas,
		}
	}

	// Fetch services requests rates
	rates, _ := in.prom.GetAllRequestRates(namespace, rateInterval)

	// Fill with collected request rates
	fillWorkloadRequestRates(allHealth, rates)

	return allHealth
}

// fillAppRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillAppRequestRates(allHealth models.NamespaceAppHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_app")
	lblSrc := model.LabelName("source_app")
	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		if health, ok := allHealth[name]; ok {
			health.Requests.Aggregate(sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			health.Requests.Aggregate(sample)
		}
	}
}

// fillServiceRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
// note that these are source-reported metrics, which loses certain requests (like from unknown) but has the health advantage of including source-reported failures
func fillServiceRequestRates(allHealth models.NamespaceServiceHealth, rates model.Vector) {
	lblDestSvc := model.LabelName("destination_service_name")
	for _, sample := range rates {
		service := string(sample.Metric[lblDestSvc])
		if health, ok := allHealth[service]; ok {
			health.Requests.Aggregate(sample)
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
			health.Requests.Aggregate(sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			health.Requests.Aggregate(sample)
		}
	}
}

func (in *HealthService) getServiceRequestsHealth(namespace, service, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, _ := in.prom.GetServiceRequestRates(namespace, service, rateInterval)
	for _, sample := range inbound {
		rqHealth.Aggregate(sample)
	}
	return rqHealth
}

func (in *HealthService) getAppRequestsHealth(namespace, app, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, outbound, _ := in.prom.GetAppRequestRates(namespace, app, rateInterval)
	all := append(inbound, outbound...)
	for _, sample := range all {
		rqHealth.Aggregate(sample)
	}
	return rqHealth
}

func (in *HealthService) getWorkloadRequestsHealth(namespace, workload, rateInterval string) models.RequestHealth {
	rqHealth := models.RequestHealth{}
	inbound, outbound, _ := in.prom.GetWorkloadRequestRates(namespace, workload, rateInterval)
	all := append(inbound, outbound...)
	for _, sample := range all {
		rqHealth.Aggregate(sample)
	}
	return rqHealth
}

func castWorkloadStatuses(ws models.Workloads) []models.WorkloadStatus {
	statuses := make([]models.WorkloadStatus, 0)
	for _, w := range ws {
		status := models.WorkloadStatus{
			Name:              w.Name,
			Replicas:          w.Replicas,
			AvailableReplicas: w.AvailableReplicas}
		statuses = append(statuses, status)

	}
	return statuses
}
