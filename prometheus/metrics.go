package prometheus

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/swscore/config"
)

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

// Metrics contains health, all simple metrics and histograms data
type Metrics struct {
	Metrics    map[string]Metric    `json:"metrics"`
	Histograms map[string]Histogram `json:"histograms"`
	Health     *Health              `json:"health"`
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
	Average      Metric `json:"average"`
	Median       Metric `json:"median"`
	Percentile95 Metric `json:"percentile95"`
	Percentile99 Metric `json:"percentile99"`
}

type vectorResult struct {
	v   model.Vector
	err error
}

func getServiceHealthAsync(api v1.API, namespace string, servicename string, healthCh chan *Health) {
	envoyClustername := strings.Replace(config.Get().IstioIdentityDomain, ".", "_", -1)
	queryPart := replaceInvalidCharacters(fmt.Sprintf("%s_%s_%s", servicename, namespace, envoyClustername))
	now := time.Now()

	healthyCh := make(chan vectorResult)
	go fetchTimestamp(api, fmt.Sprintf("envoy_cluster_out_%s_http_membership_healthy", queryPart), now, healthyCh)

	totalCh := make(chan vectorResult)
	go fetchTimestamp(api, fmt.Sprintf("envoy_cluster_out_%s_http_membership_total", queryPart), now, totalCh)

	healthyVect := <-healthyCh
	totalVect := <-totalCh

	if healthyVect.err != nil {
		healthCh <- &Health{err: healthyVect.err}
	} else if totalVect.err != nil {
		healthCh <- &Health{err: totalVect.err}
	} else if len(healthyVect.v) == 0 || len(totalVect.v) == 0 {
		// Missing metrics
		healthCh <- nil
	} else {
		healthCh <- &Health{
			HealthyReplicas: int(healthyVect.v[0].Value),
			TotalReplicas:   int(totalVect.v[0].Value)}
	}
}

func getServiceMetricsAsync(api v1.API, namespace string, servicename string, duration time.Duration, step time.Duration,
	rateInterval string, byLabelsIn []string, byLabelsOut []string, metricsChan chan Metrics) {

	clustername := config.Get().IstioIdentityDomain
	now := time.Now()
	bounds := v1.Range{
		Start: now.Add(-duration),
		End:   now,
		Step:  step}

	labelsIn := fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername)
	labelsOut := fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername)
	groupingIn := joinLabels(byLabelsIn)
	groupingOut := joinLabels(byLabelsOut)

	fetchRateAsync := func(metricName string) (chan Metric, chan Metric) {
		chin := make(chan Metric)
		chout := make(chan Metric)
		go fetchRateRange(api, metricName, labelsIn, groupingIn, bounds, rateInterval, chin)
		go fetchRateRange(api, metricName, labelsOut, groupingOut, bounds, rateInterval, chout)
		return chin, chout
	}

	fetchHistoAsync := func(metricName string) (chan Histogram, chan Histogram) {
		chin := make(chan Histogram)
		chout := make(chan Histogram)
		go fetchHistogramRange(api, metricName, labelsIn, groupingIn, bounds, rateInterval, chin)
		go fetchHistogramRange(api, metricName, labelsOut, groupingOut, bounds, rateInterval, chout)
		return chin, chout
	}

	rqcountinCh, rqcountoutCh := fetchRateAsync("istio_request_count")
	rqsizeinCh, rqsizeoutCh := fetchHistoAsync("istio_request_size")
	rqdurinCh, rqduroutCh := fetchHistoAsync("istio_request_duration")
	rssizeinCh, rssizeoutCh := fetchHistoAsync("istio_response_size")

	metrics := make(map[string]Metric)
	histograms := make(map[string]Histogram)

	metrics["request_count_in"] = <-rqcountinCh
	metrics["request_count_out"] = <-rqcountoutCh
	histograms["request_size_in"] = <-rqsizeinCh
	histograms["request_size_out"] = <-rqsizeoutCh
	histograms["request_duration_in"] = <-rqdurinCh
	histograms["request_duration_out"] = <-rqduroutCh
	histograms["response_size_in"] = <-rssizeinCh
	histograms["response_size_out"] = <-rssizeoutCh

	metricsChan <- Metrics{
		Metrics:    metrics,
		Histograms: histograms}
}

func joinLabels(labels []string) string {
	str := ""
	if len(labels) > 0 {
		sep := ""
		for _, lbl := range labels {
			str = str + sep + lbl
			sep = ","
		}
	}
	return str
}

func fetchRateRange(api v1.API, metricName string, labels string, grouping string, bounds v1.Range, rateInterval string, ch chan Metric) {
	var query string
	if grouping == "" {
		query = fmt.Sprintf("round(sum(irate(%s%s[%s])), 0.001)", metricName, labels, rateInterval)
	} else {
		query = fmt.Sprintf("round(sum(irate(%s%s[%s])) by (%s), 0.001)", metricName, labels, rateInterval, grouping)
	}
	fetchRange(api, query, bounds, ch)
}

func fetchHistogramRange(api v1.API, metricName string, labels string, grouping string, bounds v1.Range, rateInterval string, ch chan Histogram) {
	// Note: we may want to make returned stats configurable in the future
	avgChan, medChan, p95Chan, p99Chan := make(chan Metric), make(chan Metric), make(chan Metric), make(chan Metric)

	groupingAvg := ""
	groupingQuantile := ""
	if grouping != "" {
		groupingAvg = fmt.Sprintf(" by (%s)", grouping)
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}

	// Average
	go func() {
		// Example: sum(rate(my_histogram_sum{foo=bar}[5m])) by (baz) / sum(rate(my_histogram_count{foo=bar}[5m])) by (baz)
		query := fmt.Sprintf(
			"sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s", metricName, labels, rateInterval, groupingAvg,
			metricName, labels, rateInterval, groupingAvg)
		fetchRange(api, query, bounds, avgChan)
	}()

	// Median
	go func() {
		// Example: histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz))
		query := fmt.Sprintf(
			"histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
		fetchRange(api, query, bounds, medChan)
	}()

	// Quantile 95
	go func() {
		query := fmt.Sprintf(
			"histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
		fetchRange(api, query, bounds, p95Chan)
	}()

	// Quantile 99
	go func() {
		query := fmt.Sprintf(
			"histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
		fetchRange(api, query, bounds, p99Chan)
	}()

	ch <- Histogram{
		Average:      <-avgChan,
		Median:       <-medChan,
		Percentile95: <-p95Chan,
		Percentile99: <-p99Chan}
}

func fetchTimestamp(api v1.API, query string, t time.Time, ch chan vectorResult) {
	result, err := api.Query(context.Background(), query, t)
	if err != nil {
		ch <- vectorResult{err: err}
		return
	}
	switch result.Type() {
	case model.ValVector:
		ch <- vectorResult{v: result.(model.Vector)}
		return
	}
	ch <- vectorResult{err: fmt.Errorf("Invalid query, vector expected: %s", query)}
}

func fetchRange(api v1.API, query string, bounds v1.Range, ch chan Metric) {
	result, err := api.QueryRange(context.Background(), query, bounds)
	if err != nil {
		ch <- Metric{err: err}
		return
	}
	switch result.Type() {
	case model.ValMatrix:
		ch <- Metric{Matrix: result.(model.Matrix)}
		return
	}
	ch <- Metric{err: fmt.Errorf("Invalid query, matrix expected: %s", query)}
}

func replaceInvalidCharacters(metricName string) string {
	// See https://github.com/prometheus/prometheus/blob/master/util/strutil/strconv.go#L43
	return invalidLabelCharRE.ReplaceAllString(metricName, "_")
}
