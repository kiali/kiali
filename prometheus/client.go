package prometheus

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	FetchHistogramRange(metricName, labels, grouping string, q *BaseMetricsQuery) Histogram
	FetchRange(metricName, labels, grouping, aggregator string, q *BaseMetricsQuery) *Metric
	FetchRateRange(metricName, labels, grouping string, q *BaseMetricsQuery) *Metric
	GetAllRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetConfiguration() (v1.ConfigResult, error)
	GetFlags() (v1.FlagsResult, error)
	GetMetrics(query *IstioMetricsQuery) Metrics
	GetNamespaceServicesRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
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
func NewClient() (*Client, error) {
	if config.Get() == nil {
		return nil, errors.New("config.Get() must be not null")
	}
	p8s, err := api.NewClient(api.Config{Address: config.Get().ExternalServices.Prometheus.URL})
	if err != nil {
		return nil, err
	}
	client := Client{p8s: p8s, api: v1.NewAPI(p8s)}
	return &client, nil
}

// Inject allows for replacing the API with a mock For testing
func (in *Client) Inject(api v1.API) {
	in.api = api
}

// GetMetrics returns the Metrics related to the provided query options.
func (in *Client) GetMetrics(query *IstioMetricsQuery) Metrics {
	return getMetrics(in.api, query)
}

// GetAllRequestRates queries Prometheus to fetch request counter rates, over a time interval, for requests
// into, internal to, or out of the namespace.
// Returns (rates, error)
func (in *Client) GetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return getAllRequestRates(in.api, namespace, queryTime, ratesInterval)
}

// GetNamespaceServicesRequestRates queries Prometheus to fetch request counter rates, over a time interval, limited to
// requests for services in the namespace.
// Returns (rates, error)
func (in *Client) GetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return getNamespaceServicesRequestRates(in.api, namespace, queryTime, ratesInterval)
}

// GetServiceRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given service (hence only inbound).
// Returns (in, error)
func (in *Client) GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return getServiceRequestRates(in.api, namespace, service, queryTime, ratesInterval)
}

// GetAppRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given app, both in and out.
// Returns (in, out, error)
func (in *Client) GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return getItemRequestRates(in.api, namespace, app, "app", queryTime, ratesInterval)
}

// GetWorkloadRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given workload, both in and out.
// Returns (in, out, error)
func (in *Client) GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return getItemRequestRates(in.api, namespace, workload, "workload", queryTime, ratesInterval)
}

// FetchRange fetches a simple metric (gauge or counter) in given range
func (in *Client) FetchRange(metricName, labels, grouping, aggregator string, q *BaseMetricsQuery) *Metric {
	query := fmt.Sprintf("%s(%s%s)", aggregator, metricName, labels)
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	query = roundSignificant(query, 0.001)
	return fetchRange(in.api, query, q.Range)
}

// FetchRateRange fetches a counter's rate in given range
func (in *Client) FetchRateRange(metricName, labels, grouping string, q *BaseMetricsQuery) *Metric {
	return fetchRateRange(in.api, metricName, labels, grouping, q)
}

// FetchHistogramRange fetches bucketed metric as histogram in given range
func (in *Client) FetchHistogramRange(metricName, labels, grouping string, q *BaseMetricsQuery) Histogram {
	return fetchHistogramRange(in.api, metricName, labels, grouping, q)
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by this client
func (in *Client) API() v1.API {
	return in.api
}

// Address return the configured Prometheus service URL
func (in *Client) Address() string {
	return config.Get().ExternalServices.Prometheus.URL
}

func (in *Client) GetConfiguration() (v1.ConfigResult, error) {
	config, err := in.API().Config(context.Background())
	if err != nil {
		return v1.ConfigResult{}, err
	}
	return config, nil
}

func (in *Client) GetFlags() (v1.FlagsResult, error) {
	flags, err := in.API().Flags(context.Background())
	if err != nil {
		return nil, err
	}
	return flags, nil
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
