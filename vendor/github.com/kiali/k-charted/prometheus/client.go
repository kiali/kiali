package prometheus

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/k-charted/config/promconfig"
)

type ClientInterface interface {
	FetchHistogramRange(metricName, labels, grouping string, q *MetricsQuery) Histogram
	FetchRange(metricName, labels, grouping, aggregator string, q *MetricsQuery) Metric
	FetchRateRange(metricName, labels, grouping string, q *MetricsQuery) Metric
	GetMetricsForLabels(labels []string) ([]string, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s api.Client
	api v1.API
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient(cfg promconfig.PrometheusConfig) (*Client, error) {
	clientConfig := api.Config{Address: cfg.URL}
	transportConfig, err := authTransport(&cfg.Auth, api.DefaultRoundTripper.(*http.Transport))
	if err != nil {
		return nil, err
	}
	clientConfig.RoundTripper = transportConfig

	p8s, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, err
	}
	client := Client{p8s: p8s, api: v1.NewAPI(p8s)}
	return &client, nil
}

// FetchRange fetches a simple metric (gauge or counter) in given range
func (in *Client) FetchRange(metricName, labels, grouping, aggregator string, q *MetricsQuery) Metric {
	query := fmt.Sprintf("%s(%s%s)", aggregator, metricName, labels)
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	query = roundSignificant(query, 0.001)
	return in.fetchRange(query, q.Range)
}

// FetchRateRange fetches a counter's rate in given range
func (in *Client) FetchRateRange(metricName, labels, grouping string, q *MetricsQuery) Metric {
	var query string
	// Example: round(sum(rate(my_counter{foo=bar}[5m])) by (baz), 0.001)
	if grouping == "" {
		query = fmt.Sprintf("sum(%s(%s%s[%s]))", q.RateFunc, metricName, labels, q.RateInterval)
	} else {
		query = fmt.Sprintf("sum(%s(%s%s[%s])) by (%s)", q.RateFunc, metricName, labels, q.RateInterval, grouping)
	}
	query = roundSignificant(query, 0.001)
	return in.fetchRange(query, q.Range)
}

// FetchHistogramRange fetches bucketed metric as histogram in given range
func (in *Client) FetchHistogramRange(metricName, labels, grouping string, q *MetricsQuery) Histogram {
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
		query := fmt.Sprintf("sum(rate(%s_sum%s[%s]))%s / sum(rate(%s_count%s[%s]))%s",
			metricName, labels, q.RateInterval, groupingAvg, metricName, labels, q.RateInterval, groupingAvg)
		query = roundSignificant(query, 0.001)
		histogram["avg"] = in.fetchRange(query, q.Range)
	}

	groupingQuantile := ""
	if grouping != "" {
		groupingQuantile = fmt.Sprintf(",%s", grouping)
	}
	for _, quantile := range q.Quantiles {
		// Example: round(histogram_quantile(0.5, sum(rate(my_histogram_bucket{foo=bar}[5m])) by (le,baz)), 0.001)
		query := fmt.Sprintf("histogram_quantile(%s, sum(rate(%s_bucket%s[%s])) by (le%s))",
			quantile, metricName, labels, q.RateInterval, groupingQuantile)
		query = roundSignificant(query, 0.001)
		histogram[quantile] = in.fetchRange(query, q.Range)
	}

	return histogram
}

func (in *Client) fetchRange(query string, bounds v1.Range) Metric {
	result, err := in.api.QueryRange(context.Background(), query, bounds)
	if err != nil {
		return Metric{Err: err}
	}
	switch result.Type() {
	case model.ValMatrix:
		return Metric{Matrix: result.(model.Matrix)}
	}
	return Metric{Err: fmt.Errorf("invalid query, matrix expected: %s", query)}
}

// GetMetricsForLabels returns a list of metrics existing for the provided labels set
func (in *Client) GetMetricsForLabels(labels []string) ([]string, error) {
	// Arbitrarily set time range. Meaning that discovery works with metrics produced within last hour
	end := time.Now()
	start := end.Add(-time.Hour)
	results, err := in.api.Series(context.Background(), labels, start, end)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, labelSet := range results {
		if name, ok := labelSet["__name__"]; ok {
			names = append(names, string(name))
		}
	}
	return names, nil
}

// roundSignificant will output promQL that performs rounding only if the resulting value is significant, that is, higher than the requested precision
func roundSignificant(innerQuery string, precision float64) string {
	return fmt.Sprintf("round(%s, %f) > %f or %s", innerQuery, precision, precision, innerQuery)
}
