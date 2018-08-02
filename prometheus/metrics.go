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
)

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

// MetricsQuery holds query parameters for a typical metrics query
type MetricsQuery struct {
	v1.Range
	RateInterval string
	RateFunc     string
	Filters      []string
	ByLabelsIn   []string
	ByLabelsOut  []string
	Namespace    string
	Apps         []string
	Workload     string
}

// FillDefaults fills the struct with default parameters
func (q *MetricsQuery) FillDefaults() {
	q.End = time.Now()
	q.Start = q.End.Add(-30 * time.Minute)
	q.Step = 15 * time.Second
	q.RateInterval = "1m"
	q.RateFunc = "rate"
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

// Histogram contains Metric objects for several histogram-kind statistics
type Histogram struct {
	Average      *Metric `json:"average"`
	Median       *Metric `json:"median"`
	Percentile95 *Metric `json:"percentile95"`
	Percentile99 *Metric `json:"percentile99"`
}

// EnvoyHealth is the number of healthy versus total membership (ie. replicas) inside envoy cluster (ie. service)
type EnvoyHealth struct {
	Inbound  EnvoyRatio `json:"inbound"`
	Outbound EnvoyRatio `json:"outbound"`
}

// EnvoyRatio is the number of healthy members versus total members
type EnvoyRatio struct {
	Healthy int `json:"healthy"`
	Total   int `json:"total"`
}

func getServiceHealth(api v1.API, namespace, servicename string, ports []int32) (EnvoyHealth, error) {
	ret := EnvoyHealth{}
	if len(ports) == 0 {
		return ret, nil
	}

	envoyClustername := strings.Replace(config.Get().ExternalServices.Istio.IstioIdentityDomain, ".", "_", -1)
	queryPart := replaceInvalidCharacters(fmt.Sprintf("%s_%s_%s", servicename, namespace, envoyClustername))
	now := time.Now()

	inboundHealthyChan, inboundTotalChan, outboundHealthyChan, outboundTotalChan := make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports))
	done := make(chan bool)
	errChan := make(chan error)

	// Note: metric names below probably depend on some istio configuration.
	// They should anyway change soon in a more prometheus-friendly way,
	// see https://github.com/istio/istio/issues/4854 and https://github.com/istio/istio/pull/5069

	for _, _port := range ports {
		// Inbound
		go func(port int) {
			defer func() { done <- true }()
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_inbound_%d__%s_membership_healthy", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				inboundHealthyChan <- vec[0].Value
			}
		}(int(_port))
		go func(port int) {
			defer func() { done <- true }()
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_inbound_%d__%s_membership_total", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				inboundTotalChan <- vec[0].Value
			}
		}(int(_port))
		// Outbound
		go func(port int) {
			defer func() { done <- true }()
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_outbound_%d__%s_membership_healthy", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				outboundHealthyChan <- vec[0].Value
			}
		}(int(_port))
		go func(port int) {
			defer func() { done <- true }()
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_outbound_%d__%s_membership_total", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				outboundTotalChan <- vec[0].Value
			}
		}(int(_port))
	}

	var err error
	for count := 0; count < len(ports)*4; {
		select {
		case v := <-inboundHealthyChan:
			ret.Inbound.Healthy += int(v)
		case v := <-inboundTotalChan:
			ret.Inbound.Total += int(v)
		case v := <-outboundHealthyChan:
			ret.Outbound.Healthy += int(v)
		case v := <-outboundTotalChan:
			ret.Outbound.Total += int(v)
		case err = <-errChan:
		case <-done:
			count++
		}
	}
	return ret, err
}

func getMetrics(api v1.API, q *MetricsQuery) Metrics {
	labelsIn, labelsOut, labelsErrorIn, labelsErrorOut := buildLabelStrings(q)
	groupingIn := strings.Join(q.ByLabelsIn, ",")
	groupingOut := strings.Join(q.ByLabelsOut, ",")

	return fetchAllMetrics(api, q, labelsIn, labelsOut, labelsErrorIn, labelsErrorOut, groupingIn, groupingOut)
}

func buildLabelStrings(q *MetricsQuery) (string, string, string, string) {
	labelsIn := []string{`reporter="destination"`}
	labelsOut := []string{`reporter="source"`}
	if config.Get().IstioNamespace == q.Namespace {
		labelsOut = []string{`reporter="destination"`}
	}

	if q.Workload != "" {
		labelsIn = append(labelsIn, fmt.Sprintf(`destination_workload="%s"`, q.Workload))
		labelsOut = append(labelsOut, fmt.Sprintf(`source_workload="%s"`, q.Workload))
	}
	if len(q.Apps) == 1 {
		labelsIn = append(labelsIn, fmt.Sprintf(`destination_app="%s"`, q.Apps[0]))
		labelsOut = append(labelsOut, fmt.Sprintf(`source_app="%s"`, q.Apps[0]))
	} else if len(q.Apps) > 1 {
		apps := strings.Join(q.Apps, "|")
		labelsIn = append(labelsIn, fmt.Sprintf(`destination_app=~"%s"`, apps))
		labelsOut = append(labelsOut, fmt.Sprintf(`source_app=~"%s"`, apps))
	}
	if q.Namespace != "" {
		labelsIn = append(labelsIn, fmt.Sprintf(`destination_workload_namespace="%s"`, q.Namespace))
		labelsOut = append(labelsOut, fmt.Sprintf(`source_workload_namespace="%s"`, q.Namespace))
	}

	fullIn := "{" + strings.Join(labelsIn, ",") + "}"
	fullOut := "{" + strings.Join(labelsOut, ",") + "}"

	labelsIn = append(labelsIn, `response_code=~"[5|4].*"`)
	labelsOut = append(labelsOut, `response_code=~"[5|4].*"`)
	errorIn := "{" + strings.Join(labelsIn, ",") + "}"
	errorOut := "{" + strings.Join(labelsOut, ",") + "}"

	return fullIn, fullOut, errorIn, errorOut
}

func fetchAllMetrics(api v1.API, q *MetricsQuery, labelsIn, labelsOut, labelsErrorIn, labelsErrorOut, groupingIn, groupingOut string) Metrics {
	var wg sync.WaitGroup
	fetchRateInOut := func(p8sFamilyName string, metricIn **Metric, metricOut **Metric, lblIn string, lblOut string) {
		defer wg.Done()
		m := fetchRateRange(api, p8sFamilyName, lblIn, groupingIn, q)
		*metricIn = m
		m = fetchRateRange(api, p8sFamilyName, lblOut, groupingOut, q)
		*metricOut = m
	}

	fetchHistoInOut := func(p8sFamilyName string, hIn *Histogram, hOut *Histogram) {
		defer wg.Done()
		h := fetchHistogramRange(api, p8sFamilyName, labelsIn, groupingIn, q)
		*hIn = h
		h = fetchHistogramRange(api, p8sFamilyName, labelsOut, groupingOut, q)
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

func fetchRateRange(api v1.API, metricName string, labels string, grouping string, q *MetricsQuery) *Metric {
	var query string
	// Example: round(sum(rate(my_counter{foo=bar}[5m])) by (baz), 0.001)
	if grouping == "" {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])), 0.001)", q.RateFunc, metricName, labels, q.RateInterval)
	} else {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])) by (%s), 0.001)", q.RateFunc, metricName, labels, q.RateInterval, grouping)
	}
	return fetchRange(api, query, q.Range)
}

func fetchHistogramRange(api v1.API, metricName string, labels string, grouping string, q *MetricsQuery) Histogram {
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
		"round(sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s, 0.001)", metricName, labels, q.RateInterval, groupingAvg,
		metricName, labels, q.RateInterval, groupingAvg)
	avg := fetchRange(api, query, q.Range)

	// Median
	// Example: round(histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz)), 0.001)
	query = fmt.Sprintf(
		"round(histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le%s)), 0.001)", metricName, labels, q.RateInterval, groupingQuantile)
	med := fetchRange(api, query, q.Range)

	// Quantile 95
	query = fmt.Sprintf(
		"round(histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le%s)), 0.001)", metricName, labels, q.RateInterval, groupingQuantile)
	p95 := fetchRange(api, query, q.Range)

	// Quantile 99
	query = fmt.Sprintf(
		"round(histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le%s)), 0.001)", metricName, labels, q.RateInterval, groupingQuantile)
	p99 := fetchRange(api, query, q.Range)

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

func getNamespaceRequestRates(api v1.API, namespace string, ratesInterval string) (model.Vector, model.Vector, error) {
	reporter := "source"
	if config.Get().IstioNamespace == namespace {
		reporter = "destination"
	}

	// traffic originating outside the namespace to destinations inside the namespace
	lblIn := fmt.Sprintf(`reporter="%s",destination_service_namespace="%s",source_workload_namespace!="%s"`, reporter, namespace, namespace)
	in, err := getRequestRatesForLabel(api, time.Now(), lblIn, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	// traffic originating inside the namespace to destinations inside or outside the namespace
	lblOut := fmt.Sprintf(`reporter="%s",source_workload_namespace="%s"`, reporter, namespace)
	out, err := getRequestRatesForLabel(api, time.Now(), lblOut, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	return in, out, nil
}

func getAppsRequestRates(api v1.API, namespace string, apps []string, ratesInterval string) (model.Vector, model.Vector, error) {
	lblIn := fmt.Sprintf(`reporter="destination",destination_workload_namespace="%s"`, namespace)
	outReporter := "source"
	if config.Get().IstioNamespace == namespace {
		outReporter = "destination"
	}
	lblOut := fmt.Sprintf(`reporter="%s",source_workload_namespace="%s"`, outReporter, namespace)
	if len(apps) == 1 {
		lblIn += fmt.Sprintf(`,destination_app="%s"`, apps[0])
		lblOut += fmt.Sprintf(`,source_app="%s"`, apps[0])
	} else if len(apps) > 1 {
		strApps := strings.Join(apps, "|")
		lblIn += fmt.Sprintf(`,destination_app=~"%s"`, strApps)
		lblOut += fmt.Sprintf(`,source_app=~"%s"`, strApps)
	} else {
		// no app => no result
		return model.Vector{}, model.Vector{}, nil
	}
	in, err := getRequestRatesForLabel(api, time.Now(), lblIn, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	out, err := getRequestRatesForLabel(api, time.Now(), lblOut, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	return in, out, nil
}

func getRequestRatesForLabel(api v1.API, time time.Time, labels, ratesInterval string) (model.Vector, error) {
	query := fmt.Sprintf("rate(istio_requests_total{%s}[%s])", labels, ratesInterval)
	result, err := api.Query(context.Background(), query, time)
	if err != nil {
		return model.Vector{}, err
	}
	return result.(model.Vector), nil
}
