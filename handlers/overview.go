package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"regexp"
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

// overviewServiceMetricsLimit is the default limit for top-N service latencies and service error rates. It
// is currently set to 6 because it is a value that allows most screens to show it without introducing
// scroll. We want the overview cards to present data w/o scroll.
const overviewServiceMetricsLimit = 6

// OverviewServiceLatencies returns the top service latencies (p95) across all clusters and namespaces.
// Uses healthConfig.compute.duration for the rate interval and a fixed limit (overviewServiceMetricsLimit).
func OverviewServiceLatencies(
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

		rateInterval := string(conf.HealthConfig.Compute.Duration)

		// Use the business layer to respect discovery selectors and per-user namespace visibility.
		layer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Error creating business layer: "+err.Error())
			return
		}

		// Execute the PromQL queries to get the top p95 latencies. Because histogram querying is
		// heavy, We try to make the most efficient prometheus queries possible, given the user's
		// cluster and/or namespace access. All of the queries use the prom 'topk' function to limit
		// query processing and return only the necessary time-series.

		// Aggregate by destination_cluster, destination_service_namespace, destination_service_name
		// Currently uses all reporters, which can get source and dest reporting for the same request,
		// but ensures we don't miss out on anything reported from only one proxy (including waypoints)
		var services []models.ServiceLatency
		groupBy := "destination_cluster,destination_service_namespace,destination_service_name"
		queryTime := time.Now()

		// If Kiali is scoped (CWA=false and/or discovery selectors are configured), we must not run an
		// unfiltered cross-namespace query. Instead, always run per-cluster queries with a namespace filter.
		// This is because Kiali with DS may not have access to all of the mesh namespaces.
		discoverySelectorsConfigured := len(conf.Deployment.DiscoverySelectors.Default) > 0 ||
			len(conf.Deployment.DiscoverySelectors.Overrides) > 0
		scopedByConfig := !conf.Deployment.ClusterWideAccess || discoverySelectorsConfigured

		// For users with full access, execute a single, cross-cluster, cross-namespace query.
		if !scopedByConfig && hasAllClusterNamespaceAccess(ctx, layer, "") {
			labels := `destination_workload!="unknown"`

			query := buildLatencyQuery(labels, groupBy, rateInterval, overviewServiceMetricsLimit)
			zl.Trace().Msgf("OverviewServiceLatencies query: %s", query)

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
			services = convertToServiceLatencies(vector)

		} else {
			// For users with limited access, execute per-cluster queries, limiting the namespaces, as needed.
			services = make([]models.ServiceLatency, 0, overviewServiceMetricsLimit)
			successfulClusterQueries := 0
			failedClusterQueries := 0
			var lastQueryErr error

			userClusters := layer.Namespace.GetClusterList()

			for _, cluster := range userClusters {
				labels := fmt.Sprintf(`destination_workload!="unknown",destination_cluster=%q`, cluster)
				if scopedByConfig || !hasAllClusterNamespaceAccess(ctx, layer, cluster) {
					namespaces, err := layer.Namespace.GetClusterNamespaces(ctx, cluster)
					if err != nil {
						zl.Debug().Err(err).Str("cluster", cluster).Msg("OverviewServiceLatencies: could not get namespaces for cluster")
						continue
					}
					nsRegex := buildNamespaceRegex(namespaces)
					if nsRegex == "" {
						continue
					}

					labels = fmt.Sprintf(`%s,destination_service_namespace=~%q`, labels, nsRegex)
				}

				query := buildLatencyQuery(labels, groupBy, rateInterval, overviewServiceMetricsLimit)
				zl.Trace().Str("cluster", cluster).Msgf("OverviewServiceLatencies query: %s", query)

				result, warnings, err := prom.API().Query(ctx, query, queryTime)
				if len(warnings) > 0 {
					zl.Warn().Str("cluster", cluster).Msgf("OverviewServiceLatencies. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
				}
				if err != nil {
					failedClusterQueries++
					lastQueryErr = err
					zl.Warn().Err(err).Str("cluster", cluster).Msg("OverviewServiceLatencies: Prometheus query failed for cluster")
					continue
				}

				vector, ok := result.(model.Vector)
				if !ok {
					failedClusterQueries++
					lastQueryErr = fmt.Errorf("unexpected Prometheus result type: %T", result)
					zl.Warn().Str("cluster", cluster).Msg("OverviewServiceLatencies: unexpected Prometheus result type for cluster")
					continue
				}

				clusterServices := convertToServiceLatencies(vector)
				for i := range clusterServices {
					// Some telemetry setups may omit destination_cluster. If we scoped the query to a cluster, default it.
					if clusterServices[i].Cluster == "" {
						clusterServices[i].Cluster = cluster
					}
				}

				services = append(services, clusterServices...)
				successfulClusterQueries++
			}

			// If Prometheus queries failed for all clusters, surface an error (so UI shows error state).
			if successfulClusterQueries == 0 && failedClusterQueries > 0 && lastQueryErr != nil {
				RespondWithError(w, http.StatusServiceUnavailable, "Error querying Prometheus in service latencies: "+lastQueryErr.Error())
				return
			}

			// Sort and take global top N across all clusters.
			sort.Slice(services, func(i, j int) bool {
				return services[i].Latency > services[j].Latency
			})
			if overviewServiceMetricsLimit < len(services) {
				services = services[:overviewServiceMetricsLimit]
			}
		}

		enrichServiceLatenciesWithHealth(services, kialiCache, conf)
		response := models.ServiceLatencyResponse{
			Services: services,
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

// buildNamespaceRegex builds an anchored regex matching exactly the given namespaces.
// It returns an empty string if no valid namespaces are provided.
func buildNamespaceRegex(namespaces []models.Namespace) string {
	ns := make([]string, 0, len(namespaces))
	for _, n := range namespaces {
		if n.Name == "" {
			continue
		}
		ns = append(ns, regexp.QuoteMeta(n.Name))
	}
	if len(ns) == 0 {
		return ""
	}
	sort.Strings(ns)
	return "^(?:" + strings.Join(ns, "|") + ")$"
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

// hasAllClusterNamespaceAccess returns true if the user has access to the same set of namespaces
// as Kiali, for the specified cluster. If cluster is set to "", then test against all clusters
// that Kiali has access to.
func hasAllClusterNamespaceAccess(ctx context.Context, layer *business.Layer, cluster string) bool {
	zl := log.FromContext(ctx)

	var clusters []string
	if cluster == "" {
		// Use Kiali SA cluster list so the check fails if the user is missing any cluster.
		clusters = layer.Namespace.GetKialiSAClusterList()
	} else {
		clusters = []string{cluster}
	}

	for _, c := range clusters {
		userNs, err := layer.Namespace.GetClusterNamespaces(ctx, c)
		if err != nil {
			zl.Debug().Err(err).Str("cluster", c).Msg("hasAllClusterNamespaceAccess: could not get user namespaces")
			return false
		}

		kialiNs, err := layer.Namespace.GetKialiSAClusterNamespaces(ctx, c)
		if err != nil {
			zl.Debug().Err(err).Str("cluster", c).Msg("hasAllClusterNamespaceAccess: could not get Kiali SA namespaces")
			return false
		}

		// Build set of user namespace names for fast lookup
		userNsSet := make(map[string]struct{}, len(userNs))
		for _, ns := range userNs {
			userNsSet[ns.Name] = struct{}{}
		}

		// Check that all Kiali SA namespaces are in the user's namespace set
		for _, ns := range kialiNs {
			if _, ok := userNsSet[ns.Name]; !ok {
				return false
			}
		}
	}

	return true
}
