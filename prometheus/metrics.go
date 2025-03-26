package prometheus

import (
	"context"
	"fmt"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util/sliceutil"
)

func fetchRateRange(ctx context.Context, api prom_v1.API, metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	var query string
	// Example: sum(rate(my_counter{foo=bar}[5m])) by (baz)
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
		if len(warnings) > 0 {
			log.Warningf("fetchHistogramValues. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
		}
		if err != nil {
			return nil, errors.NewServiceUnavailable(err.Error())
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
		queries["avg"] = query
	}

	groupingQuantile := ""
	if grouping != "" {
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}
	for _, quantile := range quantiles {
		// Example: histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz))
		query := fmt.Sprintf("histogram_quantile(%s, sum(rate(%s_bucket%s[%s])) by (le%s))",
			quantile, metricName, labels, rateInterval, groupingQuantile)
		queries[quantile] = query
	}

	return queries
}

func fetchQuery(ctx context.Context, api prom_v1.API, query string, queryTime time.Time) Metric {
	result, warnings, err := api.Query(ctx, query, queryTime)
	if len(warnings) > 0 {
		log.Warningf("fetchQuery. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return Metric{Err: err}
	}
	switch result.Type() {
	case model.ValVector:
		return Metric{Matrix: vectorToMatrix(result.(model.Vector), model.Time(queryTime.Unix()))}
	case model.ValMatrix:
		return Metric{Matrix: result.(model.Matrix)}
	}
	return Metric{Err: fmt.Errorf("invalid query, unexpected result type [%s]: [%s]", result.Type(), query)}
}

func vectorToMatrix(vector []*model.Sample, t model.Time) model.Matrix {
	matrix := sliceutil.Map(vector, func(sample *model.Sample) *model.SampleStream {
		return &model.SampleStream{
			Metric: sample.Metric,
			Values: []model.SamplePair{
				{
					Timestamp: t,
					Value:     sample.Value,
				},
			},
		}
	})
	return matrix
}

func fetchRange(ctx context.Context, api prom_v1.API, query string, bounds prom_v1.Range) Metric {
	result, warnings, err := api.QueryRange(ctx, query, bounds)
	if len(warnings) > 0 {
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
func getAllRequestRates(ctx context.Context, api prom_v1.API, namespace, cluster string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic originating outside the namespace to destinations inside the namespace
	lbl := fmt.Sprintf(`destination_service_namespace="%s",source_workload_namespace!="%s",destination_cluster="%s"`, namespace, namespace, cluster)
	fromOutside, err := getRequestRatesForLabel(ctx, api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	// traffic originating inside the namespace to destinations inside or outside the namespace
	lbl = fmt.Sprintf(`source_workload_namespace="%s",source_cluster="%s"`, namespace, cluster)
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
func getNamespaceServicesRequestRates(ctx context.Context, api prom_v1.API, namespace, cluster string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// traffic for the namespace services
	lblNs := fmt.Sprintf(`destination_service_namespace="%s",destination_cluster="%s"`, namespace, cluster)
	ns, err := getRequestRatesForLabel(ctx, api, queryTime, lblNs, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return ns, nil
}

// getServiceRequestRates retrieves traffic rates for requests entering, or internal to the namespace, for a specific service name
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getServiceRequestRates(ctx context.Context, api prom_v1.API, namespace, cluster, service string, queryTime time.Time, ratesInterval string) (model.Vector, error) {
	// in certain scenarios, like 503, Istio fails to provide the destination_cluster. To handle this we use destination_cluster=~"%s|unknown".
	// This gives better results in most cases, although may not always be correct.
	lbl := fmt.Sprintf(`destination_service_name="%s",destination_service_namespace="%s",destination_cluster=~"%s|unknown"`, service, namespace, cluster)
	in, err := getRequestRatesForLabel(ctx, api, queryTime, lbl, ratesInterval)
	if err != nil {
		return model.Vector{}, err
	}
	return in, nil
}

// getItemRequestRates retrieves traffic rates for requests entering, internal to, or exiting the namespace, for a specific destinatation_<itemLabelSuffix> value
// Note that it does not discriminate on "reporter", so rates can be inflated due to duplication, and therefore
// should be used mainly for calculating ratios (e.g total rates / error rates)
func getItemRequestRates(ctx context.Context, api prom_v1.API, namespace, cluster, item, itemLabelSuffix string, queryTime time.Time, ratesInterval string) (model.Vector, model.Vector, error) {
	lblIn := fmt.Sprintf(`destination_workload_namespace="%s",destination_%s="%s",destination_cluster="%s"`, namespace, itemLabelSuffix, item, cluster)
	lblOut := fmt.Sprintf(`source_workload_namespace="%s",source_%s="%s",source_cluster="%s"`, namespace, itemLabelSuffix, item, cluster)
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
	if len(warnings) > 0 {
		log.Warningf("getRequestRatesForLabel. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return model.Vector{}, errors.NewServiceUnavailable(err.Error())
	}
	promtimer.ObserveDuration() // notice we only collect metrics for successful prom queries
	return result.(model.Vector), nil
}
