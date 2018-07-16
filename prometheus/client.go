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
	GetServiceHealth(namespace, servicename string, ports []int32) (EnvoyHealth, error)
	GetNamespaceRequestRates(namespace, ratesInterval string) (model.Vector, model.Vector, error)
	GetAppsRequestRates(namespace string, apps []string, ratesInterval string) (model.Vector, model.Vector, error)
	GetSourceWorkloads(namespace, servicename string) (map[string][]Workload, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s api.Client
	api v1.API
}

// Workload describes a workload with contextual information
type Workload struct {
	Namespace string
	App       string
	Workload  string
	Version   string
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	if config.Get() == nil {
		return nil, errors.New("config.Get() must be not null")
	}
	p8s, err := api.NewClient(api.Config{Address: config.Get().ExternalServices.PrometheusServiceURL})
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

// GetSourceWorkloads returns a map of list of source workloads for a given service
// identified by its namespace and service name.
// Returned map has a destination version as a key and a list of workloads as values.
// It returns an error on any problem.
func (in *Client) GetSourceWorkloads(namespace string, servicename string) (map[string][]Workload, error) {
	query := fmt.Sprintf("istio_requests_total{reporter=\"source\",destination_service_name=\"%s\",destination_service_namespace=\"%s\"}",
		servicename, namespace)
	result, err := in.api.Query(context.Background(), query, time.Now())
	if err != nil {
		return nil, err
	}
	routes := make(map[string][]Workload)
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		for _, sample := range matrix {
			metric := sample.Metric
			index := string(metric["destination_version"])
			source := Workload{
				Namespace: string(metric["source_workload_namespace"]),
				App:       string(metric["source_app"]),
				Workload:  string(metric["source_workload"]),
				Version:   string(metric["source_version"]),
			}
			if arr, ok := routes[index]; ok {
				found := false
				for _, s := range arr {
					if s.Workload == source.Workload {
						found = true
						break
					}
				}
				if !found {
					routes[index] = append(arr, source)
				}
			} else {
				routes[index] = []Workload{source}
			}
		}
	}
	return routes, nil
}

// GetMetrics returns the Metrics related to the provided query options.
func (in *Client) GetMetrics(query *MetricsQuery) Metrics {
	return getMetrics(in.api, query)
}

// GetServiceHealth returns the Health related to the provided service identified by its namespace and service name.
// It reads Envoy metrics, inbound and outbound
// When the health is unavailable, total number of members will be 0.
func (in *Client) GetServiceHealth(namespace, servicename string, ports []int32) (EnvoyHealth, error) {
	return getServiceHealth(in.api, namespace, servicename, ports)
}

// GetNamespaceRequestRates queries Prometheus to fetch request counters rates over a time interval
// for each service, both in and out.
// Returns (in, out, error)
func (in *Client) GetNamespaceRequestRates(namespace string, ratesInterval string) (model.Vector, model.Vector, error) {
	return getNamespaceRequestRates(in.api, namespace, ratesInterval)
}

// GetAppsRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given list of apps, both in and out.
// Returns (in, out, error)
func (in *Client) GetAppsRequestRates(namespace string, apps []string, ratesInterval string) (model.Vector, model.Vector, error) {
	return getAppsRequestRates(in.api, namespace, apps, ratesInterval)
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by this client
func (in *Client) API() v1.API {
	return in.api
}

// Address return the configured Prometheus service URL
func (in *Client) Address() string {
	return config.Get().ExternalServices.PrometheusServiceURL
}
