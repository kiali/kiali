package handlers

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// CustomDashboard is the API handler to fetch runtime metrics to be displayed, related to a single app
func CustomDashboard(
	conf *config.Config,
	cache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	discovery istio.MeshDiscovery,
	grafana *grafana.Service,
	prom prometheus.ClientInterface,
	traceLoader func() tracing.ClientInterface,
	cpm business.ControlPlaneMonitor,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		queryParams := r.URL.Query()
		pathParams := mux.Vars(r)
		cluster := clusterNameFromQuery(conf, queryParams)
		namespace := pathParams["namespace"]
		dashboardName := pathParams["dashboard"]

		layer, err := getLayer(r, conf, cache, clientFactory, cpm, prom, traceLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		info, err := checkNamespaceAccessWithService(w, r, &layer.Namespace, namespace, cluster)
		if err != nil {
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
			return
		}

		params := models.DashboardQuery{Namespace: namespace}
		err = extractDashboardQueryParams(queryParams, &params, info)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		var wkd *models.Workload
		if params.Workload != "" {
			wkd, err = layer.Workload.GetWorkload(r.Context(), business.WorkloadCriteria{Cluster: cluster, Namespace: namespace, WorkloadName: params.Workload, WorkloadGVK: params.WorkloadGVK, IncludeServices: false})
			if err != nil {
				if errors.IsNotFound(err) {
					RespondWithError(w, http.StatusNotFound, err.Error())
				} else {
					RespondWithError(w, http.StatusInternalServerError, err.Error())
				}
				return
			}
		}

		svc := business.NewDashboardsService(conf, grafana, prom, info, wkd)
		if !svc.CustomEnabled {
			RespondWithError(w, http.StatusServiceUnavailable, "Custom dashboards are disabled in config")
			return
		}

		dashboard, err := svc.GetDashboard(r.Context(), params, dashboardName)
		if err != nil {
			if errors.IsNotFound(err) {
				RespondWithError(w, http.StatusNotFound, err.Error())
			} else {
				RespondWithError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

func extractDashboardQueryParams(queryParams url.Values, q *models.DashboardQuery, namespaceInfo *models.Namespace) error {
	q.FillDefaults()
	q.LabelsFilters = extractLabelsFilters(queryParams.Get("labelsFilters"))
	additionalLabels := strings.Split(queryParams.Get("additionalLabels"), ",")
	for _, additionalLabel := range additionalLabels {
		kvPair := strings.Split(additionalLabel, ":")
		if len(kvPair) == 2 {
			q.AdditionalLabels = append(q.AdditionalLabels, models.Aggregation{
				Label:       strings.TrimSpace(kvPair[0]),
				DisplayName: strings.TrimSpace(kvPair[1]),
			})
		}
	}
	op := queryParams.Get("rawDataAggregator")
	// Explicit white-listing operators to prevent any kind of injection
	// For a list of operators, see https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators
	if op == "sum" || op == "min" || op == "max" || op == "avg" || op == "stddev" || op == "stdvar" {
		q.RawDataAggregator = op
	}
	q.Workload = queryParams.Get("workload")
	return extractBaseMetricsQueryParams(queryParams, &q.RangeQuery, namespaceInfo)
}

func extractLabelsFilters(rawString string) map[string]string {
	labelsFilters := make(map[string]string)
	rawFilters := strings.Split(rawString, ",")
	for _, rawFilter := range rawFilters {
		kvPair := strings.Split(rawFilter, ":")
		if len(kvPair) == 2 {
			labelsFilters[strings.TrimSpace(kvPair[0])] = strings.TrimSpace(kvPair[1])
		}
	}
	return labelsFilters
}

// AppDashboard is the API handler to fetch Istio dashboard, related to a single app
func AppDashboard(
	conf *config.Config,
	cache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		app := vars["app"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, App: app}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(r.Context(), params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, prom, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// ServiceDashboard is the API handler to fetch Istio dashboard, related to a single service
func ServiceDashboard(
	conf *config.Config,
	cache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		service := vars["service"]

		queryParams := r.URL.Query()
		cluster := clusterNameFromQuery(conf, queryParams)

		layer, err := getLayer(r, conf, cache, clientFactory, cpm, prom, traceLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		namespaceInfo, err := checkNamespaceAccessWithService(w, r, &layer.Namespace, namespace, cluster)
		if err != nil {
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Service: service}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		svc, err := layer.Svc.GetService(r.Context(), cluster, namespace, service)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		// "External"/"ServiceEntry" services don't use namespace in telemetry, they need to use the "unknown" parameter
		// to collect the relevant telemetry for those services
		if svc.Type == "External" {
			params.Namespace = "unknown"
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(r.Context(), params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, prom, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// WorkloadDashboard is the API handler to fetch Istio dashboard, related to a single workload
func WorkloadDashboard(
	conf *config.Config,
	cache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	discovery istio.MeshDiscovery,
	prom prometheus.ClientInterface,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		workload := vars["workload"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Workload: workload}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(r.Context(), params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, prom, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// ZtunnelDashboard is the API handler to fetch metrics to be displayed, related to a single control plane revision
// It doesn't check if the namespace is a control plane, sometimes it is deployed in a different namespace (ex. OpenShift)
func ZtunnelDashboard(
	conf *config.Config,
	cache cache.KialiCache,
	discovery *istio.Discovery,
	clientFactory kubernetes.ClientFactory,
	grafana *grafana.Service,
	prom prometheus.ClientInterface,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, _ := checkNamespaceAccessMultiCluster(w, r, conf, cache, discovery, clientFactory, namespace)
		if namespaceInfo == nil {
			// any returned value nil means error & response already written
			return
		}

		oldestNs := GetOldestNamespace(namespaceInfo)

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

		if err := extractIstioMetricsQueryParams(r, &params, oldestNs); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)

		ztunnelMetrics, err := metricsService.GetZtunnelMetrics(r.Context(), params)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		ns := namespaceInfo[0]
		dashboard := business.NewDashboardsService(conf, grafana, prom, &ns, nil).BuildZtunnelDashboard(ztunnelMetrics)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}
