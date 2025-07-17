package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

// AppMetrics is the API handler to fetch metrics to be displayed, related to an app-label grouping
func AppMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		app := vars["app"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, App: app}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// WorkloadMetrics is the API handler to fetch metrics to be displayed, related to a single workload
func WorkloadMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		workload := vars["workload"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Workload: workload}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// ServiceMetrics is the API handler to fetch metrics to be displayed, related to a single service
func ServiceMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		service := vars["service"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace, Service: service}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// AggregateMetrics is the API handler to fetch metrics to be displayed, related to a single aggregate
func AggregateMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		aggregate := vars["aggregate"]
		aggregateValue := vars["aggregateValue"]

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Unable to get user clients: "+err.Error())
			return
		}

		// Since we can't distinguish between clusters here there is no cluster parameter.
		// Instead we get namespaces from across clusters and pick the oldest one.
		namespaceService := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)
		namespaces, err := namespaceService.GetNamespaces(r.Context())
		if err != nil {
			if k8serrors.IsForbidden(err) {
				RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
				return
			}
			RespondWithError(w, http.StatusInternalServerError, "Unable to list namespaces: "+err.Error())
			return
		}

		// Add all namespaces with the same name across clusters.
		var namespaceInfo []models.Namespace
		for _, ns := range namespaces {
			if ns.Name == namespace {
				namespaceInfo = append(namespaceInfo, ns)
			}
		}
		oldestNs := GetOldestNamespace(namespaceInfo)

		params := models.IstioMetricsQuery{Namespace: namespace, Aggregate: aggregate, AggregateValue: aggregateValue}
		if err := extractIstioMetricsQueryParams(r, &params, oldestNs); err != nil {
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

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// ControlPlaneMetrics is the API handler to fetch metrics to be displayed, related to a single control plane revision
func ControlPlaneMetrics(
	conf *config.Config,
	cache cache.KialiCache,
	discovery *istio.Discovery,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		layer, err := getLayer(r, conf, cache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		vars := mux.Vars(r)
		namespace := vars["namespace"]
		if namespace != conf.IstioNamespace {
			RespondWithError(w, http.StatusBadRequest, fmt.Sprintf("namespace [%s] is not the control plane namespace", namespace))
			return
		}

		controlPlane := vars["controlplane"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccessWithService(w, r, &layer.Namespace, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

		err = extractIstioMetricsQueryParams(r, &params, namespaceInfo)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		cpWorkload, err := layer.Workload.GetWorkload(r.Context(), business.WorkloadCriteria{
			Cluster:               cluster,
			Namespace:             namespace,
			WorkloadName:          controlPlane,
			IncludeServices:       false,
			IncludeIstioResources: false,
			IncludeHealth:         false,
		})
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metrics := make(models.MetricsMap)
		metricsService := business.NewMetricsService(prom, conf)
		controlPlaneMetrics, err := metricsService.GetControlPlaneMetrics(params, cpWorkload.Pods, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		for k, v := range controlPlaneMetrics {
			metrics[k] = v
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// ResourceUsageMetrics is the API handler to fetch metrics to be displayed, related to a single control plane revision
func ResourceUsageMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		app := vars["app"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{App: app, Cluster: cluster, Namespace: namespaceInfo.Name}
		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics := make(models.MetricsMap)

		resourceMetrics, err := metricsService.GetResourceMetrics(params)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		for k, v := range resourceMetrics {
			metrics[k] = v
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// NamespaceMetrics is the API handler to fetch metrics to be displayed, related to all
// services in the namespace
func NamespaceMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		cluster := clusterNameFromQuery(conf, r.URL.Query())

		namespaceInfo, err := checkNamespaceAccess(w, r, conf, cache, discovery, clientFactory, namespace, cluster)
		if err != nil {
			// any returned value nil means error & response already written
			return
		}

		params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace}

		if err := extractIstioMetricsQueryParams(r, &params, namespaceInfo); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
		metrics, err := metricsService.GetMetrics(params, nil)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// ClustersMetrics is the API handler to fetch metrics to be displayed, related to all
// services in provided namespaces of given cluster
func ClustersMetrics(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		namespaces := query.Get("namespaces") // csl of namespaces
		namespacesFromQueryParams := map[string]struct{}{}
		if len(namespaces) > 0 {
			for _, ns := range strings.Split(namespaces, ",") {
				namespacesFromQueryParams[ns] = struct{}{}
			}
		}
		cluster := clusterNameFromQuery(conf, query)

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Unable to get user clients from auth info: "+err.Error())
		}

		namespace := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)
		loadedNamespaces, err := namespace.GetClusterNamespaces(r.Context(), cluster)
		if err != nil {
			// Check specifically for forbidden?
			RespondWithError(w, http.StatusInternalServerError, "Unable to get cluster namespaces: "+err.Error())
		}

		var nss []models.Namespace
		if len(namespacesFromQueryParams) > 0 {
			for _, ns := range loadedNamespaces {
				ns := ns
				if _, ok := namespacesFromQueryParams[ns.Name]; ok {
					nss = append(nss, ns)
				}
			}
		}
		oldestNs := GetOldestNamespace(nss)

		metricsService := business.NewMetricsService(prom, conf)
		result := models.MetricsPerNamespace{}
		for _, namespace := range nss {
			params := models.IstioMetricsQuery{Cluster: cluster, Namespace: namespace.Name}

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

			result[namespace.Name] = metrics
		}

		RespondWithJSON(w, http.StatusOK, result)
	}
}

func extractIstioMetricsQueryParams(r *http.Request, q *models.IstioMetricsQuery, namespaceInfo *models.Namespace) error {
	queryParams := r.URL.Query()

	q.FillDefaults()

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

	includeAmbientParam := queryParams.Get("includeAmbient")
	if includeAmbientParam != "" {
		includeAmbient, err := strconv.ParseBool(includeAmbientParam)
		if err != nil {
			return errors.New("bad request, query parameter 'includeAmbient' must be either 'true' or 'false'")
		}
		q.IncludeAmbient = includeAmbient
	}

	reporter := queryParams.Get("reporter")
	if reporter != "" {
		if reporter != "both" && reporter != "destination" && reporter != "source" {
			return errors.New("bad request, query parameter 'reporter' must be one of 'both, 'destination', or 'source'")
		}
		q.Reporter = reporter
	}

	requestProtocol := queryParams.Get("requestProtocol")
	if requestProtocol != "" {
		q.RequestProtocol = requestProtocol
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
func MetricsStats(conf *config.Config, cache cache.KialiCache, discovery *istio.Discovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		namespace := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)

		defer r.Body.Close()
		var raw models.MetricsStatsQueries
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}

		queries, warns := prepareStatsQueries(r.Context(), &namespace, raw.Queries)
		if len(queries) == 0 && warns != nil {
			// All queries failed to be adjusted => return an error
			handleErrorResponse(w, warns)
			return
		}

		metricsService := business.NewMetricsService(prom, conf)
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
}

func prepareStatsQueries(ctx context.Context, namespace *business.NamespaceService, rawQ []models.MetricsStatsQuery) ([]models.MetricsStatsQuery, *util.Errors) {
	// Keep only valid queries (fill errors if needed) and adjust queryTime / interval
	var errors util.Errors
	var validQueries []models.MetricsStatsQuery
	for _, q := range rawQ {
		if valErr := q.Validate(); valErr != nil {
			errors.Merge(valErr)
			continue
		}
		namespaceInfo, err := namespace.GetClusterNamespace(ctx, q.Target.Namespace, config.GetSafeClusterName(q.Target.Cluster))
		if err != nil {
			errors.Add(fmt.Errorf("namespace '%s', cluster: '%s': %v", q.Target.Namespace, q.Target.Cluster, err))
			continue
		}
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
	return validQueries, errors.OrNil()
}
