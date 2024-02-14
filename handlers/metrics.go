package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

// AppMetrics is the API handler to fetch metrics to be displayed, related to an app-label grouping
func AppMetrics(w http.ResponseWriter, r *http.Request) {
	getAppMetrics(w, r, defaultPromClientSupplier)
}

// getAppMetrics (mock-friendly version)
func getAppMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	app := vars["app"]
	cluster := clusterNameFromQuery(r.URL.Query())

	metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}

	params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, App: app}
	oldestNs := GetOldestNamespace(namespaceInfo)
	err := extractIstioMetricsQueryParams(r, &params, oldestNs)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics, err := metricsService.GetMetrics(params, nil)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, metrics)
}

// WorkloadMetrics is the API handler to fetch metrics to be displayed, related to a single workload
func WorkloadMetrics(w http.ResponseWriter, r *http.Request) {
	getWorkloadMetrics(w, r, defaultPromClientSupplier)
}

// getWorkloadMetrics (mock-friendly version)
func getWorkloadMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	workload := vars["workload"]
	cluster := clusterNameFromQuery(r.URL.Query())

	metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
	if metricsService == nil || namespaceInfo == nil {
		// any returned value nil means error & response already written
		return
	}
	oldestNs := GetOldestNamespace(namespaceInfo)

	params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Workload: workload}
	err := extractIstioMetricsQueryParams(r, &params, oldestNs)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics, err := metricsService.GetMetrics(params, nil)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, metrics)
}

// ServiceMetrics is the API handler to fetch metrics to be displayed, related to a single service
func ServiceMetrics(w http.ResponseWriter, r *http.Request) {
	getServiceMetrics(w, r, defaultPromClientSupplier)
}

// getServiceMetrics (mock-friendly version)
func getServiceMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]
	cluster := clusterNameFromQuery(r.URL.Query())

	metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}
	oldestNs := GetOldestNamespace(namespaceInfo)

	params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Service: service}
	err := extractIstioMetricsQueryParams(r, &params, oldestNs)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics, err := metricsService.GetMetrics(params, nil)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, metrics)
}

// AggregateMetrics is the API handler to fetch metrics to be displayed, related to a single aggregate
func AggregateMetrics(w http.ResponseWriter, r *http.Request) {
	getAggregateMetrics(w, r, defaultPromClientSupplier)
}

// getServiceMetrics (mock-friendly version)
func getAggregateMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	aggregate := vars["aggregate"]
	aggregateValue := vars["aggregateValue"]

	metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}
	oldestNs := GetOldestNamespace(namespaceInfo)

	params := models.IstioMetricsQuery{Namespace: namespace, Aggregate: aggregate, AggregateValue: aggregateValue}
	err := extractIstioMetricsQueryParams(r, &params, oldestNs)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	if params.Direction != "inbound" {
		RespondWithError(w, http.StatusBadRequest, "AggregateMetrics 'direction' must be 'inbound' as the metrics are associated with inbound traffic to the destination workload.")
		return
	}
	if params.Reporter != "destination" {
		RespondWithError(w, http.StatusBadRequest, "AggregateMetrics 'reporter' must be 'destination' as the metrics are associated with inbound traffic to the destination workload.")
		return
	}

	metrics, err := metricsService.GetMetrics(params, nil)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, metrics)
}

// NamespaceMetrics is the API handler to fetch metrics to be displayed, related to all
// services in the namespace
func NamespaceMetrics(w http.ResponseWriter, r *http.Request) {
	getNamespaceMetrics(w, r, defaultPromClientSupplier)
}

// getServiceMetrics (mock-friendly version)
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]
	cluster := clusterNameFromQuery(r.URL.Query())

	metricsService, namespaceInfo := createMetricsServiceForNamespaceMC(w, r, promSupplier, namespace)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}
	oldestNs := GetOldestNamespace(namespaceInfo)

	params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

	err = extractIstioMetricsQueryParams(r, &params, oldestNs)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics, err := metricsService.GetMetrics(params, nil)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	if isRemoteCluster, _ := business.Mesh.IsRemoteCluster(cluster); !isRemoteCluster && namespace == config.Get().IstioNamespace {
		controlPlaneMetrics, err := metricsService.GetControlPlaneMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		for k, v := range controlPlaneMetrics {
			metrics[k] = v
		}
	}

	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, metrics)
}

// ClustersMetrics is the API handler to fetch metrics to be displayed, related to all
// services in provided namespaces of given cluster
func ClustersMetrics(w http.ResponseWriter, r *http.Request) {
	getClustersMetrics(w, r, defaultPromClientSupplier)
}

// getClustersMetrics (mock-friendly version)
func getClustersMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	query := r.URL.Query()
	namespaces := query.Get("namespaces") // csl of namespaces
	nss := []string{}
	if len(namespaces) > 0 {
		nss = strings.Split(namespaces, ",")
	}
	cluster := clusterNameFromQuery(query)

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(nss) == 0 {
		loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
		for _, ns := range loadedNamespaces {
			nss = append(nss, ns.Name)
		}
	}

	metricsService, namespaceInfo := createMetricsServiceForClusterMC(w, r, promSupplier, cluster, nss)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}
	oldestNs := GetOldestNamespace(namespaceInfo)

	result := models.MetricsPerNamespace{}
	for _, namespace := range nss {
		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

		err = extractIstioMetricsQueryParams(r, &params, oldestNs)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		if isRemoteCluster, _ := business.Mesh.IsRemoteCluster(cluster); !isRemoteCluster && namespace == config.Get().IstioNamespace {
			controlPlaneMetrics, err := metricsService.GetControlPlaneMetrics(params, nil)
			if err != nil {
				RespondWithError(w, http.StatusServiceUnavailable, err.Error())
				return
			}

			for k, v := range controlPlaneMetrics {
				metrics[k] = v
			}
		}

		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		result[namespace] = metrics
	}

	RespondWithJSON(w, http.StatusOK, result)
}

func extractIstioMetricsQueryParams(r *http.Request, q *models.IstioMetricsQuery, namespaceInfo *models.Namespace) error {
	q.FillDefaults()
	queryParams := r.URL.Query()
	if filters, ok := queryParams["filters[]"]; ok && len(filters) > 0 {
		q.Filters = filters
	}

	dir := queryParams.Get("direction")
	if dir != "" {
		if dir != "inbound" && dir != "outbound" {
			return errors.New("bad request, query parameter 'direction' must be either 'inbound' or 'outbound'")
		}
		q.Direction = dir
	}
	requestProtocol := queryParams.Get("requestProtocol")
	if requestProtocol != "" {
		q.RequestProtocol = requestProtocol
	}
	reporter := queryParams.Get("reporter")
	if reporter != "" {
		if reporter != "source" && reporter != "destination" && reporter != "both" {
			return errors.New("bad request, query parameter 'reporter' must be either 'source', 'destination' or 'both'")
		}
		q.Reporter = reporter
	}
	return extractBaseMetricsQueryParams(queryParams, &q.RangeQuery, namespaceInfo)
}

func extractBaseMetricsQueryParams(queryParams url.Values, q *prometheus.RangeQuery, namespaceInfo *models.Namespace) error {
	if ri := queryParams.Get("rateInterval"); ri != "" {
		q.RateInterval = ri
	}
	if rf := queryParams.Get("rateFunc"); rf != "" {
		if rf != "rate" && rf != "irate" {
			return errors.New("bad request, query parameter 'rateFunc' must be either 'rate' or 'irate'")
		}
		q.RateFunc = rf
	}
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		if num, err := strconv.ParseInt(queryTime, 10, 64); err == nil {
			q.End = time.Unix(num, 0)
		} else {
			return errors.New("bad request, cannot parse query parameter 'queryTime'")
		}
	}
	if dur := queryParams.Get("duration"); dur != "" {
		if num, err := strconv.ParseInt(dur, 10, 64); err == nil {
			duration := time.Duration(num) * time.Second
			q.Start = q.End.Add(-duration)
		} else {
			return errors.New("bad request, cannot parse query parameter 'duration'")
		}
	}
	if step := queryParams.Get("step"); step != "" {
		if num, err := strconv.Atoi(step); err == nil {
			q.Step = time.Duration(num) * time.Second
		} else {
			return errors.New("bad request, cannot parse query parameter 'step'")
		}
	}
	if quantiles, ok := queryParams["quantiles[]"]; ok && len(quantiles) > 0 {
		for _, quantile := range quantiles {
			f, err := strconv.ParseFloat(quantile, 64)
			if err != nil {
				// Non parseable quantile
				return errors.New("bad request, cannot parse query parameter 'quantiles', float expected")
			}
			if f < 0 || f > 1 {
				return errors.New("bad request, invalid quantile(s): should be between 0 and 1")
			}
		}
		q.Quantiles = quantiles
	}
	if avgStr := queryParams.Get("avg"); avgStr != "" {
		if avg, err := strconv.ParseBool(avgStr); err == nil {
			q.Avg = avg
		} else {
			return errors.New("bad request, cannot parse query parameter 'avg'")
		}
	}
	if lbls, ok := queryParams["byLabels[]"]; ok && len(lbls) > 0 {
		q.ByLabels = lbls
	}

	// If needed, adjust interval -- Make sure query won't fetch data before the namespace creation
	intervalStartTime, err := util.GetStartTimeForRateInterval(q.End, q.RateInterval)
	if err != nil {
		return err
	}
	if intervalStartTime.Before(namespaceInfo.CreationTimestamp) {
		q.RateInterval = fmt.Sprintf("%ds", int(q.End.Sub(namespaceInfo.CreationTimestamp).Seconds()))
		intervalStartTime = namespaceInfo.CreationTimestamp
		log.Debugf("[extractMetricsQueryParams] Interval set to: %v", q.RateInterval)
	}
	// If needed, adjust query start time (bound to namespace creation time)
	intervalDuration := q.End.Sub(intervalStartTime)
	allowedStart := namespaceInfo.CreationTimestamp.Add(intervalDuration)
	if q.Start.Before(allowedStart) {
		log.Debugf("[extractMetricsQueryParams] Requested query start time [%v] set to allowed time [%v]", q.Start, allowedStart)
		q.Start = allowedStart

		if q.Start.After(q.End) {
			// This means that the query range does not fall in the range
			// of life of the namespace. So, there are no metrics to query.
			log.Debugf("[extractMetricsQueryParams] Query end time = %v; not querying metrics.", q.End)
			return errors.New("after checks, query start time is after end time")
		}
	}

	// Adjust start & end times to be a multiple of step
	stepInSecs := int64(q.Step.Seconds())
	q.Start = time.Unix((q.Start.Unix()/stepInSecs)*stepInSecs, 0)
	return nil
}

// MetricsStats is the API handler to compute some stats based on metrics
func MetricsStats(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	var raw models.MetricsStatsQueries

	err = json.Unmarshal(body, &raw)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	metricsService, queries, warns := prepareStatsQueries(w, r, raw.Queries, defaultPromClientSupplier)
	if len(queries) == 0 && warns != nil {
		// All queries failed to be adjusted => return an error
		handleErrorResponse(w, warns)
		return
	}
	stats, err := metricsService.GetStats(queries)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	result := models.MetricsStatsResult{Stats: stats}
	if warns != nil {
		result.Warnings = warns.Strings()
	}
	RespondWithJSON(w, http.StatusOK, result)
}

func prepareStatsQueries(w http.ResponseWriter, r *http.Request, rawQ []models.MetricsStatsQuery, promSupplier promClientSupplier) (*business.MetricsService, []models.MetricsStatsQuery, *util.Errors) {
	// Get unique namespaces list
	var namespaces []models.Namespace
	for _, q := range rawQ {
		found := false
		for _, ns := range namespaces {
			if ns.Name == q.Target.Namespace {
				found = true
				break
			}
		}
		if !found {
			newNs := models.Namespace{Name: q.Target.Namespace, Cluster: config.GetSafeClusterName(q.Target.Cluster)}
			namespaces = append(namespaces, newNs)
		}
	}

	// Create the metrics service, along with namespaces information for adjustements
	metricsService, nsInfos := createMetricsServiceForNamespaces(w, r, promSupplier, namespaces)

	// Keep only valid queries (fill errors if needed) and adjust queryTime / interval
	var errors util.Errors
	var validQueries []models.MetricsStatsQuery
	for _, q := range rawQ {
		if valErr := q.Validate(); valErr != nil {
			errors.Merge(valErr)
			continue
		}
		if nsInfoErr, ok := nsInfos[q.Target.Namespace]; !ok {
			errors.Add(fmt.Errorf("Missing info for namespace '%s'", q.Target.Namespace))
			continue
		} else if nsInfoErr.err != nil {
			errors.Add(fmt.Errorf("Namespace '%s': %v", q.Target.Namespace, nsInfoErr.err))
			continue
		} else {
			namespaceInfo := nsInfoErr.info
			interval, err := util.AdjustRateInterval(namespaceInfo.CreationTimestamp, q.QueryTime, q.RawInterval)
			if err != nil {
				errors.Add(err)
				continue
			}
			q.Interval = interval
			if q.Interval != q.RawInterval {
				log.Debugf("Rate interval for namespace %s was adjusted to %s (original = %s, query time = %v, namespace created = %v)",
					q.Target.Namespace, q.Interval, q.RawInterval, q.QueryTime, namespaceInfo.CreationTimestamp)
			}
			validQueries = append(validQueries, q)
		}
	}
	return metricsService, validQueries, errors.OrNil()
}
