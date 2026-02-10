package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
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

// overviewServiceMetricsLimit is the default limit for top-N service latencies and service error rates.
const overviewServiceMetricsLimit = 7

// OverviewServiceLatencies returns the top service latencies (p95) across all clusters and namespaces.
// Uses healthConfig.compute.duration for the rate interval and a fixed limit (overviewServiceMetricsLimit).
func OverviewServiceLatencies(conf *config.Config, kialiCache cache.KialiCache, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		zl := log.FromContext(ctx)

		rateInterval := string(conf.HealthConfig.Compute.Duration)

		// Build the PromQL query for p95 latency
		// Aggregate by destination_cluster, destination_service_namespace, destination_service_name
		// Currently uses all reporters, which can get source and dest reporting for the same request,
		// but ensures we don't miss out on anything reported from only one proxy (including waypoints)
		groupBy := "destination_cluster,destination_service_namespace,destination_service_name"
		labels := `destination_workload!="unknown"`

		query := buildLatencyQuery(labels, groupBy, rateInterval, overviewServiceMetricsLimit)
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
		enrichServiceLatenciesWithHealth(services, kialiCache, conf)

		response := models.ServiceLatencyResponse{
			Services: services,
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

// enrichServiceLatenciesWithHealth sets HealthStatus on each ServiceLatency from the health cache.
// One cache lookup per distinct (cluster, namespace) keeps it efficient.
func enrichServiceLatenciesWithHealth(services []models.ServiceLatency, kialiCache cache.KialiCache, conf *config.Config) {
	if !conf.KialiInternal.HealthCache.Enabled || kialiCache == nil {
		for i := range services {
			services[i].HealthStatus = models.HealthStatusNA
		}
		return
	}
	// Collect unique (cluster, namespace) and fetch health once per pair
	type nsKey struct{ cluster, namespace string }
	cacheByNs := make(map[nsKey]models.NamespaceServiceHealth)
	for _, s := range services {
		key := nsKey{s.Cluster, s.Namespace}
		if _, ok := cacheByNs[key]; ok {
			continue
		}
		cached, _ := kialiCache.GetHealth(s.Cluster, s.Namespace, internalmetrics.HealthTypeService)
		if cached != nil {
			cacheByNs[key] = cached.ServiceHealth
		}
	}
	for i := range services {
		key := nsKey{services[i].Cluster, services[i].Namespace}
		svcHealth := cacheByNs[key]
		if sh := svcHealth[services[i].ServiceName]; sh != nil && sh.Status != nil {
			services[i].HealthStatus = sh.Status.Status
		} else {
			services[i].HealthStatus = models.HealthStatusNA
		}
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

// OverviewServiceRates returns the top service error rates across all clusters and namespaces.
// Data is aggregated from the health cache (using health config tolerances for error rate).
// When the health cache is disabled, an empty list is returned.
// Uses a fixed limit (overviewServiceMetricsLimit).
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

		var services []models.ServiceRequests

		if conf.KialiInternal.HealthCache.Enabled {
			services = overviewServiceRatesFromHealthCache(r, ctx, zl, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery, overviewServiceMetricsLimit)
		} else {
			zl.Trace().Msg("OverviewServiceRates: health cache is disabled, returning empty list")
		}

		RespondWithJSON(w, http.StatusOK, models.ServiceRatesResponse{Services: services})
	}
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
				if requestCount == 0 {
					// Fallback: Status.TotalRequestRate can be 0 if computed before CombineReporters or in edge cases; use raw Requests.
					requestCount = sh.Requests.GetTotalRequestRate()
				}
				if requestCount <= 0 {
					continue // do not include zero-rate services
				}

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
