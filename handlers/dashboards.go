package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/models"
)

// CustomDashboard is the API handler to fetch runtime metrics to be displayed, related to a single app
func CustomDashboard(conf *config.Config, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		queryParams := r.URL.Query()
		pathParams := mux.Vars(r)
		cluster := clusterNameFromQuery(conf, queryParams)
		namespace := pathParams["namespace"]
		dashboardName := pathParams["dashboard"]

		layer, err := getBusiness(r)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Check namespace access
		info, err := layer.Namespace.GetClusterNamespace(r.Context(), namespace, cluster)
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

		svc := business.NewDashboardsService(conf, grafana, info, wkd)
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
func AppDashboard(conf *config.Config, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		app := vars["app"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		metricsService, namespaceInfo := createMetricsServiceForNamespace(w, r, DefaultPromClientSupplier, models.Namespace{Name: namespace, Cluster: cluster})
		if metricsService == nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, App: app}
		err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metrics, err := metricsService.GetMetrics(params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// ServiceDashboard is the API handler to fetch Istio dashboard, related to a single service
func ServiceDashboard(conf *config.Config, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		service := vars["service"]

		queryParams := r.URL.Query()
		cluster := clusterNameFromQuery(conf, queryParams)

		metricsService, namespaceInfo := createMetricsServiceForNamespace(w, r, DefaultPromClientSupplier, models.Namespace{Name: namespace, Cluster: cluster})
		if metricsService == nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Service: service}
		err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		// ACcess to the service details to check
		b, err := getBusiness(r)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		svc, err := b.Svc.GetService(r.Context(), cluster, namespace, service)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		// "External"/"ServiceEntry" services don't use namespace in telemetry, they need to use the "unknown" parameter
		// to collect the relevant telemetry for those services
		if svc.Type == "External" {
			params.Namespace = "unknown"
		}

		metrics, err := metricsService.GetMetrics(params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// WorkloadDashboard is the API handler to fetch Istio dashboard, related to a single workload
func WorkloadDashboard(conf *config.Config, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		workload := vars["workload"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		metricsService, namespaceInfo := createMetricsServiceForNamespace(w, r, DefaultPromClientSupplier, models.Namespace{Name: namespace, Cluster: cluster})
		if metricsService == nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Workload: workload}
		err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metrics, err := metricsService.GetMetrics(params, business.GetIstioScaler())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		dashboard := business.NewDashboardsService(conf, grafana, namespaceInfo, nil).BuildIstioDashboard(metrics, params.Direction)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}

// ZtunnelDashboard is the API handler to fetch metrics to be displayed, related to a single control plane revision
func ZtunnelDashboard(promSupplier promClientSupplier, conf *config.Config, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		cluster := clusterNameFromQuery(conf, r.URL.Query())

		metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
		if metricsService == nil {
			// any returned value nil means error & response already written
			return
		}
		oldestNs := GetOldestNamespace(namespaceInfo)

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

		err := extractIstioMetricsQueryParams(r, &params, oldestNs)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		if namespace != conf.IstioNamespace {
			RespondWithError(w, http.StatusBadRequest, fmt.Sprintf("namespace [%s] is not the control plane namespace", namespace))
			return
		}

		ztunnelMetrics, err := metricsService.GetZtunnelMetrics(params)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		ns := namespaceInfo[0]
		dashboard := business.NewDashboardsService(conf, grafana, &ns, nil).BuildZtunnelDashboard(ztunnelMetrics)
		RespondWithJSON(w, http.StatusOK, dashboard)
	}
}
