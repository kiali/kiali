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

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

type Operator string

const EQUALS Operator = "="
const REGEX Operator = "=~"
const REGEX_NOT Operator = "!~"

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

func getServiceMetrics(api v1.API, namespace, servicename, version string, duration, step time.Duration,
	rateInterval string, byLabelsIn, byLabelsOut []string, op Operator) Metrics {

	clustername := config.Get().IstioIdentityDomain
	now := time.Now()
	bounds := v1.Range{
		Start: now.Add(-duration),
		End:   now,
		Step:  step}

	versionLabelIn := ""
	versionLabelOut := ""
	if len(version) > 0 {
		versionLabelIn = fmt.Sprintf(",destination_version=\"%s\"", version)
		versionLabelOut = fmt.Sprintf(",source_version=\"%s\"", version)
	}

	var labelsIn, labelsOut, labelsErrorIn, labelsErrorOut string
	if op == "" || op == EQUALS {
		labelsIn = fmt.Sprintf("{destination_service=\"%s.%s.%s\"%s}", servicename, namespace, clustername, versionLabelIn)
		labelsOut = fmt.Sprintf("{source_service=\"%s.%s.%s\"%s}", servicename, namespace, clustername, versionLabelOut)
		labelsErrorIn = fmt.Sprintf("{destination_service=\"%s.%s.%s\",response_code=~\"[5|4].*\"%s}", servicename, namespace, clustername, versionLabelIn)
		labelsErrorOut = fmt.Sprintf("{source_service=\"%s.%s.%s\",response_code=~\"[5|4].*\"%s}", servicename, namespace, clustername, versionLabelOut)
	} else {
		svc := servicename
		if "" == svc {
			svc = ".*"
		}
		labelsIn = fmt.Sprintf("{destination_service%s\"%s\\\\.%s\\\\..*\"%s}", op, svc, namespace, versionLabelIn)
		labelsOut = fmt.Sprintf("{source_service%s\"%s\\\\.%s\\\\..*\"%s}", op, svc, namespace, versionLabelOut)
		labelsErrorIn = fmt.Sprintf("{destination_service%s\"%s\\\\.%s\\\\..*\",response_code=~\"[5|4].*\"%s}", op, svc, namespace, versionLabelIn)
		labelsErrorOut = fmt.Sprintf("{source_service%s\"%v\\\\.%v\\\\..*\",response_code=~\"[5|4].*\"%s}", op, svc, namespace, versionLabelOut)
	}
	groupingIn := joinLabels(byLabelsIn)
	groupingOut := joinLabels(byLabelsOut)

	var wg sync.WaitGroup

	var requestCountIn, requestCountOut, requestErrorCountIn, requestErrorCountOut *Metric
	var requestSizeIn, requestSizeOut, requestDurationIn, requestDurationOut, responseSizeIn, responseSizeOut Histogram

	fetchRateInOut := func(p8sFamilyName string, metricIn **Metric, metricOut **Metric, metricErrorIn **Metric, metricErrorOut **Metric) {
		defer wg.Done()
		m := fetchRateRange(api, p8sFamilyName, labelsIn, groupingIn, bounds, rateInterval)
		*metricIn = m
		m = fetchRateRange(api, p8sFamilyName, labelsOut, groupingOut, bounds, rateInterval)
		*metricOut = m
		m = fetchRateRange(api, p8sFamilyName, labelsErrorIn, groupingIn, bounds, rateInterval)
		*metricErrorIn = m
		m = fetchRateRange(api, p8sFamilyName, labelsErrorOut, groupingOut, bounds, rateInterval)
		*metricErrorOut = m
	}

	fetchHistoInOut := func(p8sFamilyName string, hIn *Histogram, hOut *Histogram) {
		defer wg.Done()
		h := fetchHistogramRange(api, p8sFamilyName, labelsIn, groupingIn, bounds, rateInterval)
		*hIn = h
		h = fetchHistogramRange(api, p8sFamilyName, labelsOut, groupingOut, bounds, rateInterval)
		*hOut = h
	}

	// Prepare 4 calls
	wg.Add(4)
	go fetchRateInOut("istio_request_count", &requestCountIn, &requestCountOut, &requestErrorCountIn, &requestErrorCountOut)
	go fetchHistoInOut("istio_request_size", &requestSizeIn, &requestSizeOut)
	go fetchHistoInOut("istio_request_duration", &requestDurationIn, &requestDurationOut)
	go fetchHistoInOut("istio_response_size", &responseSizeIn, &responseSizeOut)

	wg.Wait()

	metrics := make(map[string]*Metric)
	histograms := make(map[string]Histogram)
	metrics["request_count_in"] = requestCountIn
	metrics["request_count_out"] = requestCountOut
	metrics["request_error_count_in"] = requestErrorCountIn
	metrics["request_error_count_out"] = requestErrorCountOut
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

func fetchRateRange(api v1.API, metricName string, labels string, grouping string, bounds v1.Range, rateInterval string) *Metric {
	var query string
	if grouping == "" {
		query = fmt.Sprintf("round(sum(irate(%s%s[%s])), 0.001)", metricName, labels, rateInterval)
	} else {
		query = fmt.Sprintf("round(sum(irate(%s%s[%s])) by (%s), 0.001)", metricName, labels, rateInterval, grouping)
	}
	log.Infof("QUERY: %v", query)
	return fetchRange(api, query, bounds)
}

func fetchHistogramRange(api v1.API, metricName string, labels string, grouping string, bounds v1.Range, rateInterval string) Histogram {
	// Note: we may want to make returned stats configurable in the future
	// Note 2: the p8s queries are not run in parallel here, but they are at the caller's place.
	//	This is because we may not want to create too many threads in the lowest layer

	groupingAvg := ""
	groupingQuantile := ""
	if grouping != "" {
		groupingAvg = fmt.Sprintf(" by (%s)", grouping)
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}

	// Average
	// Example: sum(rate(my_histogram_sum{foo=bar}[5m])) by (baz) / sum(rate(my_histogram_count{foo=bar}[5m])) by (baz)
	query := fmt.Sprintf(
		"sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s", metricName, labels, rateInterval, groupingAvg,
		metricName, labels, rateInterval, groupingAvg)
	avg := fetchRange(api, query, bounds)

	// Median
	// Example: histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz))
	query = fmt.Sprintf(
		"histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
	med := fetchRange(api, query, bounds)

	// Quantile 95
	query = fmt.Sprintf(
		"histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
	p95 := fetchRange(api, query, bounds)

	// Quantile 99
	query = fmt.Sprintf(
		"histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le%s))", metricName, labels, rateInterval, groupingQuantile)
	p99 := fetchRange(api, query, bounds)

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
