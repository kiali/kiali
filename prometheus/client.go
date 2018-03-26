package prometheus

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
)

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	p8s api.Client
	api v1.API
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	if config.Get() == nil {
		return nil, errors.New("config.Get() must be not null")
	}
	p8s, err := api.NewClient(api.Config{Address: config.Get().PrometheusServiceURL})
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

// GetSourceServices returns a map of list of source services for a given service identified by its namespace and service name.
// Returned map has a destination version as a key and a list of "<origin service>/<origin version>" pairs as values.
// Destination service is not included in the map as it is passed as argument.
// It returns an error on any problem.
func (in *Client) GetSourceServices(namespace string, servicename string) (map[string][]string, error) {
	query := fmt.Sprintf("istio_request_count{destination_service=\"%s.%s.%s\"}",
		servicename, namespace, config.Get().IstioIdentityDomain)
	result, err := in.api.Query(context.Background(), query, time.Now())
	if err != nil {
		return nil, err
	}
	routes := make(map[string][]string)
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		for _, sample := range matrix {
			metric := sample.Metric
			index := fmt.Sprintf("%s", metric["destination_version"])
			sourceService := string(metric["source_service"])
			// sourceService is in the form "service.namespace.istio_identity_domain". We want to keep only "service.namespace".
			if i := strings.Index(sourceService, "."+config.Get().IstioIdentityDomain); i > 0 {
				sourceService = sourceService[:i]
			}
			source := fmt.Sprintf("%s/%s", sourceService, metric["source_version"])
			if arr, ok := routes[index]; ok {
				found := false
				for _, s := range arr {
					if s == source {
						found = true
						break
					}
				}
				if !found {
					routes[index] = append(arr, source)
				}
			} else {
				routes[index] = []string{source}
			}
		}
	}
	return routes, nil
}

// GetServiceMetrics returns the Metrics related to the provided service identified by its namespace and service name.
func (in *Client) GetServiceMetrics(query *ServiceMetricsQuery) Metrics {
	return getServiceMetrics(in.api, query)
}

// GetServiceHealth returns the Health related to the provided service identified by its namespace and service name.
// Health is based on number of healthy replicas versus total number of replicas (using Envoy metrics).
// When the health is unavailable, total number of replicas will be 0.
func (in *Client) GetServiceHealth(namespace string, servicename string) Health {
	return getServiceHealth(in.api, namespace, servicename)
}

// GetNamespaceMetrics returns the Metrics described by the optional service pattern ("" for all), and optional
// version, for the given namespace. Use GetServiceMetrics if you don't need pattern matching.
func (in *Client) GetNamespaceMetrics(query *NamespaceMetricsQuery) Metrics {
	return getNamespaceMetrics(in.api, query)
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by this client
func (in *Client) API() v1.API {
	return in.api
}

// Address return the configured Prometheus service URL
func (in *Client) Address() string {
	return config.Get().PrometheusServiceURL
}
