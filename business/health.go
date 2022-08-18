package business

import (
	"context"
	"time"

	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

// HealthService deals with fetching health from various sources and convert to kiali model
type HealthService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type NamespaceHealthCriteria struct {
	IncludeMetrics bool
	Namespace      string
	QueryTime      time.Time
	RateInterval   string
}

// Annotation Filter for Health
var HealthAnnotation = []models.AnnotationKey{models.RateHealthAnnotation}

// GetServiceHealth returns a service health (service request error rate)
func (in *HealthService) GetServiceHealth(ctx context.Context, namespace, service, rateInterval string, queryTime time.Time, svc *models.Service) (models.ServiceHealth, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetServiceHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	rqHealth, err := in.getServiceRequestsHealth(namespace, service, rateInterval, queryTime, svc)
	return models.ServiceHealth{Requests: rqHealth}, err
}

// GetAppHealth returns an app health from just Namespace and app name (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetAppHealth(ctx context.Context, namespace, app, rateInterval string, queryTime time.Time, appD *appDetails) (models.AppHealth, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetAppHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("app", app),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	return in.getAppHealth(namespace, app, rateInterval, queryTime, appD.Workloads)
}

func (in *HealthService) getAppHealth(namespace, app, rateInterval string, queryTime time.Time, ws models.Workloads) (models.AppHealth, error) {
	health := models.EmptyAppHealth()

	// Perf: do not bother fetching request rate if there are no workloads or no workload has sidecar
	hasSidecar := false
	for _, w := range ws {
		if w.IstioSidecar {
			hasSidecar = true
			break
		}
	}

	// Fetch services requests rates
	var errRate error
	if hasSidecar {
		rate, err := in.getAppRequestsHealth(namespace, app, rateInterval, queryTime)
		health.Requests = rate
		errRate = err
	}

	// Deployment status
	health.WorkloadStatuses = ws.CastWorkloadStatuses()

	return health, errRate
}

// GetWorkloadHealth returns a workload health from just Namespace and workload (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetWorkloadHealth(ctx context.Context, namespace, workload, rateInterval string, queryTime time.Time, w *models.Workload) (models.WorkloadHealth, error) {
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
	if !w.IstioSidecar {
		return models.WorkloadHealth{
			WorkloadStatus: w.CastWorkloadStatus(),
			Requests:       models.NewEmptyRequestHealth(),
		}, nil
	}

	// Add Telemetry info
	rate, err := in.getWorkloadRequestsHealth(namespace, workload, rateInterval, queryTime, w)
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
		observability.Attribute("namespace", criteria.Namespace),
		observability.Attribute("rateInterval", criteria.RateInterval),
		observability.Attribute("queryTime", criteria.QueryTime),
	)
	defer end()

	appEntities, err := fetchNamespaceApps(ctx, in.businessLayer, criteria.Namespace, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceAppHealth(appEntities, criteria)
}

func (in *HealthService) getNamespaceAppHealth(appEntities namespaceApps, criteria NamespaceHealthCriteria) (models.NamespaceAppHealth, error) {
	namespace := criteria.Namespace
	queryTime := criteria.QueryTime
	rateInterval := criteria.RateInterval
	allHealth := make(models.NamespaceAppHealth)

	// Perf: do not bother fetching request rate if no workloads or no workload has sidecar
	sidecarPresent := false

	// Prepare all data
	for app, entities := range appEntities {
		if app != "" {
			h := models.EmptyAppHealth()
			allHealth[app] = &h
			if entities != nil {
				h.WorkloadStatuses = entities.Workloads.CastWorkloadStatuses()
				for _, w := range entities.Workloads {
					if w.IstioSidecar {
						sidecarPresent = true
						break
					}
				}
			}
		}
	}

	if sidecarPresent && criteria.IncludeMetrics {
		// Fetch services requests rates
		rates, err := in.prom.GetAllRequestRates(namespace, rateInterval, queryTime)
		if err != nil {
			return allHealth, errors.NewServiceUnavailable(err.Error())
		}
		// Fill with collected request rates
		fillAppRequestRates(allHealth, rates)
	}

	return allHealth, nil
}

// GetNamespaceServiceHealth returns a health for all services in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceServiceHealth(ctx context.Context, criteria NamespaceHealthCriteria) (models.NamespaceServiceHealth, error) {
	namespace := criteria.Namespace
	queryTime := criteria.QueryTime
	rateInterval := criteria.RateInterval
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespaceServiceHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	var services *models.ServiceList
	var err error
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return nil, err
	}

	svcCriteria := ServiceCriteria{
		Namespace:              namespace,
		IncludeOnlyDefinitions: true,
		IncludeIstioResources:  false,
		Health:                 false,
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
		rates, _ := in.prom.GetNamespaceServicesRequestRates(namespace, rateInterval, queryTime)
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
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespaceWorkloadHealth",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("rateInterval", rateInterval),
		observability.Attribute("queryTime", queryTime),
	)
	defer end()

	wl, err := fetchWorkloads(ctx, in.businessLayer, namespace, "")
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

	allHealth := make(models.NamespaceWorkloadHealth)
	for _, w := range ws {
		allHealth[w.Name] = models.EmptyWorkloadHealth()
		allHealth[w.Name].Requests.HealthAnnotations = models.GetHealthAnnotation(w.HealthAnnotations, HealthAnnotation)
		allHealth[w.Name].WorkloadStatus = w.CastWorkloadStatus()
		if w.IstioSidecar {
			hasSidecar = true
		}
	}

	if hasSidecar && criteria.IncludeMetrics {
		// Fetch services requests rates
		rates, err := in.prom.GetAllRequestRates(namespace, rateInterval, queryTime)
		if err != nil {
			return allHealth, errors.NewServiceUnavailable(err.Error())
		}
		// Fill with collected request rates
		fillWorkloadRequestRates(allHealth, rates)
	}

	return allHealth, nil
}

// fillAppRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillAppRequestRates(allHealth models.NamespaceAppHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_canonical_service")
	lblSrc := model.LabelName("source_canonical_service")

	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		if health, ok := allHealth[name]; ok {
			health.Requests.AggregateInbound(sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			health.Requests.AggregateOutbound(sample)
		}
	}
	for _, health := range allHealth {
		health.Requests.CombineReporters()
	}
}

// fillWorkloadRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillWorkloadRequestRates(allHealth models.NamespaceWorkloadHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_workload")
	lblSrc := model.LabelName("source_workload")
	for _, sample := range rates {
		name := string(sample.Metric[lblDest])
		if health, ok := allHealth[name]; ok {
			health.Requests.AggregateInbound(sample)
		}
		name = string(sample.Metric[lblSrc])
		if health, ok := allHealth[name]; ok {
			health.Requests.AggregateOutbound(sample)
		}
	}
	for _, health := range allHealth {
		health.Requests.CombineReporters()
	}
}

func (in *HealthService) getServiceRequestsHealth(namespace, service, rateInterval string, queryTime time.Time, svc *models.Service) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	if svc.Type == "External" {
		// ServiceEntry from Istio Registry
		// Telemetry doesn't collect a namespace
		namespace = "unknown"
	}
	inbound, err := in.prom.GetServiceRequestRates(namespace, service, rateInterval, queryTime)
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

func (in *HealthService) getAppRequestsHealth(namespace, app, rateInterval string, queryTime time.Time) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()

	inbound, outbound, err := in.prom.GetAppRequestRates(namespace, app, rateInterval, queryTime)
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

func (in *HealthService) getWorkloadRequestsHealth(namespace, workload, rateInterval string, queryTime time.Time, w *models.Workload) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	inbound, outbound, err := in.prom.GetWorkloadRequestRates(namespace, workload, rateInterval, queryTime)
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
