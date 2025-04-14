package business

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

// HealthService deals with fetching health from various sources and convert to kiali model
type HealthService struct {
	businessLayer *Layer
	conf          *config.Config
	prom          prometheus.ClientInterface
	userClients   map[string]kubernetes.UserClientInterface
}

type NamespaceHealthCriteria struct {
	IncludeMetrics bool
	Namespace      string
	Cluster        string
	QueryTime      time.Time
	RateInterval   string
}

// Annotation Filter for Health
var HealthAnnotation = []models.AnnotationKey{models.RateHealthAnnotation}

// GetServiceHealth returns a service health (service request error rate)
func (in *HealthService) GetServiceHealth(ctx context.Context, namespace, cluster, service, rateInterval string, queryTime time.Time, svc *models.Service) (models.ServiceHealth, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetServiceHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	rqHealth, err := in.getServiceRequestsHealth(namespace, cluster, service, rateInterval, queryTime, svc)
	return models.ServiceHealth{Requests: rqHealth}, err
}

// GetAppHealth returns an app health from just Namespace and app name (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetAppHealth(ctx context.Context, namespace, cluster, app, rateInterval string, queryTime time.Time, appD *appDetails) (models.AppHealth, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetAppHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("cluster", cluster),
		observability.Attribute("app", app),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	return in.getAppHealth(namespace, cluster, app, rateInterval, queryTime, appD.Workloads)
}

func (in *HealthService) getAppHealth(namespace, cluster, app, rateInterval string, queryTime time.Time, ws models.Workloads) (models.AppHealth, error) {
	health := models.EmptyAppHealth()

	// Perf: do not bother fetching request rate if there are no workloads or no workload has sidecar
	hasSidecar := false
	for _, w := range ws {
		if w.IstioSidecar || w.IsGateway() {
			hasSidecar = true
			break
		}
	}

	// Fetch services requests rates
	var errRate error
	if hasSidecar {
		rate, err := in.getAppRequestsHealth(namespace, cluster, app, rateInterval, queryTime)
		health.Requests = rate
		errRate = err
	}

	// Deployment status
	health.WorkloadStatuses = ws.CastWorkloadStatuses()

	return health, errRate
}

// GetWorkloadHealth returns a workload health from just Namespace and workload (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetWorkloadHealth(ctx context.Context, namespace, cluster, workload, rateInterval string, queryTime time.Time, w *models.Workload) (models.WorkloadHealth, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetWorkloadHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("workload", workload),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	// Perf: do not bother fetching request rate if workload has no sidecar
	if !w.IstioSidecar && !w.IsGateway() {
		return models.WorkloadHealth{
			WorkloadStatus: w.CastWorkloadStatus(),
			Requests:       models.NewEmptyRequestHealth(),
		}, nil
	}

	// Add Telemetry info
	rate, err := in.getWorkloadRequestsHealth(namespace, cluster, workload, rateInterval, queryTime, w)
	return models.WorkloadHealth{
		WorkloadStatus: w.CastWorkloadStatus(),
		Requests:       rate,
	}, err
}

// GetNamespaceAppHealth returns a health for all apps in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceAppHealth(ctx context.Context, criteria NamespaceHealthCriteria) (models.NamespaceAppHealth, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespaceAppHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	cluster := criteria.Cluster

	if _, ok := in.userClients[cluster]; !ok {
		return nil, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	appEntities, err := in.businessLayer.App.fetchNamespaceApps(ctx, criteria.Namespace, cluster, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceAppHealth(appEntities, criteria)
}

func (in *HealthService) getNamespaceAppHealth(appEntities namespaceApps, criteria NamespaceHealthCriteria) (models.NamespaceAppHealth, error) {
	namespace := criteria.Namespace
	queryTime := criteria.QueryTime
	rateInterval := criteria.RateInterval
	cluster := criteria.Cluster
	allHealth := make(models.NamespaceAppHealth)

	// Perf: do not bother fetching request rate if no workloads or no workload has sidecar
	sidecarPresent := false
	var appSidecars = make(map[string]bool)

	// Prepare all data
	for app, entities := range appEntities {
		if app != "" {
			h := models.EmptyAppHealth()
			allHealth[app] = &h
			if entities != nil {
				h.WorkloadStatuses = entities.Workloads.CastWorkloadStatuses()
				for _, w := range entities.Workloads {
					if w.IstioSidecar || w.IsGateway() {
						sidecarPresent = true
						appSidecars[app] = true
						break
					}
				}
			}
		}
	}

	if sidecarPresent && criteria.IncludeMetrics {
		// Fetch services requests rates
		rates, err := in.prom.GetAllRequestRates(namespace, cluster, rateInterval, queryTime)
		if err != nil {
			return allHealth, errors.NewServiceUnavailable(err.Error())
		}
		// Fill with collected request rates
		fillAppRequestRates(allHealth, rates, appSidecars)
	}

	return allHealth, nil
}

// GetNamespaceServiceHealth returns a health for all services in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceServiceHealth(ctx context.Context, criteria NamespaceHealthCriteria) (models.NamespaceServiceHealth, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespaceServiceHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("cluster", criteria.Cluster),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	namespace := criteria.Namespace
	cluster := criteria.Cluster

	if _, ok := in.userClients[cluster]; !ok {
		return nil, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	var services *models.ServiceList
	var err error

	svcCriteria := ServiceCriteria{
		Cluster:                cluster,
		Namespace:              namespace,
		IncludeHealth:          false,
		IncludeIstioResources:  false,
		IncludeOnlyDefinitions: true,
	}
	services, err = in.businessLayer.Svc.GetServiceList(ctx, svcCriteria)
	if err != nil {
		return nil, err
	}
	return in.getNamespaceServiceHealth(services, criteria), nil
}

func (in *HealthService) getNamespaceServiceHealth(services *models.ServiceList, criteria NamespaceHealthCriteria) models.NamespaceServiceHealth {
	namespace := criteria.Namespace
	queryTime := criteria.QueryTime
	rateInterval := criteria.RateInterval
	cluster := criteria.Cluster

	allHealth := make(models.NamespaceServiceHealth)

	// Prepare all data (note that it's important to provide data for all services, even those which may not have any health, for overview cards)
	if services != nil {
		for _, service := range services.Services {
			h := models.EmptyServiceHealth()
			h.Requests.HealthAnnotations = service.HealthAnnotations
			allHealth[service.Name] = &h
		}
	}

	if criteria.IncludeMetrics {
		// Fetch services requests rates
		rates, _ := in.prom.GetNamespaceServicesRequestRates(namespace, cluster, rateInterval, queryTime)
		// Fill with collected request rates
		lblDestSvc := model.LabelName("destination_service_name")
		for _, sample := range rates {
			service := string(sample.Metric[lblDestSvc])
			if health, ok := allHealth[service]; ok {
				health.Requests.AggregateInbound(sample)
			}
		}
		for _, health := range allHealth {
			health.Requests.CombineReporters()
		}
	}
	return allHealth
}

// GetNamespaceWorkloadHealth returns a health for all workloads in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceWorkloadHealth(ctx context.Context, criteria NamespaceHealthCriteria) (models.NamespaceWorkloadHealth, error) {
	namespace := criteria.Namespace
	rateInterval := criteria.RateInterval
	queryTime := criteria.QueryTime
	cluster := criteria.Cluster
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespaceWorkloadHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("cluster", cluster),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	if _, ok := in.userClients[cluster]; !ok {
		return nil, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	wl, err := in.businessLayer.Workload.fetchWorkloadsFromCluster(ctx, cluster, namespace, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceWorkloadHealth(wl, criteria)
}

func (in *HealthService) getNamespaceWorkloadHealth(ws models.Workloads, criteria NamespaceHealthCriteria) (models.NamespaceWorkloadHealth, error) {
	// Perf: do not bother fetching request rate if no workloads or no workload has sidecar
	hasSidecar := false
	namespace := criteria.Namespace
	rateInterval := criteria.RateInterval
	queryTime := criteria.QueryTime
	cluster := criteria.Cluster
	var wlSidecars = make(map[string]bool)

	allHealth := make(models.NamespaceWorkloadHealth)
	for _, w := range ws {
		allHealth[w.Name] = models.EmptyWorkloadHealth()
		allHealth[w.Name].Requests.HealthAnnotations = models.GetHealthAnnotation(w.HealthAnnotations, HealthAnnotation)
		allHealth[w.Name].WorkloadStatus = w.CastWorkloadStatus()
		if w.IstioSidecar || w.IsGateway() {
			hasSidecar = true
			wlSidecars[w.Name] = true
		}
	}

	if hasSidecar && criteria.IncludeMetrics {
		// Fetch services requests rates
		rates, err := in.prom.GetAllRequestRates(namespace, cluster, rateInterval, queryTime)
		if err != nil {
			return allHealth, errors.NewServiceUnavailable(err.Error())
		}
		// Fill with collected request rates
		fillWorkloadRequestRates(allHealth, rates, wlSidecars)
	}

	return allHealth, nil
}

// fillAppRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillAppRequestRates(allHealth models.NamespaceAppHealth, rates model.Vector, appSidecars map[string]bool) {
	lblDest := model.LabelName("destination_canonical_service")
	lblSrc := model.LabelName("source_canonical_service")

	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		// include requests only to apps which have a sidecar
		if _, ok := appSidecars[name]; ok {
			if health, ok := allHealth[name]; ok {
				health.Requests.AggregateInbound(sample)
			}
			name = string(sample.Metric[lblSrc])
			if health, ok := allHealth[name]; ok {
				health.Requests.AggregateOutbound(sample)
			}
		}
	}
	for _, health := range allHealth {
		health.Requests.CombineReporters()
	}
}

// fillWorkloadRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillWorkloadRequestRates(allHealth models.NamespaceWorkloadHealth, rates model.Vector, wlSidecars map[string]bool) {
	lblDest := model.LabelName("destination_workload")
	lblSrc := model.LabelName("source_workload")
	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		// include requests only to workloads which have a sidecar
		if _, ok := wlSidecars[name]; ok {
			if health, ok := allHealth[name]; ok {
				health.Requests.AggregateInbound(sample)
			}
			name = string(sample.Metric[lblSrc])
			if health, ok := allHealth[name]; ok {
				health.Requests.AggregateOutbound(sample)
			}
		}
	}
	for _, health := range allHealth {
		health.Requests.CombineReporters()
	}
}

func (in *HealthService) getServiceRequestsHealth(namespace, cluster, service, rateInterval string, queryTime time.Time, svc *models.Service) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	if svc.Type == "External" {
		// ServiceEntry from Istio Registry
		// Telemetry doesn't collect a namespace
		namespace = "unknown"
	}
	inbound, err := in.prom.GetServiceRequestRates(namespace, cluster, service, rateInterval, queryTime)
	if err != nil {
		return rqHealth, errors.NewServiceUnavailable(err.Error())
	}
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	rqHealth.HealthAnnotations = svc.HealthAnnotations
	rqHealth.CombineReporters()
	return rqHealth, nil
}

func (in *HealthService) getAppRequestsHealth(namespace, cluster, app, rateInterval string, queryTime time.Time) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()

	inbound, outbound, err := in.prom.GetAppRequestRates(namespace, cluster, app, rateInterval, queryTime)
	if err != nil {
		return rqHealth, errors.NewServiceUnavailable(err.Error())
	}
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	for _, sample := range outbound {
		rqHealth.AggregateOutbound(sample)
	}
	rqHealth.CombineReporters()
	return rqHealth, nil
}

func (in *HealthService) getWorkloadRequestsHealth(namespace, cluster, workload, rateInterval string, queryTime time.Time, w *models.Workload) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	// @TODO include w.Cluster into query
	inbound, outbound, err := in.prom.GetWorkloadRequestRates(namespace, cluster, workload, rateInterval, queryTime)
	if err != nil {
		return rqHealth, err
	}
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	for _, sample := range outbound {
		rqHealth.AggregateOutbound(sample)
	}
	if len(w.Pods) > 0 {
		rqHealth.HealthAnnotations = models.GetHealthAnnotation(w.HealthAnnotations, HealthAnnotation)
	}
	rqHealth.CombineReporters()
	return rqHealth, err
}
