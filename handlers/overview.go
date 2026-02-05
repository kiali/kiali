package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
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
		`topk(%d, histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{%s}[%s])) by (le,%s)) > 0)`,
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
