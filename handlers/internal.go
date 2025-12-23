package handlers

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	kialiprometheus "github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// InternalMetrics holds a subset of Kiali's internal metrics that can be exposed via the API.
// This is useful for testing and monitoring without having to scrape the Prometheus metrics endpoint.
type InternalMetrics struct {
	GraphCacheEvictions float64 `json:"graphCacheEvictions"`
	GraphCacheHits      float64 `json:"graphCacheHits"`
	GraphCacheMisses    float64 `json:"graphCacheMisses"`
}

// getCounterValue extracts the current value from a Prometheus Counter.
func getCounterValue(counter prometheus.Counter) float64 {
	m := &dto.Metric{}
	if err := counter.Write(m); err != nil {
		return 0
	}
	return m.Counter.GetValue()
}

// GraphCacheMetricsHandler returns Kiali's graph cache metrics in JSON format.
// This endpoint provides a simple way to access internal metrics without having to
// parse the Prometheus text format from the /metrics endpoint.
func GraphCacheMetricsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics := InternalMetrics{
			GraphCacheEvictions: getCounterValue(internalmetrics.GetGraphCacheEvictionsTotalMetric()),
			GraphCacheHits:      getCounterValue(internalmetrics.GetGraphCacheHitsTotalMetric()),
			GraphCacheMisses:    getCounterValue(internalmetrics.GetGraphCacheMissesTotalMetric()),
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// DisabledFeatures holds information about Kiali features that are disabled
// due to missing Istio metrics in Prometheus.
type DisabledFeatures struct {
	RequestSize             bool `json:"requestSize"`
	RequestSizeAverage      bool `json:"requestSizeAverage"`
	RequestSizePercentiles  bool `json:"requestSizePercentiles"`
	ResponseSize            bool `json:"responseSize"`
	ResponseSizeAverage     bool `json:"responseSizeAverage"`
	ResponseSizePercentiles bool `json:"responseSizePercentiles"`
	ResponseTime            bool `json:"responseTime"`
	ResponseTimeAverage     bool `json:"responseTimeAverage"`
	ResponseTimePercentiles bool `json:"responseTimePercentiles"`
}

// DisabledFeaturesHandler returns information about Kiali features that are disabled
// due to missing Istio metrics in Prometheus.
func DisabledFeaturesHandler(conf *config.Config, client kialiprometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger := log.FromRequest(r)

		defer handlePanic(r.Context(), w)

		requiredMetrics := []string{
			"istio_request_bytes_bucket",
			"istio_request_bytes_count",
			"istio_request_bytes_sum",
			"istio_request_duration_milliseconds_bucket",
			"istio_request_duration_milliseconds_count",
			"istio_request_duration_milliseconds_sum",
			"istio_requests_total",
			"istio_response_bytes_bucket",
			"istio_response_bytes_count",
			"istio_response_bytes_sum",
		}

		// assume nothing disabled on error
		disabledFeatures := DisabledFeatures{}

		// TODO: Getting metric names is not yet supported in offline mode.
		if conf.RunMode == config.RunModeOffline {
			RespondWithJSONIndent(w, http.StatusOK, disabledFeatures)
			return
		}

		existingMetrics, err := client.GetExistingMetricNames(r.Context(), requiredMetrics)
		if !checkErr(err, "", logger) {
			log.Error(err)
			RespondWithJSONIndent(w, http.StatusOK, disabledFeatures)
		}

		// if we have all of the metrics then nothing is disabled, just return
		// if we have no metrics then we have no requests (note that we check for istio_request_totals), nothing is known to be disabled
		if len(existingMetrics) == len(requiredMetrics) || len(existingMetrics) == 0 {
			RespondWithJSONIndent(w, http.StatusOK, disabledFeatures)
		}

		exists := make(map[string]bool, len(existingMetrics))
		for _, metric := range existingMetrics {
			exists[metric] = true
		}

		disabledFeatures.RequestSize = !exists["istio_request_bytes_sum"]
		disabledFeatures.RequestSizeAverage = disabledFeatures.RequestSize || !exists["istio_request_bytes_count"]
		disabledFeatures.RequestSizePercentiles = disabledFeatures.RequestSizeAverage || !exists["istio_request_bytes_bucket"]

		disabledFeatures.ResponseSize = !exists["istio_response_bytes_sum"]
		disabledFeatures.ResponseSizeAverage = disabledFeatures.ResponseSize || !exists["istio_response_bytes_count"]
		disabledFeatures.ResponseSizePercentiles = disabledFeatures.ResponseSizeAverage || !exists["istio_response_bytes_bucket"]

		disabledFeatures.ResponseTime = !exists["istio_request_duration_milliseconds_sum"]
		disabledFeatures.ResponseTimeAverage = disabledFeatures.ResponseTime || !exists["istio_request_duration_milliseconds_count"]
		disabledFeatures.ResponseTimePercentiles = disabledFeatures.ResponseTimeAverage || !exists["istio_request_duration_milliseconds_bucket"]

		RespondWithJSONIndent(w, http.StatusOK, disabledFeatures)
	}
}
