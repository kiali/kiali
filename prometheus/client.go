package prometheus

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/api"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	FetchHistogramRange(metricName, labels, grouping string, q *BaseMetricsQuery) Histogram
	FetchRange(metricName, labels, grouping, aggregator string, q *BaseMetricsQuery) *Metric
	FetchRateRange(metricName, labels, grouping string, q *BaseMetricsQuery) *Metric
	GetAllRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetConfiguration() (prom_v1.ConfigResult, error)
	GetFlags() (prom_v1.FlagsResult, error)
	GetMetrics(query *IstioMetricsQuery) Metrics
	GetNamespaceServicesRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s api.Client
	api prom_v1.API
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	cfg := config.Get().ExternalServices.Prometheus
	clientConfig := api.Config{Address: cfg.URL}

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		// Note: if we are using the 'bearer' authentication method then we want to use the Kiali
		// service account token and not the user's token. This is because Kiali does filtering based
		// on the user's token and prevents people who shouldn't have access to particular metrics.
		token, err := kubernetes.GetKialiToken()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
			return nil, err
		}
		auth.Token = token
	}

	transportConfig, err := httputil.AuthTransport(&auth, api.DefaultRoundTripper.(*http.Transport))
	if err != nil {
		return nil, err
	}
	clientConfig.RoundTripper = transportConfig

	p8s, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, err
	}
	client := Client{p8s: p8s, api: prom_v1.NewAPI(p8s)}
	return &client, nil
}

// Inject allows for replacing the API with a mock For testing
func (in *Client) Inject(api prom_v1.API) {
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
func (in *Client) API() prom_v1.API {
	return in.api
}

// Address return the configured Prometheus service URL
func (in *Client) Address() string {
	return config.Get().ExternalServices.Prometheus.URL
}

func (in *Client) GetConfiguration() (prom_v1.ConfigResult, error) {
	config, err := in.API().Config(context.Background())
	if err != nil {
		return prom_v1.ConfigResult{}, err
	}
	return config, nil
}

func (in *Client) GetFlags() (prom_v1.FlagsResult, error) {
	flags, err := in.API().Flags(context.Background())
	if err != nil {
		return nil, err
	}
	return flags, nil
}
