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
}

type namedMetric struct {
	name   string
	metric Metric
}

// MetricValue represents a metric holding a single scalar (gauge or counter)
type MetricValue struct {
	Metric
	Value float64
}

// MetricHistogram hold some pre-defined stats from an histogram
type MetricHistogram struct {
	Metric
	Average     float64
	Median      float64
	NinetyFiveP float64
	NinetyNineP float64
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
		name: "Request count in",
		fcall: func() (Metric, error) {
			return fetchRate(api, "istio_request_count",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Request count out",
		fcall: func() (Metric, error) {
			return fetchRate(api, "istio_request_count",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Request size in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_size",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Request size out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_size",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Request duration in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_duration",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Request duration out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_request_duration",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Response size in",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_response_size",
				fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Response size out",
		fcall: func() (Metric, error) {
			return fetchHistogram(api, "istio_response_size",
				fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
		}}, {
		name: "Healthy replicas",
		fcall: func() (Metric, error) {
			return fetchGauge(api,
				fmt.Sprintf("envoy_cluster_out_%s_%s_%s_http_membership_healthy", servicename, namespace, envoyClustername),
				"", now)
		}}, {
		name: "Total replicas",
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
	return &MetricValue{
		Value: val}, nil
}

func fetchRate(api v1.API, metricName string, labels string, duration string, now time.Time) (*MetricValue, error) {
	query := fmt.Sprintf("rate(%s%s[%s])", metricName, labels, duration)
	val, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	return &MetricValue{
		Value: val}, nil
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

	var histo MetricHistogram
	var error error
	select {
	case histo.Average = <-avgChan:
	case error = <-errChan:
	}
	select {
	case histo.Median = <-medChan:
	case error = <-errChan:
	}
	select {
	case histo.NinetyFiveP = <-q95Chan:
	case error = <-errChan:
	}
	select {
	case histo.NinetyNineP = <-q99Chan:
	case error = <-errChan:
	}
	return &histo, error
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
	}
	return math.NaN(), nil
}
