package business

import (
	"time"

	"github.com/prometheus/common/model"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/status"
)

// HealthService deals with fetching health from various sources and convert to kiali model
type HealthService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

// GetServiceHealth returns a service health (service request error rate)
func (in *HealthService) GetServiceHealth(namespace, service, rateInterval string, queryTime time.Time) (models.ServiceHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetServiceHealth")
	defer promtimer.ObserveNow(&err)

	rqHealth, err := in.getServiceRequestsHealth(namespace, service, rateInterval, queryTime)
	return models.ServiceHealth{Requests: rqHealth}, err
}

// GetAppHealth returns an app health from just Namespace and app name (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetAppHealth(namespace, app, rateInterval string, queryTime time.Time) (models.AppHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetAppHealth")
	defer promtimer.ObserveNow(&err)

	appLabel := config.Get().IstioLabels.AppLabelName

	selectorLabels := make(map[string]string)
	selectorLabels[appLabel] = app
	labelSelector := labels.FormatLabels(selectorLabels)

	ws, err := fetchWorkloads(in.businessLayer, namespace, labelSelector)
	if err != nil {
		log.Errorf("Error fetching Workloads per namespace %s and app %s: %s", namespace, app, err)
		return models.AppHealth{}, err
	}

	return in.getAppHealth(namespace, app, rateInterval, queryTime, ws)
}

func (in *HealthService) getAppHealth(namespace, app, rateInterval string, queryTime time.Time, ws models.Workloads) (models.AppHealth, error) {
	health := models.EmptyAppHealth()
	wsNames := make([]string, 0, len(ws))

	// Perf: do not bother fetching request rate if there are no workloads or no workload has sidecar
	hasSidecar := false
	for _, w := range ws {
		if w.IstioSidecar {
			wsNames = append(wsNames, w.Name)
			hasSidecar = true
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

	// Proxy status
	if hasSidecar {
		proxyStatuses, errProxy := in.businessLayer.ProxyStatus.GetWorkloadsProxyStatus(namespace, wsNames)
		if errProxy != nil {
			errRate = errProxy
		}

		fillAppProxyStatus(health, proxyStatuses)
	}

	return health, errRate
}

// GetWorkloadHealth returns a workload health from just Namespace and workload (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetWorkloadHealth(namespace, workload, workloadType, rateInterval string, queryTime time.Time) (models.WorkloadHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetWorkloadHealth")
	defer promtimer.ObserveNow(&err)

	w, err := fetchWorkload(in.businessLayer, namespace, workload, workloadType)
	if err != nil {
		return models.WorkloadHealth{}, err
	}
	status := &models.WorkloadStatus{
		Name:              w.Name,
		DesiredReplicas:   w.DesiredReplicas,
		CurrentReplicas:   w.CurrentReplicas,
		AvailableReplicas: w.AvailableReplicas,
	}

	// Perf: do not bother fetching request rate if workload has no sidecar
	if !w.IstioSidecar {
		return models.WorkloadHealth{
			WorkloadStatus: status,
			Requests:       models.NewEmptyRequestHealth(),
		}, nil
	}

	// Add Proxy Status info
	status.SyncedProxies, err = in.businessLayer.ProxyStatus.GetWorkloadProxyStatus(workload, namespace)
	if err != nil {
		return models.WorkloadHealth{
			WorkloadStatus: status,
			Requests:       models.NewEmptyRequestHealth(),
		}, err
	}

	// Add Telemetry info
	rate, err := in.getWorkloadRequestsHealth(namespace, workload, rateInterval, queryTime)
	return models.WorkloadHealth{
		WorkloadStatus: status,
		Requests:       rate,
	}, err
}

// GetNamespaceAppHealth returns a health for all apps in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceAppHealth(namespace, rateInterval string, queryTime time.Time) (models.NamespaceAppHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetNamespaceAppHealth")
	defer promtimer.ObserveNow(&err)

	appEntities, err := fetchNamespaceApps(in.businessLayer, namespace, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceAppHealth(namespace, appEntities, rateInterval, queryTime)
}

func (in *HealthService) getNamespaceAppHealth(namespace string, appEntities namespaceApps, rateInterval string, queryTime time.Time) (models.NamespaceAppHealth, error) {
	allHealth := make(models.NamespaceAppHealth)
	wsNames := make([]string, 0)

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
						wsNames = append(wsNames, w.Name)
						sidecarPresent = true
					}
				}
			}
		}
	}

	var errRate error
	if sidecarPresent {
		// Fetch services requests rates
		rates, err := in.prom.GetAllRequestRates(namespace, rateInterval, queryTime)
		errRate = err
		// Fill with collected request rates
		fillAppRequestRates(allHealth, rates)

		// Add Proxy Statuses
		proxyStatuses, errProxy := in.businessLayer.ProxyStatus.GetWorkloadsProxyStatus(namespace, wsNames)
		if errProxy != nil {
			errRate = errProxy
		}

		fillNamespaceAppProxyStatus(allHealth, proxyStatuses)
	}

	return allHealth, errRate
}

// GetNamespaceServiceHealth returns a health for all services in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceServiceHealth(namespace, rateInterval string, queryTime time.Time) (models.NamespaceServiceHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetNamespaceServiceHealth")
	defer promtimer.ObserveNow(&err)
	var services []core_v1.Service

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	// Check if namespace is cached
	if IsNamespaceCached(namespace) {
		services, err = kialiCache.GetServices(namespace, nil)
	} else {
		services, err = in.k8s.GetServices(namespace, nil)
	}
	if err != nil {
		return nil, err
	}
	return in.getNamespaceServiceHealth(namespace, services, rateInterval, queryTime), nil
}

func (in *HealthService) getNamespaceServiceHealth(namespace string, services []core_v1.Service, rateInterval string, queryTime time.Time) models.NamespaceServiceHealth {
	allHealth := make(models.NamespaceServiceHealth)

	// Prepare all data (note that it's important to provide data for all services, even those which may not have any health, for overview cards)
	for _, service := range services {
		h := models.EmptyServiceHealth()
		allHealth[service.Name] = &h
	}

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

	return allHealth
}

// GetNamespaceWorkloadHealth returns a health for all workloads in given Namespace (thus, it fetches data from K8S and Prometheus)
func (in *HealthService) GetNamespaceWorkloadHealth(namespace, rateInterval string, queryTime time.Time) (models.NamespaceWorkloadHealth, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "HealthService", "GetNamespaceWorkloadHealth")
	defer promtimer.ObserveNow(&err)

	wl, err := fetchWorkloads(in.businessLayer, namespace, "")
	if err != nil {
		return nil, err
	}

	return in.getNamespaceWorkloadHealth(namespace, wl, rateInterval, queryTime)
}

func (in *HealthService) getNamespaceWorkloadHealth(namespace string, ws models.Workloads, rateInterval string, queryTime time.Time) (models.NamespaceWorkloadHealth, error) {
	// Perf: do not bother fetching request rate if no workloads or no workload has sidecar
	hasSidecar := false

	allHealth := make(models.NamespaceWorkloadHealth)
	wsNames := make([]string, 0)
	for _, w := range ws {
		allHealth[w.Name] = models.EmptyWorkloadHealth()
		allHealth[w.Name].WorkloadStatus = &models.WorkloadStatus{
			Name:              w.Name,
			DesiredReplicas:   w.DesiredReplicas,
			CurrentReplicas:   w.CurrentReplicas,
			AvailableReplicas: w.AvailableReplicas,
		}
		if w.IstioSidecar {
			wsNames = append(wsNames, w.Name)
			hasSidecar = true
		}
	}

	var err error
	if hasSidecar {
		// Fetch services requests rates
		var rates model.Vector
		rates, err = in.prom.GetAllRequestRates(namespace, rateInterval, queryTime)
		// Fill with collected request rates
		fillWorkloadRequestRates(allHealth, rates)

		// Fetch Proxy statuses
		proxyStatuses, errProxy := in.businessLayer.ProxyStatus.GetWorkloadsProxyStatus(namespace, wsNames)
		if errProxy != nil {
			err = errProxy
		}

		fillNamespaceWorkloadProxyStatus(allHealth, proxyStatuses)
	}

	return allHealth, err
}

// fillAppRequestRates aggregates requests rates from metrics fetched from Prometheus, and stores the result in the health map.
func fillAppRequestRates(allHealth models.NamespaceAppHealth, rates model.Vector) {
	lblDest := model.LabelName("destination_app")
	lblSrc := model.LabelName("source_app")
	if status.AreCanonicalMetricsAvailable() {
		lblDest = model.LabelName("destination_canonical_service")
		lblSrc = model.LabelName("source_canonical_service")
	}

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
}

// fillAppProxyStatus fills the App health with the proxy status of each workload
func fillAppProxyStatus(allHealth models.AppHealth, proxyStatuses map[string]int32) {
	for _, ws := range allHealth.WorkloadStatuses {
		ws.SyncedProxies = proxyStatuses[ws.Name]
	}
}

// fillNamespaceAppProxyStatus fills each AppHealth with the proxy status of each workload
func fillNamespaceAppProxyStatus(allHealth models.NamespaceAppHealth, proxyStatuses map[string]int32) {
	for _, appHealth := range allHealth {
		fillAppProxyStatus(*appHealth, proxyStatuses)
	}
}

// fillNamespaceWorkloadProxyStatus fills each WorkloadHealth with the proxy status of its workload
func fillNamespaceWorkloadProxyStatus(allHealth models.NamespaceWorkloadHealth, proxyStatuses map[string]int32) {
	for workloadName, workloadHealth := range allHealth {
		workloadHealth.WorkloadStatus.SyncedProxies = proxyStatuses[workloadName]
	}
}

func (in *HealthService) getServiceRequestsHealth(namespace, service, rateInterval string, queryTime time.Time) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	inbound, err := in.prom.GetServiceRequestRates(namespace, service, rateInterval, queryTime)
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	return rqHealth, err
}

func (in *HealthService) getAppRequestsHealth(namespace, app, rateInterval string, queryTime time.Time) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	inbound, outbound, err := in.prom.GetAppRequestRates(namespace, app, rateInterval, queryTime)
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	for _, sample := range outbound {
		rqHealth.AggregateOutbound(sample)
	}
	return rqHealth, err
}

func (in *HealthService) getWorkloadRequestsHealth(namespace, workload, rateInterval string, queryTime time.Time) (models.RequestHealth, error) {
	rqHealth := models.NewEmptyRequestHealth()
	inbound, outbound, err := in.prom.GetWorkloadRequestRates(namespace, workload, rateInterval, queryTime)
	for _, sample := range inbound {
		rqHealth.AggregateInbound(sample)
	}
	for _, sample := range outbound {
		rqHealth.AggregateOutbound(sample)
	}
	return rqHealth, err
}
