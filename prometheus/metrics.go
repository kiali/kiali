package prometheus

import (
	"context"
	"fmt"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func fetchRateRange(ctx context.Context, api prom_v1.API, metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	var query string
	// Example: round(sum(rate(my_counter{foo=bar}[5m])) by (baz), 0.001)
	for i, labelsInstance := range labels {
		if i > 0 {
			query += " OR "
		}
		if grouping == "" {
			query += fmt.Sprintf("sum(%s(%s%s[%s]))", q.RateFunc, metricName, labelsInstance, q.RateInterval)
		} else {
			query += fmt.Sprintf("sum(%s(%s%s[%s])) by (%s)", q.RateFunc, metricName, labelsInstance, q.RateInterval, grouping)
		}
	}
	if len(labels) > 1 {
		query = fmt.Sprintf("(%s)", query)
	}
	query = roundSignificant(query, 0.001)
	return fetchRange(ctx, api, query, q.Range)
}

func fetchHistogramRange(ctx context.Context, api prom_v1.API, metricName, labels, grouping string, q *RangeQuery) Histogram {
	// Note: the p8s queries are not run in parallel here, but they are at the caller's place.
	//	This is because we may not want to create too many threads in the lowest layer
	queries := buildHistogramQueries(metricName, labels, grouping, q.RateInterval, q.Avg, q.Quantiles)
	histogram := make(Histogram, len(queries))
	for k, query := range queries {
		histogram[k] = fetchRange(ctx, api, query, q.Range)
	}
	return histogram
}

func fetchHistogramValues(ctx context.Context, api prom_v1.API, metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	// Note: the p8s queries are not run in parallel here, but they are at the caller's place.
	//	This is because we may not want to create too many threads in the lowest layer
	queries := buildHistogramQueries(metricName, labels, grouping, rateInterval, avg, quantiles)
	histogram := make(map[string]model.Vector, len(queries))
	for k, query := range queries {
		log.Tracef("[Prom] fetchHistogramValues: %s", query)
		result, warnings, err := api.Query(ctx, query, queryTime)
		if warnings != nil && len(warnings) > 0 {
			log.Warningf("fetchHistogramValues. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
		}
		if err != nil {
			return nil, err
		}
		histogram[k] = result.(model.Vector)
	}
	return histogram, nil
}

func buildHistogramQueries(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string) map[string]string {
	queries := make(map[string]string)
	if avg {
		groupingAvg := ""
		if grouping != "" {
			groupingAvg = fmt.Sprintf(" by (%s)", grouping)
		}
		// Average
		// Example: sum(rate(my_histogram_sum{foo=bar}[5m])) by (baz) / sum(rate(my_histogram_count{foo=bar}[5m])) by (baz)
		query := fmt.Sprintf("sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s",
			metricName, labels, rateInterval, groupingAvg, metricName, labels, rateInterval, groupingAvg)
		query = roundSignificant(query, 0.001)
		queries["avg"] = query
	}

	groupingQuantile := ""
	if grouping != "" {
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}
	for _, quantile := range quantiles {
		// Example: round(histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz)), 0.001)
		query := fmt.Sprintf("histogram_quantile(%s, sum(rate(%s_bucket%s[%s])) by (le%s))",
			quantile, metricName, labels, rateInterval, groupingQuantile)
		query = roundSignificant(query, 0.001)
		queries[quantile] = query
	}

	return queries
}

func fetchRange(ctx context.Context, api prom_v1.API, query string, bounds prom_v1.Range) Metric {
	log.Tracef("[Prom] fetchRange: %s", query)
	result, warnings, err := api.QueryRange(ctx, query, bounds)
	if warnings != nil && len(warnings) > 0 {
		log.Warningf("fetchRange. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return Metric{Err: err}
	}
	switch result.Type() {
	case model.ValMatrix:
		return Metric{Matrix: result.(model.Matrix)}
	}
	return Metric{Err: fmt.Errorf("invalid query, matrix expected: %s", query)}
}

// getAllRequestRates retrieves traffic rates for requests entering, internal to, or exiting the namespace.
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getAllRequestRates(ctx context.Context, api prom_v1.API, namespace string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic originating outside the namespace to destinations inside the namespace
	lbl := fmt.Sprintf(`destination_service_namespace="%s",source_workload_namespace!="%s"`, namespace, namespace)
	fromOutside, err := getRequestRatesForLabel(ctx, api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// traffic originating inside the namespace to destinations inside or outside the namespace
	lbl = fmt.Sprintf(`source_workload_namespace="%s"`, namespace)
	fromInside, err := getRequestRatesForLabel(ctx, api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// Merge results
	all := append(fromOutside, fromInside...)
	return all, nil
}

// getNamespaceServicesRequestRates retrieves traffic rates for requests entering or internal to the namespace.
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getNamespaceServicesRequestRates(ctx context.Context, api prom_v1.API, namespace string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic for the namespace services
	lblNs := fmt.Sprintf(`destination_service_namespace="%s"`, namespace)
	ns, err := getRequestRatesForLabel(ctx, api, queryTime, lblNs, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return ns, nil
}

// getServiceRequestRates retrieves traffic rates for requests entering, or internal to the namespace, for a specific service name
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getServiceRequestRates(ctx context.Context, api prom_v1.API, namespace, service string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	lbl := fmt.Sprintf(`destination_service_name="%s",destination_service_namespace="%s"`, service, namespace)
	in, err := getRequestRatesForLabel(ctx, api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return in, nil
}

// getItemRequestRates retrieves traffic rates for requests entering, internal to, or exiting the namespace, for a specific destinatation_<itemLabelSuffix> value
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getItemRequestRates(ctx context.Context, api prom_v1.API, namespace, item, itemLabelSuffix string, queryTime time.Time, ratesInterval string) (model.Vector, model.Vector, error) {
	lblIn := fmt.Sprintf(`destination_workload_namespace="%s",destination_%s="%s"`, namespace, itemLabelSuffix, item)
	lblOut := fmt.Sprintf(`source_workload_namespace="%s",source_%s="%s"`, namespace, itemLabelSuffix, item)
	in, err := getRequestRatesForLabel(ctx, api, queryTime, lblIn, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	out, err := getRequestRatesForLabel(ctx, api, queryTime, lblOut, ratesInterval)
	if err != nil {
		return model.Vector{}, model.Vector{}, err
	}
	return in, out, nil
}

func getRequestRatesForLabel(ctx context.Context, api prom_v1.API, time time.Time, labels, ratesInterval string) (model.Vector, error) {
	query := fmt.Sprintf("rate(istio_requests_total{%s}[%s]) > 0", labels, ratesInterval)
	log.Tracef("[Prom] getRequestRatesForLabel: %s", query)
	promtimer := internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Metrics-GetRequestRates")
	result, warnings, err := api.Query(ctx, query, time)
	if warnings != nil && len(warnings) > 0 {
		log.Warningf("fetchHistogramValues. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return model.Vector{}, err
	}
	promtimer.ObserveDuration() // notice we only collect metrics for successful prom queries
	return result.(model.Vector), nil
}

// roundSignificant will output promQL that performs rounding only if the resulting value is significant, that is, higher than the requested precision
func roundSignificant(innerQuery string, precision float64) string {
	return fmt.Sprintf("round(%s, %f) > %f or %s", innerQuery, precision, precision, innerQuery)
}
