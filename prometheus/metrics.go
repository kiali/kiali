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
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

func getServiceHealth(api v1.API, namespace, servicename string, ports []int32) (EnvoyServiceHealth, error) {
	ret := EnvoyServiceHealth{}
	if len(ports) == 0 {
		return ret, nil
	}

	// In these Prometheus queries, only the last values are of interest. Since the
	// <servicename> is received as a parameter from the frontend, we can assume the
	// existence of the service and that the last values of the metrics queried won't belong
	// to any "old/outdated" service or namespace. So, there is no need to deal with
	// namespace lower bounds.
	envoyClustername := strings.Replace(config.Get().ExternalServices.Istio.IstioIdentityDomain, ".", "_", -1)
	queryPart := replaceInvalidCharacters(fmt.Sprintf("%s_%s_%s", servicename, namespace, envoyClustername))
	now := time.Now()

	inboundHealthyChan, inboundTotalChan, outboundHealthyChan, outboundTotalChan := make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports)), make(chan model.SampleValue, len(ports))
	errChan := make(chan error)

	// Note: metric names below probably depend on some istio configuration.
	// They should anyway change soon in a more prometheus-friendly way,
	// see https://github.com/istio/istio/issues/4854 and https://github.com/istio/istio/pull/5069

	for _, _port := range ports {
		// Inbound
		go func(port int) {
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_inbound_%d__%s_membership_healthy", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				inboundHealthyChan <- vec[0].Value
			} else {
				inboundHealthyChan <- 0
			}
		}(int(_port))
		go func(port int) {
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_inbound_%d__%s_membership_total", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				inboundTotalChan <- vec[0].Value
			} else {
				inboundTotalChan <- 0
			}
		}(int(_port))
		// Outbound
		go func(port int) {
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_outbound_%d__%s_membership_healthy", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				outboundHealthyChan <- vec[0].Value
			} else {
				outboundHealthyChan <- 0
			}
		}(int(_port))
		go func(port int) {
			vec, err := fetchTimestamp(api, fmt.Sprintf("envoy_cluster_outbound_%d__%s_membership_total", port, queryPart), now)
			if err != nil {
				errChan <- err
			} else if len(vec) > 0 {
				outboundTotalChan <- vec[0].Value
			} else {
				outboundTotalChan <- 0
			}
		}(int(_port))
	}

	var err error
	for count := 0; count < len(ports)*4; count++ {
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
			// No op
		}
	}
	return ret, err
}

func getMetrics(api v1.API, q *IstioMetricsQuery) Metrics {
	labels, labelsError := buildLabelStrings(q)
	grouping := strings.Join(q.ByLabels, ",")
	metrics := fetchAllMetrics(api, q, labels, labelsError, grouping)
	return metrics
}

func buildLabelStrings(q *IstioMetricsQuery) (string, string) {
	labels := []string{fmt.Sprintf(`reporter="%s"`, q.Reporter)}
	ref := "destination"
	if q.Direction == "outbound" {
		ref = "source"
	}

	if q.Service != "" {
		// inbound only
		labels = append(labels, fmt.Sprintf(`destination_service_name="%s"`, q.Service))
		if q.Namespace != "" {
			labels = append(labels, fmt.Sprintf(`destination_service_namespace="%s"`, q.Namespace))
		}
	} else if q.Namespace != "" {
		labels = append(labels, fmt.Sprintf(`%s_workload_namespace="%s"`, ref, q.Namespace))
	}
	if q.Workload != "" {
		labels = append(labels, fmt.Sprintf(`%s_workload="%s"`, ref, q.Workload))
	}
	if q.App != "" {
		labels = append(labels, fmt.Sprintf(`%s_app="%s"`, ref, q.App))
	}

	full := "{" + strings.Join(labels, ",") + "}"

	labels = append(labels, `response_code=~"[5|4].*"`)
	errors := "{" + strings.Join(labels, ",") + "}"

	return full, errors
}

func fetchAllMetrics(api v1.API, q *IstioMetricsQuery, labels, labelsError, grouping string) Metrics {
	var wg sync.WaitGroup
	fetchRate := func(p8sFamilyName string, metric **Metric, lbl string) {
		defer wg.Done()
		m := fetchRateRange(api, p8sFamilyName, lbl, grouping, &q.BaseMetricsQuery)
		*metric = m
	}

	fetchHisto := func(p8sFamilyName string, histo *Histogram) {
		defer wg.Done()
		h := fetchHistogramRange(api, p8sFamilyName, labels, grouping, &q.BaseMetricsQuery)
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
	metrics := make(map[string]*Metric)
	histograms := make(map[string]Histogram)
	for _, result := range results {
		if result != nil {
			if result.definition.isHisto {
				histograms[result.definition.name] = result.histo
			} else {
				metrics[result.definition.name] = result.metric
			}
		}
	}
	return Metrics{
		Metrics:    metrics,
		Histograms: histograms,
	}
}

func fetchRateRange(api v1.API, metricName, labels, grouping string, q *BaseMetricsQuery) *Metric {
	var query string
	// Example: round(sum(rate(my_counter{foo=bar}[5m])) by (baz), 0.001)
	if grouping == "" {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])), 0.001)", q.RateFunc, metricName, labels, q.RateInterval)
	} else {
		query = fmt.Sprintf("round(sum(%s(%s%s[%s])) by (%s), 0.001)", q.RateFunc, metricName, labels, q.RateInterval, grouping)
	}
	return fetchRange(api, query, q.Range)
}

func fetchHistogramRange(api v1.API, metricName, labels, grouping string, q *BaseMetricsQuery) Histogram {
	histogram := make(Histogram)

	// Note: the p8s queries are not run in parallel here, but they are at the caller's place.
	//	This is because we may not want to create too many threads in the lowest layer
	if q.Avg {
		groupingAvg := ""
		if grouping != "" {
			groupingAvg = fmt.Sprintf(" by (%s)", grouping)
		}
		// Average
		// Example: sum(rate(my_histogram_sum{foo=bar}[5m])) by (baz) / sum(rate(my_histogram_count{foo=bar}[5m])) by (baz)
		query := fmt.Sprintf(
			"round(sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s, 0.001)", metricName, labels, q.RateInterval, groupingAvg,
			metricName, labels, q.RateInterval, groupingAvg)
		log.Infof("Query: %s\n", query)
		histogram["avg"] = fetchRange(api, query, q.Range)
	}

	groupingQuantile := ""
	if grouping != "" {
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}
	for _, quantile := range q.Quantiles {
		// Example: round(histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz)), 0.001)
		query := fmt.Sprintf(
			"round(histogram_quantile(%s, sum(rate(%s_bucket%s[%s])) by (le%s)), 0.001)", quantile, metricName, labels, q.RateInterval, groupingQuantile)
		histogram[quantile] = fetchRange(api, query, q.Range)
		log.Infof("Query: %s\n", query)
	}

	return histogram
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

// getAllRequestRates retrieves traffic rates for requests entering, internal to, or exiting the namespace.
// Uses source telemetry unless working on the Istio namespace.
func getAllRequestRates(api v1.API, namespace string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic originating outside the namespace to destinations inside the namespace
	lbl := fmt.Sprintf(`destination_service_namespace="%s",source_workload_namespace!="%s"`, namespace, namespace)
	fromOutside, err := getRequestRatesForLabel(api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// traffic originating inside the namespace to destinations inside or outside the namespace
	lbl = fmt.Sprintf(`source_workload_namespace="%s"`, namespace)
	fromInside, err := getRequestRatesForLabel(api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// Merge results
	all := append(fromOutside, fromInside...)
	return all, nil
}

// getNamespaceServicesRequestRates retrieves traffic rates for requests entering or internal to the namespace.
// Uses source telemetry unless working on the Istio namespace.
func getNamespaceServicesRequestRates(api v1.API, namespace string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic for the namespace services
	lblNs := fmt.Sprintf(`destination_service_namespace="%s"`, namespace)
	ns, err := getRequestRatesForLabel(api, queryTime, lblNs, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return ns, nil
}

func getServiceRequestRates(api v1.API, namespace, service string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	lbl := fmt.Sprintf(`destination_service_name="%s",destination_service_namespace="%s"`, service, namespace)
	in, err := getRequestRatesForLabel(api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return in, nil
}

func getItemRequestRates(api v1.API, namespace, item, itemLabelSuffix string, queryTime time.Time, ratesInterval string) (model.Vector, model.Vector, error) {
	lblIn := fmt.Sprintf(`destination_workload_namespace="%s",destination_%s="%s"`, namespace, itemLabelSuffix, item)
	lblOut := fmt.Sprintf(`source_workload_namespace="%s",source_%s="%s"`, namespace, itemLabelSuffix, item)
	in, err := getRequestRatesForLabel(api, queryTime, lblIn, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	out, err := getRequestRatesForLabel(api, queryTime, lblOut, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	return in, out, nil
}

func getRequestRatesForLabel(api v1.API, time time.Time, labels, ratesInterval string) (model.Vector, error) {
	query := fmt.Sprintf("rate(istio_requests_total{%s}[%s])", labels, ratesInterval)
	promtimer := internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Metrics-GetRequestRates")
	result, err := api.Query(context.Background(), query, time)
	if err != nil {
		return model.Vector{}, err
	}
	promtimer.ObserveDuration() // notice we only collect metrics for successful prom queries
	return result.(model.Vector), nil
}
