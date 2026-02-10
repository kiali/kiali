package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/rs/zerolog"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
)

// OverviewServiceLatencies returns the top service latencies (p95) across all clusters and namespaces.
// Query parameters:
//   - rateInterval: time period for rate calculation (default: from healthConfig.compute.duration)
//   - limit: maximum number of results to return (default: 20, must be > 0)
func OverviewServiceLatencies(conf *config.Config, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		zl := log.FromContext(ctx)

		// Parse query parameters
		queryParams := r.URL.Query()

		rateInterval := queryParams.Get("rateInterval")
		if rateInterval == "" {
			rateInterval = getDefaultRateInterval(conf)
		} else {
			// Validate the provided rateInterval
			if _, err := model.ParseDuration(rateInterval); err != nil {
				RespondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid 'rateInterval' parameter: %v", err))
				return
			}
		}

		limit := 20 // default limit
		if limitStr := queryParams.Get("limit"); limitStr != "" {
			var err error
			limit, err = strconv.Atoi(limitStr)
			if err != nil || limit <= 0 {
				RespondWithError(w, http.StatusBadRequest, "Invalid 'limit' parameter: must be a positive integer")
				return
			}
		}

		// Build the PromQL query for p95 latency
		// Aggregate by destination_cluster, destination_service_namespace, destination_service_name
		// Currently uses all reporters, which can get source and dest reporting for the same request,
		// but ensures we don't miss out on anything reported from only one proxy (including waypoints)
		groupBy := "destination_cluster,destination_service_namespace,destination_service_name"
		labels := `destination_workload!="unknown"`

		query := buildLatencyQuery(labels, groupBy, rateInterval, limit)
		zl.Debug().Msgf("OverviewServiceLatencies query: %s", query)

		// Execute query
		queryTime := time.Now()
		result, warnings, err := prom.API().Query(ctx, query, queryTime)
		if len(warnings) > 0 {
			zl.Warn().Msgf("OverviewServiceLatencies. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
		}
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, "Error querying Prometheus: "+err.Error())
			return
		}

		// Convert results (already sorted by Prometheus topk)
		vector, ok := result.(model.Vector)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Unexpected Prometheus result type")
			return
		}

		services := convertToServiceLatencies(vector)

		response := models.ServiceLatencyResponse{
			Services: services,
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

// buildLatencyQuery constructs a PromQL query for p95 latency.
// Uses topk to return only the top results sorted by highest latency.
func buildLatencyQuery(labels, groupBy, rateInterval string, limit int) string {
	return fmt.Sprintf(
		`round(topk(%d, histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{%s}[%s])) by (le,%s)) > 0), 0.001)`,
		limit,
		labels,
		rateInterval,
		groupBy,
	)
}

// convertToServiceLatencies converts a Prometheus vector to a slice of ServiceLatency
func convertToServiceLatencies(vector model.Vector) []models.ServiceLatency {
	services := make([]models.ServiceLatency, 0, len(vector))

	for _, sample := range vector {
		// Skip NaN values
		if math.IsNaN(float64(sample.Value)) {
			continue
		}

		cluster := string(sample.Metric["destination_cluster"])
		namespace := string(sample.Metric["destination_service_namespace"])
		serviceName := string(sample.Metric["destination_service_name"])

		// Skip entries with missing required labels
		if serviceName == "" {
			continue
		}

		services = append(services, models.ServiceLatency{
			Cluster:     cluster,
			Namespace:   namespace,
			ServiceName: serviceName,
			Latency:     float64(sample.Value),
		})
	}

	return services
}

// getDefaultRateInterval returns the default rate interval from health config.
func getDefaultRateInterval(conf *config.Config) string {
	return formatDuration(conf.HealthConfig.Compute.Duration)
}

// formatDuration formats a duration for Prometheus queries (e.g., "2m", "5m").
func formatDuration(d time.Duration) string {
	seconds := int(d.Seconds())
	if seconds >= 60 && seconds%60 == 0 {
		return fmt.Sprintf("%dm", seconds/60)
	}
	return fmt.Sprintf("%ds", seconds)
}

// OverviewServiceRates returns the top service error rates across all clusters and namespaces.
// When health cache is enabled, data is aggregated from the cache (using health config tolerances
// for error rate). Otherwise, Prometheus is queried directly (simple non-200 = error).
// Query parameters:
//   - rateInterval: time period for rate calculation (default: from healthConfig.compute.duration)
//   - limit: maximum number of results to return (default: 20, must be > 0)
func OverviewServiceRates(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		zl := log.FromContext(ctx)

		// Parse query parameters
		queryParams := r.URL.Query()

		rateInterval := queryParams.Get("rateInterval")
		if rateInterval == "" {
			rateInterval = getDefaultRateInterval(conf)
		} else {
			// Validate the provided rateInterval
			if _, err := model.ParseDuration(rateInterval); err != nil {
				RespondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid 'rateInterval' parameter: %v", err))
				return
			}
		}

		limit := 20 // default limit
		if limitStr := queryParams.Get("limit"); limitStr != "" {
			var err error
			limit, err = strconv.Atoi(limitStr)
			if err != nil || limit <= 0 {
				RespondWithError(w, http.StatusBadRequest, "Invalid 'limit' parameter: must be a positive integer")
				return
			}
		}

		// When health cache is enabled, serve from cache (uses health config for error rate)
		if conf.KialiInternal.HealthCache.Enabled {
			services := overviewServiceRatesFromHealthCache(r, ctx, zl, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery, limit)
			RespondWithJSON(w, http.StatusOK, models.ServiceRatesResponse{Services: services})
			return
		}

		// Prometheus path (simple non-200 = error)
		groupBy := "source_cluster,destination_cluster,destination_service_namespace,destination_service_name"
		labels := ``

		queryTime := time.Now()
		services := make([]models.ServiceRequests, 0, limit)
		foundServices := make(map[string]bool)

		// Step 1: Query for top error rates using topk
		errorRateQuery := buildErrorRateQuery(labels, groupBy, rateInterval, limit)
		zl.Debug().Msgf("OverviewServiceRequests error rate query: %s", errorRateQuery)

		errorRateResult, warnings, err := prom.API().Query(ctx, errorRateQuery, queryTime)
		if len(warnings) > 0 {
			zl.Warn().Msgf("OverviewServiceRequests error rate. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
		}
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, "Error querying Prometheus for error rates: "+err.Error())
			return
		}

		errorRateVector, ok := errorRateResult.(model.Vector)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Unexpected Prometheus result type for error rates")
			return
		}

		// Step 2: Query for total request rates to get request counts
		totalQuery := buildRequestsQuery(labels, groupBy, rateInterval, limit)
		zl.Debug().Msgf("OverviewServiceRequests total query: %s", totalQuery)

		totalResult, warnings, err := prom.API().Query(ctx, totalQuery, queryTime)
		if len(warnings) > 0 {
			zl.Warn().Msgf("OverviewServiceRequests total. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
		}
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, "Error querying Prometheus for total requests: "+err.Error())
			return
		}

		totalVector, ok := totalResult.(model.Vector)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Unexpected Prometheus result type for total requests")
			return
		}

		// Build a map of total request counts
		totalMap := buildTotalMap(totalVector)

		// Process error rate results first (these are our primary results)
		for _, sample := range errorRateVector {
			if math.IsNaN(float64(sample.Value)) {
				continue
			}

			cluster := string(sample.Metric["destination_cluster"])
			namespace := string(sample.Metric["destination_service_namespace"])
			serviceName := string(sample.Metric["destination_service_name"])

			if serviceName == "" {
				continue
			}

			// try to protect against a known prom reporting problem
			if cluster == "unknown" {
				cluster = string(sample.Metric["source_cluster"])
			}

			key := serviceKey(cluster, namespace, serviceName)
			foundServices[key] = true

			// Look up request count from total map
			requestCount := totalMap[key]

			services = append(services, models.ServiceRequests{
				Cluster:      cluster,
				ErrorRate:    float64(sample.Value),
				HealthStatus: models.HealthStatusNA, // Prometheus path does not compute health status
				Namespace:    namespace,
				RequestCount: requestCount,
				ServiceName:  serviceName,
			})
		}

		// Step 3: If we have remaining capacity, fill with top-traffic services
		remaining := limit - len(services)
		if remaining > 0 {
			// Add services from total query that weren't in error rate results
			// These are sorted by request count (topk), so we add in order
			for _, sample := range totalVector {
				if remaining <= 0 {
					break
				}

				if math.IsNaN(float64(sample.Value)) {
					continue
				}

				cluster := string(sample.Metric["destination_cluster"])
				namespace := string(sample.Metric["destination_service_namespace"])
				serviceName := string(sample.Metric["destination_service_name"])

				if serviceName == "" {
					continue
				}

				// try to protect against a known prom reporting problem
				if cluster == "unknown" {
					cluster = string(sample.Metric["source_cluster"])
				}

				key := serviceKey(cluster, namespace, serviceName)
				if foundServices[key] {
					continue // Already included from error rate query
				}

				requestCount := float64(sample.Value)
				if requestCount <= 0 {
					continue
				}

				foundServices[key] = true
				services = append(services, models.ServiceRequests{
					Cluster:      cluster,
					ErrorRate:    0,                     // No errors (wasn't in error rate results)
					HealthStatus: models.HealthStatusNA, // Prometheus path does not compute health status
					Namespace:    namespace,
					RequestCount: requestCount,
					ServiceName:  serviceName,
				})
				remaining--
			}
		}

		response := models.ServiceRatesResponse{
			Services: services,
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

// buildErrorRateQuery constructs a PromQL query for error rate using topk.
func buildErrorRateQuery(labels, groupBy, rateInterval string, limit int) string {
	var errorLabels string
	if labels == "" {
		errorLabels = `response_code!="200"`
	} else {
		errorLabels = labels + `,response_code!="200"`
	}
	return fmt.Sprintf(
		`round(topk(%d, sum(rate(istio_requests_total{%s}[%s])) by (%s) / sum(rate(istio_requests_total{%s}[%s])) by (%s) > 0), 0.001)`,
		limit,
		errorLabels,
		rateInterval,
		groupBy,
		labels,
		rateInterval,
		groupBy,
	)
}

// buildRequestsQuery constructs a PromQL query for request rate using topk.
func buildRequestsQuery(labels, groupBy, rateInterval string, limit int) string {
	return fmt.Sprintf(
		`round(topk(%d, sum(rate(istio_requests_total{%s}[%s])) by (%s) > 0), 0.001)`,
		limit,
		labels,
		rateInterval,
		groupBy,
	)
}

// serviceKey generates a unique key for a service based on cluster, namespace, and name.
func serviceKey(cluster, namespace, serviceName string) string {
	return cluster + "/" + namespace + "/" + serviceName
}

// buildTotalMap creates a map of service keys to their total request counts.
func buildTotalMap(vector model.Vector) map[string]float64 {
	totalMap := make(map[string]float64)
	for _, sample := range vector {
		if math.IsNaN(float64(sample.Value)) {
			continue
		}
		cluster := string(sample.Metric["destination_cluster"])
		namespace := string(sample.Metric["destination_service_namespace"])
		serviceName := string(sample.Metric["destination_service_name"])
		if serviceName == "" {
			continue
		}
		key := serviceKey(cluster, namespace, serviceName)
		totalMap[key] = float64(sample.Value)
	}
	return totalMap
}

// overviewServiceRatesFromHealthCache aggregates service error and request rates from the health cache.
// Error rates use the health config (tolerances); request rate is total req/s from cached RequestHealth.
func overviewServiceRatesFromHealthCache(
	r *http.Request,
	ctx context.Context,
	zl *zerolog.Logger,
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
	limit int,
) []models.ServiceRequests {
	layer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
	if err != nil {
		zl.Warn().Err(err).Msg("OverviewServiceRates: could not get business layer, returning empty list")
		return nil
	}

	type serviceRate struct {
		cluster      string
		namespace    string
		serviceName  string
		errorRate    float64 // 0-1 decimal
		requestCount float64
		healthStatus models.HealthStatus
	}

	var all []serviceRate
	clusters := kialiCache.GetClusters()

	for _, cluster := range clusters {
		namespaces, err := layer.Namespace.GetClusterNamespaces(ctx, cluster.Name)
		if err != nil {
			zl.Debug().Err(err).Str("cluster", cluster.Name).Msg("OverviewServiceRates: could not get namespaces for cluster")
			continue
		}

		for _, ns := range namespaces {
			cachedData, found := kialiCache.GetHealth(cluster.Name, ns.Name, internalmetrics.HealthTypeService)
			if !found || cachedData == nil {
				continue
			}

			for svcName, sh := range cachedData.ServiceHealth {
				if sh == nil {
					continue
				}
				// Status is always set when health is stored in the cache (getNamespaceServiceHealth sets it for every service).
				if sh.Status == nil {
					continue
				}

				// ErrorRatio is 0-100 (percentage); API expects 0-1 decimal
				errorRate := sh.Status.ErrorRatio / 100.0
				requestCount := sh.Status.TotalRequestRate

				all = append(all, serviceRate{
					cluster:      cluster.Name,
					namespace:    ns.Name,
					serviceName:  svcName,
					errorRate:    errorRate,
					requestCount: requestCount,
					healthStatus: sh.Status.Status,
				})
			}
		}
	}

	// Sort: highest error rate first, then highest request rate
	sort.Slice(all, func(i, j int) bool {
		if all[i].errorRate != all[j].errorRate {
			return all[i].errorRate > all[j].errorRate
		}
		return all[i].requestCount > all[j].requestCount
	})

	// Take top `limit`
	if limit < len(all) {
		all = all[:limit]
	}

	services := make([]models.ServiceRequests, 0, len(all))
	for _, s := range all {
		services = append(services, models.ServiceRequests{
			Cluster:      s.cluster,
			ErrorRate:    s.errorRate,
			HealthStatus: s.healthStatus,
			Namespace:    s.namespace,
			RequestCount: s.requestCount,
			ServiceName:  s.serviceName,
		})
	}

	return services
}
