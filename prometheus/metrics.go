package prometheus

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/swift-sunshine/swscore/config"
)

// Metric is a base interface for either MetricValue (single scalar, gauge or counter) or MetricHistogram
type Metric interface {
	exists() bool
}

type namedMetric struct {
	name   string
	metric Metric
}

// MetricValue represents a metric holding a single scalar (gauge or counter)
type MetricValue struct {
	Metric `json:"-"`
	Value  float64
	found  bool
}

func (m MetricValue) exists() bool {
	return m.found
}

// MetricHistogram hold some pre-defined stats from an histogram
type MetricHistogram struct {
	Metric      `json:"-"`
	Average     float64
	Median      float64
	NinetyFiveP float64
	NinetyNineP float64
	found       bool
}

func (m MetricHistogram) exists() bool {
	return m.found
}

func getServiceMetricsAsync(api v1.API, namespace string, servicename string, duration string, metricChan chan namedMetric,
	errChan chan error) int {

	now := time.Now()
	clustername := config.Get().IstioIdentityDomain
	envoyClustername := strings.Replace(clustername, ".", "_", -1)

	type namedCall struct {
		fcall func() (Metric, error)
		name  string
	}
	// Curry calls
	calls := []namedCall{{
		name: "request_count_in",
		fcall: func() (Metric, error) {
			return fetchRate(api, "istio_request_count",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "request_count_out",
		fcall: func() (Metric, error) {
			return fetchRate(api, "istio_request_count",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "request_size_in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_size",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "request_size_out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_size",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "request_duration_in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_duration",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "request_duration_out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_duration",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "response_size_in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_response_size",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "response_size_out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_response_size",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "healthy_replicas",
		fcall: func() (Metric, error) {
			return fetchGauge(api,
				fmt.Sprintf("envoy_cluster_out_%s_%s_%s_http_membership_healthy", servicename, namespace, envoyClustername),
				"", now)
		}}, {
		name: "total_replicas",
		fcall: func() (Metric, error) {
			return fetchGauge(api,
				fmt.Sprintf("envoy_cluster_out_%s_%s_%s_http_membership_total", servicename, namespace, envoyClustername),
				"", now)
		}}}

	for _, c := range calls {
		go func(namedCall namedCall) {
			metric, err := namedCall.fcall()
			if err != nil {
				errChan <- err
			} else {
				metricChan <- namedMetric{
					name:   namedCall.name,
					metric: metric}
			}
		}(c)
	}
	return len(calls)
}

func fetchGauge(api v1.API, metricName string, labels string, now time.Time) (*MetricValue, error) {
	query := fmt.Sprintf("%s%s", metricName, labels)
	val, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	// NaN value is considered as a missing metric
	if math.IsNaN(val) {
		return &MetricValue{found: false}, nil
	}
	return &MetricValue{Value: val, found: true}, nil
}

func fetchRate(api v1.API, metricName string, labels string, duration string, now time.Time) (*MetricValue, error) {
	query := fmt.Sprintf("rate(%s%s[%s])", metricName, labels, duration)
	val, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	// NaN value is considered as a missing metric
	if math.IsNaN(val) {
		return &MetricValue{found: false}, nil
	}
	return &MetricValue{Value: val, found: true}, nil
}

func fetchHistogram(api v1.API, metricName string, labels string, duration string, now time.Time) (*MetricHistogram, error) {
	// Note: we may want to make returned stats configurable in the future
	avgChan, medChan, q95Chan, q99Chan := make(chan float64), make(chan float64), make(chan float64), make(chan float64)
	errChan := make(chan error)

	// Average
	go func() {
		query := fmt.Sprintf(
			"sum(rate(%s_sum%s[%s])) / sum(rate(%s_count%s[%s]))", metricName, labels, duration, metricName, labels, duration)
		avg, err := fetchScalarDouble(api, query, now)
		if err != nil {
			errChan <- err
		} else {
			avgChan <- avg
		}
	}()

	// Median
	go func() {
		query := fmt.Sprintf(
			"histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
		med, err := fetchScalarDouble(api, query, now)
		if err != nil {
			errChan <- err
		} else {
			medChan <- med
		}
	}()

	// Quantile 95
	go func() {
		query := fmt.Sprintf(
			"histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
		q95, err := fetchScalarDouble(api, query, now)
		if err != nil {
			errChan <- err
		} else {
			q95Chan <- q95
		}
	}()

	// Quantile 99
	go func() {
		query := fmt.Sprintf(
			"histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
		q99, err := fetchScalarDouble(api, query, now)
		if err != nil {
			errChan <- err
		} else {
			q99Chan <- q99
		}
	}()

	var histo = MetricHistogram{found: true}
	var metricError error
	select {
	case histo.Average = <-avgChan:
	case metricError = <-errChan:
	}
	select {
	case histo.Median = <-medChan:
	case metricError = <-errChan:
	}
	select {
	case histo.NinetyFiveP = <-q95Chan:
	case metricError = <-errChan:
	}
	select {
	case histo.NinetyNineP = <-q99Chan:
	case metricError = <-errChan:
	}
	// Any NaN value is considered as a missing metric
	if math.IsNaN(histo.Average) || math.IsNaN(histo.Median) || math.IsNaN(histo.NinetyFiveP) || math.IsNaN(histo.NinetyNineP) {
		return &MetricHistogram{found: false}, nil
	}
	return &histo, metricError
}

func fetchScalarDouble(api v1.API, query string, now time.Time) (float64, error) {
	result, err := api.Query(context.Background(), query, now)
	if err != nil {
		return 0, err
	}
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		if len(matrix) > 0 {
			return float64(matrix[0].Value), nil
		}
		// Else, no value
		return math.NaN(), nil
	}
	return 0, fmt.Errorf("Invalid query, vector expected: %s", query)
}
