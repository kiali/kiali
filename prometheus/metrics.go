package prometheus

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/swift-sunshine/swscore/config"
)

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

// Metrics contains health, all simple metrics and histograms data
type Metrics struct {
	Metrics    map[string]*Metric   `json:"metrics"`
	Histograms map[string]Histogram `json:"histograms"`
}

// Health contains information about healthy replicas for a service
type Health struct {
	HealthyReplicas int `json:"healthyReplicas"`
	TotalReplicas   int `json:"totalReplicas"`
	err             error
}

// Metric holds the Prometheus Matrix model, which contains one or more time series (depending on grouping)
type Metric struct {
	Matrix model.Matrix `json:"matrix"`
	err    error
}

// Histogram contains Metric objects for several histogram-kind statistics
type Histogram struct {
	Average      *Metric `json:"average"`
	Median       *Metric `json:"median"`
	Percentile95 *Metric `json:"percentile95"`
	Percentile99 *Metric `json:"percentile99"`
}

func getServiceHealth(api v1.API, namespace string, servicename string) Health {
	envoyClustername := strings.Replace(config.Get().IstioIdentityDomain, ".", "_", -1)
	queryPart := replaceInvalidCharacters(fmt.Sprintf("%s_%s_%s", servicename, namespace, envoyClustername))
	now := time.Now()

	var healthyVect, totalVect model.Vector
	var healthyErr, totalErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		healthyVect, healthyErr = fetchTimestamp(api, fmt.Sprintf("envoy_cluster_out_%s_http_membership_healthy", queryPart), now)
	}()

	go func() {
		defer wg.Done()
		totalVect, totalErr = fetchTimestamp(api, fmt.Sprintf("envoy_cluster_out_%s_http_membership_total", queryPart), now)
	}()

	wg.Wait()

	if healthyErr != nil {
		return Health{err: healthyErr}
	} else if totalErr != nil {
		return Health{err: totalErr}
	} else if len(healthyVect) == 0 || len(totalVect) == 0 {
		// Missing metrics
		return Health{}
	}
	return Health{
		HealthyReplicas: int(healthyVect[0].Value),
		TotalReplicas:   int(totalVect[0].Value)}
}

func getServiceMetrics(api v1.API, namespace string, servicename string, duration time.Duration, step time.Duration,
	rateInterval string) Metrics {

	clustername := config.Get().IstioIdentityDomain
	now := time.Now()
	bounds := v1.Range{
		Start: now.Add(-duration),
		End:   now,
		Step:  step}

	labelsIn := fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername)
	labelsOut := fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername)

	var wg sync.WaitGroup

	var requestCountIn, requestCountOut *Metric
	var requestSizeIn, requestSizeOut, requestDurationIn, requestDurationOut, responseSizeIn, responseSizeOut Histogram

	fetchRateInOut := func(p8sFamilyName string, metricIn **Metric, metricOut **Metric) {
		m := fetchRateRange(api, p8sFamilyName, labelsIn, bounds, rateInterval)
		*metricIn = m
		m = fetchRateRange(api, p8sFamilyName, labelsOut, bounds, rateInterval)
		*metricOut = m
		wg.Done()
	}

	fetchHistoInOut := func(p8sFamilyName string, hIn *Histogram, hOut *Histogram) {
		h := fetchHistogramRange(api, p8sFamilyName, labelsIn, bounds, rateInterval)
		*hIn = h
		h = fetchHistogramRange(api, p8sFamilyName, labelsOut, bounds, rateInterval)
		*hOut = h
		wg.Done()
	}

	// Prepare 4 calls
	wg.Add(4)
	go fetchRateInOut("istio_request_count", &requestCountIn, &requestCountOut)
	go fetchHistoInOut("istio_request_size", &requestSizeIn, &requestSizeOut)
	go fetchHistoInOut("istio_request_duration", &requestDurationIn, &requestDurationOut)
	go fetchHistoInOut("istio_response_size", &responseSizeIn, &responseSizeOut)

	wg.Wait()

	metrics := make(map[string]*Metric)
	histograms := make(map[string]Histogram)
	metrics["request_count_in"] = requestCountIn
	metrics["request_count_out"] = requestCountOut
	histograms["request_size_in"] = requestSizeIn
	histograms["request_size_out"] = requestSizeOut
	histograms["request_duration_in"] = requestDurationIn
	histograms["request_duration_out"] = requestDurationOut
	histograms["response_size_in"] = responseSizeIn
	histograms["response_size_out"] = responseSizeOut

	return Metrics{
		Metrics:    metrics,
		Histograms: histograms}
}

func fetchRateRange(api v1.API, metricName string, labels string, bounds v1.Range, rateInterval string) *Metric {
	query := fmt.Sprintf("rate(%s%s[%s])", metricName, labels, rateInterval)
	return fetchRange(api, query, bounds)
}

func fetchHistogramRange(api v1.API, metricName string, labels string, bounds v1.Range, rateInterval string) Histogram {
	// Note: we may want to make returned stats configurable in the future
	var avg, med, p95, p99 *Metric
	var wg sync.WaitGroup
	wg.Add(4)

	// Average
	go func() {
		defer wg.Done()
		query := fmt.Sprintf(
			"sum(rate(%s_sum%s[%s])) / sum(rate(%s_count%s[%s]))", metricName, labels, rateInterval, metricName, labels, rateInterval)
		avg = fetchRange(api, query, bounds)
	}()

	// Median
	go func() {
		defer wg.Done()
		query := fmt.Sprintf(
			"histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, rateInterval)
		med = fetchRange(api, query, bounds)
	}()

	// Quantile 95
	go func() {
		defer wg.Done()
		query := fmt.Sprintf(
			"histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, rateInterval)
		p95 = fetchRange(api, query, bounds)
	}()

	// Quantile 99
	go func() {
		defer wg.Done()
		query := fmt.Sprintf(
			"histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, rateInterval)
		p99 = fetchRange(api, query, bounds)
	}()

	wg.Wait()
	return Histogram{
		Average:      avg,
		Median:       med,
		Percentile95: p95,
		Percentile99: p99}
}

func fetchTimestamp(api v1.API, query string, t time.Time) (model.Vector, error) {
	result, err := api.Query(context.Background(), query, t)
	if err != nil {
		return nil, err
	}
	switch result.Type() {
	case model.ValVector:
		return result.(model.Vector), nil
	}
	return nil, fmt.Errorf("Invalid query, vector expected: %s", query)
}

func fetchRange(api v1.API, query string, bounds v1.Range) *Metric {
	result, err := api.QueryRange(context.Background(), query, bounds)
	if err != nil {
		return &Metric{err: err}
	}
	switch result.Type() {
	case model.ValMatrix:
		return &Metric{Matrix: result.(model.Matrix)}
	}
	return &Metric{err: fmt.Errorf("Invalid query, matrix expected: %s", query)}
}

func replaceInvalidCharacters(metricName string) string {
	// See https://github.com/prometheus/prometheus/blob/master/util/strutil/strconv.go#L43
	return invalidLabelCharRE.ReplaceAllString(metricName, "_")
}
