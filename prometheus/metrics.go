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

// MetricsQuery holds query parameters for a typical metrics query
type MetricsQuery struct {
	v1.Range
	RateInterval string
	RateFunc     string
	Filters      []string
	ByLabelsIn   []string
	ByLabelsOut  []string
	Namespace    string
	App          string
	Workload     string
	Service      string
	Reporter     string // source | destination, defaults to both if not provided
}

// FillDefaults fills the struct with default parameters
func (q *MetricsQuery) FillDefaults() {
	q.End = time.Now()
	q.Start = q.End.Add(-30 * time.Minute)
	q.Step = 15 * time.Second
	q.RateInterval = "1m"
	q.RateFunc = "rate"
}

// Metrics contains all simple metrics and histograms data for both source and destination telemetry
type Metrics struct {
	Source ReporterMetrics `json:"source"`
	Dest   ReporterMetrics `json:"dest"`
}

// ReporterMetrics contains all simple metrics and histograms data for one reporter's telemetry
type ReporterMetrics struct {
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

// EnvoyServiceHealth is the number of healthy versus total membership (ie. replicas) inside envoy cluster for inbound and outbound traffic
type EnvoyServiceHealth struct {
	Inbound  EnvoyRatio `json:"inbound"`
	Outbound EnvoyRatio `json:"outbound"`
}

// EnvoyRatio is the number of healthy members versus total members
type EnvoyRatio struct {
	Healthy int `json:"healthy"`
	Total   int `json:"total"`
}

func getServiceHealth(api v1.API, namespace, servicename string, ports []int32) (EnvoyServiceHealth, error) {
	ret := EnvoyServiceHealth{}
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
	labelsIn, labelsErrorIn, _ := buildLabelStrings(q, true)
	// discriminate results by source and dest telemetry
	q.ByLabelsIn = append([]string{"reporter"}, q.ByLabelsIn...)
	groupingIn := strings.Join(q.ByLabelsIn, ",")
	inboundMetrics := fetchAllMetrics(api, q, labelsIn, labelsErrorIn, groupingIn, "_in")
	if q.Service != "" {
		// If a service is set, stop now; we'll only have inbound metrics
		return inboundMetrics
	}

	labelsOut, labelsErrorOut, _ := buildLabelStrings(q, false)
	// discriminate results by source and dest telemetry
	q.ByLabelsOut = append([]string{"reporter"}, q.ByLabelsOut...)
	groupingOut := strings.Join(q.ByLabelsOut, ",")
	metrics := fetchAllMetrics(api, q, labelsOut, labelsErrorOut, groupingOut, "_out")

	// Merge in a single object
	for key, obj := range inboundMetrics.Source.Metrics {
		metrics.Source.Metrics[key] = obj
	}
	for key, obj := range inboundMetrics.Source.Histograms {
		metrics.Source.Histograms[key] = obj
	}
	for key, obj := range inboundMetrics.Dest.Metrics {
		metrics.Dest.Metrics[key] = obj
	}
	for key, obj := range inboundMetrics.Dest.Histograms {
		metrics.Dest.Histograms[key] = obj
	}
	return metrics
}

func buildLabelStrings(q *MetricsQuery, isInbound bool) (string, string, string) {
	labels := []string{}
	reporter := ""

	if q.Reporter == "destination" {
		labels = append(labels, `reporter="destination"`)
		reporter = "destination"
	} else if q.Reporter == "source" {
		labels = append(labels, `reporter="source"`)
		reporter = "source"
	}

	if q.Service != "" {
		// inbound only
		labels = append(labels, fmt.Sprintf(`destination_service_name="%s"`, q.Service))
		if q.Namespace != "" {
			labels = append(labels, fmt.Sprintf(`destination_service_namespace="%s"`, q.Namespace))
		}
	} else {
		referential := "source"
		if isInbound {
			referential = "destination"
		}
		if q.Workload != "" {
			labels = append(labels, fmt.Sprintf(`%s_workload="%s"`, referential, q.Workload))
		}
		if q.App != "" {
			labels = append(labels, fmt.Sprintf(`%s_app="%s"`, referential, q.App))
		}
		if q.Namespace != "" {
			labels = append(labels, fmt.Sprintf(`%s_workload_namespace="%s"`, referential, q.Namespace))
		}
	}

	full := "{" + strings.Join(labels, ",") + "}"

	labels = append(labels, `response_code=~"[5|4].*"`)
	errors := "{" + strings.Join(labels, ",") + "}"

	return full, errors, reporter
}

func fetchAllMetrics(api v1.API, q *MetricsQuery, labels, labelsError, grouping, suffix string) Metrics {
	var wg sync.WaitGroup
	fetchRate := func(p8sFamilyName string, metric **Metric, lbl string) {
		defer wg.Done()
		m := fetchRateRange(api, p8sFamilyName, lbl, grouping, q)
		*metric = m
	}

	fetchHisto := func(p8sFamilyName string, histo *Histogram) {
		defer wg.Done()
		h := fetchHistogramRange(api, p8sFamilyName, labels, grouping, q)
		*histo = h
	}

	type resultHolder struct {
		metric     *Metric
		histo      Histogram
		definition kialiMetric
	}
	maxResults := len(kialiMetrics)
	results := make([]*resultHolder, maxResults, maxResults)

	for i, kialiMetric := range kialiMetrics {
		// if filters is empty, fetch all anyway
		doFetch := len(q.Filters) == 0
		if !doFetch {
			for _, filter := range q.Filters {
				if filter == kialiMetric.name {
					doFetch = true
					break
				}
			}
		}
		if doFetch {
			wg.Add(1)
			result := resultHolder{definition: kialiMetric}
			results[i] = &result
			if kialiMetric.isHisto {
				go fetchHisto(kialiMetric.istioName, &result.histo)
			} else {
				labelsToUse := kialiMetric.labelsToUse(labels, labelsError)
				go fetchRate(kialiMetric.istioName, &result.metric, labelsToUse)
			}
		}
	}
	wg.Wait()

	// Return results as two maps per reporter
	sourceMetrics := make(map[string]*Metric)
	sourceHistograms := make(map[string]Histogram)
	destMetrics := make(map[string]*Metric)
	destHistograms := make(map[string]Histogram)
	for _, result := range results {
		if result != nil {
			if result.definition.isHisto {
				source, dest := splitHistoTelemetry(result.histo)
				sourceHistograms[result.definition.name+suffix] = source
				destHistograms[result.definition.name+suffix] = dest
			} else {
				source, dest := splitMetricTelemetry(result.metric)
				sourceMetrics[result.definition.name+suffix] = source
				destMetrics[result.definition.name+suffix] = dest
			}
		}
	}
	return Metrics{
		Source: ReporterMetrics{
			Metrics:    sourceMetrics,
			Histograms: sourceHistograms},
		Dest: ReporterMetrics{
			Metrics:    destMetrics,
			Histograms: destHistograms},
	}
}

func splitMetricTelemetry(metric *Metric) (source, dest *Metric) {
	source = &Metric{
		Matrix: []*model.SampleStream{},
		err:    metric.err,
	}
	dest = &Metric{
		Matrix: []*model.SampleStream{},
		err:    metric.err,
	}
	for _, s := range metric.Matrix {
		switch s.Metric["reporter"] {
		case "source":
			source.Matrix = append(source.Matrix, s)
		case "destination":
			dest.Matrix = append(dest.Matrix, s)
		default:
			log.Warningf("Discarding metric with reporter=[%s]", s.Metric["reporter"])
		}
	}
	return source, dest
}

func splitHistoTelemetry(histo Histogram) (source, dest Histogram) {
	source = Histogram{
		Average: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Average.err},
		Median: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Median.err},
		Percentile95: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Percentile95.err},
		Percentile99: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Percentile99.err},
	}
	dest = Histogram{
		Average: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Average.err},
		Median: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Median.err},
		Percentile95: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Percentile95.err},
		Percentile99: &Metric{
			Matrix: []*model.SampleStream{},
			err:    histo.Percentile99.err},
	}
	for _, s := range histo.Average.Matrix {
		switch s.Metric["reporter"] {
		case "source":
			source.Average.Matrix = append(source.Average.Matrix, s)
		case "destination":
			dest.Average.Matrix = append(dest.Average.Matrix, s)
		default:
			log.Warningf("Discarding histo avg with reporter=[%s]", s.Metric["reporter"])
		}
	}
	for _, s := range histo.Median.Matrix {
		switch s.Metric["reporter"] {
		case "source":
			source.Median.Matrix = append(source.Median.Matrix, s)
		case "destination":
			dest.Median.Matrix = append(dest.Median.Matrix, s)
		default:
			log.Warningf("Discarding histo median with reporter=[%s]", s.Metric["reporter"])
		}
	}
	for _, s := range histo.Percentile95.Matrix {
		switch s.Metric["reporter"] {
		case "source":
			source.Percentile95.Matrix = append(source.Percentile95.Matrix, s)
		case "destination":
			dest.Percentile95.Matrix = append(dest.Percentile95.Matrix, s)
		default:
			log.Warningf("Discarding histo p95 with reporter=[%s]", s.Metric["reporter"])
		}
	}
	for _, s := range histo.Percentile99.Matrix {
		switch s.Metric["reporter"] {
		case "source":
			source.Percentile99.Matrix = append(source.Percentile99.Matrix, s)
		case "destination":
			dest.Percentile99.Matrix = append(dest.Percentile99.Matrix, s)
		default:
			log.Warningf("Discarding histo p95 with reporter=[%s]", s.Metric["reporter"])
		}
	}

	return source, dest
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

func getAllRequestRates(api v1.API, namespace string, ratesInterval string) (model.Vector, error) {
	reporter := "source"
	if config.Get().IstioNamespace == namespace {
		reporter = "destination"
	}
	// traffic originating outside the namespace to destinations inside the namespace
	lblIn := fmt.Sprintf(`reporter="%s",destination_service_namespace="%s",source_workload_namespace!="%s"`, reporter, namespace, namespace)
	in, err := getRequestRatesForLabel(api, time.Now(), lblIn, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// traffic originating inside the namespace to destinations inside or outside the namespace
	lblOut := fmt.Sprintf(`reporter="%s",source_workload_namespace="%s"`, reporter, namespace)
	out, err := getRequestRatesForLabel(api, time.Now(), lblOut, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// Merge results
	all := append(in, out...)
	return all, nil
}

func getServiceRequestRates(api v1.API, namespace, service, ratesInterval string) (model.Vector, error) {
	lbl := fmt.Sprintf(`reporter="destination",destination_service_name="%s",destination_service_namespace="%s"`, service, namespace)
	in, err := getRequestRatesForLabel(api, time.Now(), lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return in, nil
}

func getItemRequestRates(api v1.API, namespace, item, itemLabelSuffix, ratesInterval string) (model.Vector, model.Vector, error) {
	lblIn := fmt.Sprintf(`reporter="destination",destination_workload_namespace="%s",destination_%s="%s"`, namespace, itemLabelSuffix, item)
	outReporter := "source"
	if config.Get().IstioNamespace == namespace {
		outReporter = "destination"
	}
	lblOut := fmt.Sprintf(`reporter="%s",source_workload_namespace="%s",source_%s="%s"`, outReporter, namespace, itemLabelSuffix, item)
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
