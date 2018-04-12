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

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

// MetricsQuery is a common struct for ServiceMetricsQuery and NamespaceMetricsQuery
type MetricsQuery struct {
	Version      string
	QueryTime    time.Time
	Duration     time.Duration
	Step         time.Duration
	RateInterval string
	RateFunc     string
	Filters      []string
	ByLabelsIn   []string
	ByLabelsOut  []string
}

// FillDefaults fills the struct with default parameters
func (q *MetricsQuery) FillDefaults() {
	q.QueryTime = time.Now()
	q.Duration = 30 * time.Minute
	q.Step = 15 * time.Second
	q.RateInterval = "1m"
	q.RateFunc = "rate"
}

// ServiceMetricsQuery contains fields used for querying a service metrics
type ServiceMetricsQuery struct {
	MetricsQuery
	Namespace string
	Service   string
}

// NamespaceMetricsQuery contains fields used for querying namespace metrics
type NamespaceMetricsQuery struct {
	MetricsQuery
	Namespace      string
	ServicePattern string
}

// Metrics contains health, all simple metrics and histograms data
type Metrics struct {
	Metrics    map[string]*Metric   `json:"metrics"`
	Histograms map[string]Histogram `json:"histograms"`
}

// Metric holds the Prometheus Matrix model, which contains one or more time series (depending on grouping)
type Metric struct {
	Matrix model.Matrix `json:"matrix"`
	err    error
}

// MetricsVector holds the Prometheus Vector model, which contains a sample from one or more time series
type MetricsVector struct {
	Vector model.Vector `json:"vector"`
	err    error
}

// Histogram contains Metric objects for several histogram-kind statistics
type Histogram struct {
	Average      *Metric `json:"average"`
	Median       *Metric `json:"median"`
	Percentile95 *Metric `json:"percentile95"`
	Percentile99 *Metric `json:"percentile99"`
}

// Returns <healthy, total, error>
func getServiceHealth(api v1.API, namespace string, servicename string) (int, int, error) {
	envoyClustername := strings.Replace(config.Get().Products.Istio.IstioIdentityDomain, ".", "_", -1)
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
		return 0, 0, healthyErr
	} else if totalErr != nil {
		return 0, 0, totalErr
	} else if len(healthyVect) == 0 || len(totalVect) == 0 {
		// Missing metrics
		return 0, 0, nil
	}
	return int(healthyVect[0].Value), int(totalVect[0].Value), nil
}

func getServiceMetrics(api v1.API, q *ServiceMetricsQuery) Metrics {
	clustername := config.Get().Products.Istio.IstioIdentityDomain
	destService := fmt.Sprintf("destination_service=\"%s.%s.%s\"", q.Service, q.Namespace, clustername)
	srcService := fmt.Sprintf("source_service=\"%s.%s.%s\"", q.Service, q.Namespace, clustername)
	labelsIn, labelsOut, labelsErrorIn, labelsErrorOut := buildLabelStrings(destService, srcService, q.Version)
	groupingIn := joinLabels(q.ByLabelsIn)
	groupingOut := joinLabels(q.ByLabelsOut)

	return fetchAllMetrics(api, &q.MetricsQuery, labelsIn, labelsOut, labelsErrorIn, labelsErrorOut, groupingIn, groupingOut)
}

func getNamespaceMetrics(api v1.API, q *NamespaceMetricsQuery) Metrics {
	svc := q.ServicePattern
	if "" == svc {
		svc = ".*"
	}
	destService := fmt.Sprintf("destination_service=~\"%s\\\\.%s\\\\..*\"", svc, q.Namespace)
	srcService := fmt.Sprintf("source_service=~\"%s\\\\.%s\\\\..*\"", svc, q.Namespace)
	labelsIn, labelsOut, labelsErrorIn, labelsErrorOut := buildLabelStrings(destService, srcService, q.Version)
	groupingIn := joinLabels(q.ByLabelsIn)
	groupingOut := joinLabels(q.ByLabelsOut)

	return fetchAllMetrics(api, &q.MetricsQuery, labelsIn, labelsOut, labelsErrorIn, labelsErrorOut, groupingIn, groupingOut)
}

func buildLabelStrings(destServiceLabel, srcServiceLabel, version string) (string, string, string, string) {
	versionLabelIn := ""
	versionLabelOut := ""
	if len(version) > 0 {
		versionLabelIn = fmt.Sprintf(",destination_version=\"%s\"", version)
		versionLabelOut = fmt.Sprintf(",source_version=\"%s\"", version)
	}

	labelsIn := fmt.Sprintf("{%s%s}", destServiceLabel, versionLabelIn)
	labelsOut := fmt.Sprintf("{%s%s}", srcServiceLabel, versionLabelOut)
	labelsErrorIn := fmt.Sprintf("{%s%s,response_code=~\"[5|4].*\"}", destServiceLabel, versionLabelIn)
	labelsErrorOut := fmt.Sprintf("{%s%s,response_code=~\"[5|4].*\"}", srcServiceLabel, versionLabelOut)

	return labelsIn, labelsOut, labelsErrorIn, labelsErrorOut
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

func fetchAllMetrics(api v1.API, q *MetricsQuery, labelsIn, labelsOut, labelsErrorIn, labelsErrorOut, groupingIn, groupingOut string) Metrics {
	bounds := v1.Range{
		Start: q.QueryTime.Add(-q.Duration),
		End:   q.QueryTime,
		Step:  q.Step}

	var wg sync.WaitGroup
	fetchRateInOut := func(p8sFamilyName string, metricIn **Metric, metricOut **Metric, lblIn string, lblOut string) {
		defer wg.Done()
		m := fetchRateRange(api, p8sFamilyName, lblIn, groupingIn, bounds, q.RateInterval, q.RateFunc)
		*metricIn = m
		m = fetchRateRange(api, p8sFamilyName, lblOut, groupingOut, bounds, q.RateInterval, q.RateFunc)
		*metricOut = m
	}

	fetchHistoInOut := func(p8sFamilyName string, hIn *Histogram, hOut *Histogram) {
		defer wg.Done()
		h := fetchHistogramRange(api, p8sFamilyName, labelsIn, groupingIn, bounds, q.RateInterval)
		*hIn = h
		h = fetchHistogramRange(api, p8sFamilyName, labelsOut, groupingOut, bounds, q.RateInterval)
		*hOut = h
	}

	type resultHolder struct {
		metricIn   *Metric
		metricOut  *Metric
		histoIn    Histogram
		histoOut   Histogram
		definition kialiMetric
	}
	maxResults := len(kialiMetrics)
	results := make([]*resultHolder, maxResults, maxResults)

	for i, metric := range kialiMetrics {
		// if filters is empty, fetch all anyway
		doFetch := len(q.Filters) == 0
		if !doFetch {
			for _, filter := range q.Filters {
				if filter == metric.name {
					doFetch = true
					break
				}
			}
		}
		if doFetch {
			wg.Add(1)
			result := resultHolder{definition: metric}
			results[i] = &result
			if metric.isHisto {
				go fetchHistoInOut(metric.istioName, &result.histoIn, &result.histoOut)
			} else {
				labelsInToUse, labelsOutToUse := metric.labelsToUse(labelsIn, labelsOut, labelsErrorIn, labelsErrorOut)
				go fetchRateInOut(metric.istioName, &result.metricIn, &result.metricOut, labelsInToUse, labelsOutToUse)
			}
		}
	}
	wg.Wait()

	// Return results as two maps
	metrics := make(map[string]*Metric)
	histograms := make(map[string]Histogram)
	for _, result := range results {
		if result != nil {
			if result.definition.isHisto {
				histograms[result.definition.name+"_in"] = result.histoIn
				histograms[result.definition.name+"_out"] = result.histoOut
			} else {
				metrics[result.definition.name+"_in"] = result.metricIn
				metrics[result.definition.name+"_out"] = result.metricOut
			}
		}
	}
	return Metrics{
		Metrics:    metrics,
		Histograms: histograms}
}

func fetchRateRange(api v1.API, metricName string, labels string, grouping string, bounds v1.Range, rateInterval string, rateFunc string) *Metric {
	var query string
	// Example: round(sum(rate(my_counter{foo=bar}[5m])) by (baz), 0.001)
	if grouping == "" {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])), 0.001)", rateFunc, metricName, labels, rateInterval)
	} else {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])) by (%s), 0.001)", rateFunc, metricName, labels, rateInterval, grouping)
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

func getNamespaceServicesRequestCounters(api v1.API, namespace string, ratesInterval string) MetricsVector {
	time := time.Now()
	labelsQuery := []string{
		fmt.Sprintf(`destination_service=~".*\\.%s\\..*"`, namespace),
		fmt.Sprintf(`source_service=~".*\\.%s\\..*"`, namespace),
	}

	var results model.Vector
	for _, labels := range labelsQuery {
		query := fmt.Sprintf("rate(istio_request_count{%s}[%s])", labels, ratesInterval)
		log.Infof("Request rate query: %v", query)

		result, err := api.Query(context.Background(), query, time)
		if err != nil {
			return MetricsVector{err: err}
		}
		results = append(results, result.(model.Vector)...)
	}

	return MetricsVector{Vector: results}
}
