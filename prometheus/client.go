package prometheus

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/swift-sunshine/swscore/config"
)

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	p8s api.Client
}

// Metric is a base interface for either MetricValue (single scalar, gauge or counter) or MetricHistogram
type Metric interface {
}

// MetricValue represents a metric holding a single scalar (gauge or counter)
type MetricValue struct {
	Metric
	Query string
	Value float64
}

// MetricHistogram hold some pre-defined stats from an histogram
type MetricHistogram struct {
	Metric
	Query       string
	Average     float64
	Median      float64
	NinetyFiveP float64
	NinetyNineP float64
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	client := Client{}
	if config.Get() == nil {
		return nil, errors.New("config.Get() must be not null")
	}
	p8s, err := api.NewClient(api.Config{Address: config.Get().PrometheusServiceURL})
	if err != nil {
		return nil, err
	}
	client.p8s = p8s
	return &client, nil
}

// GetSourceServices returns a map of source services for a given service identified by its namespace and service name.
// Returned map has a destination version as a key and a "<origin service>/<origin version>" pair as value.
// Destination service is not included in the map as it is passed as argument.
// It returns an error on any problem.
func (in *Client) GetSourceServices(namespace string, servicename string) (map[string]string, error) {
	query := fmt.Sprintf("istio_request_count{destination_service=\"%s.%s.%s\"}",
		servicename, namespace, config.Get().Istio_Identity_Domain)
	api := v1.NewAPI(in.p8s)
	result, err := api.Query(context.Background(), query, time.Now())
	if err != nil {
		return nil, err
	}
	routes := make(map[string]string)
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		for _, sample := range matrix {
			metric := sample.Metric
			index := fmt.Sprintf("%s", metric["destination_version"])
			sourceService := string(metric["source_service"])
			// .svc sufix is a pure Istio label, I guess we can skip it at the moment for clarity
			if i := strings.Index(sourceService, ".svc"); i > 0 {
				sourceService = sourceService[:i]
			}
			routes[index] = fmt.Sprintf("%s/%s", sourceService, metric["source_version"])
		}
	}
	return routes, nil
}

// GetServiceMetrics returns a map of metrics (indexed by description) related to the provided service identified by its namespace and service name.
// Returned map includes istio metrics and envoy health.
// It returns an error on any problem.
func (in *Client) GetServiceMetrics(namespace string, servicename string, duration string) (map[string]Metric, error) {
	api := v1.NewAPI(in.p8s)
	now := time.Now()
	metrics := make(map[string]Metric)
	clustername := config.Get().Istio_Identity_Domain
	envoyClustername := strings.Replace(clustername, ".", "_", -1)
	var err error
	metrics["Request count in"], err = fetchRate(api, "istio_request_count",
		fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Request count out"], err = fetchRate(api, "istio_request_count",
		fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Request size in"], err = fetchHistogram(api, "istio_request_size",
		fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Request size out"], err = fetchHistogram(api, "istio_request_size",
		fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Request duration in"], err = fetchHistogram(api, "istio_request_duration",
		fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Request duration out"], err = fetchHistogram(api, "istio_request_duration",
		fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Response size in"], err = fetchHistogram(api, "istio_response_size",
		fmt.Sprintf("{destination_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Response size out"], err = fetchHistogram(api, "istio_response_size",
		fmt.Sprintf("{source_service=\"%s.%s.%s\"}", servicename, namespace, clustername), duration, now)
	if err != nil {
		return nil, err
	}
	metrics["Healthy replicas"], err = fetchGauge(api,
		fmt.Sprintf("envoy_cluster_out_%s_%s_%s_http_membership_healthy", servicename, namespace, envoyClustername),
		"", now)
	if err != nil {
		return nil, err
	}
	metrics["Total replicas"], err = fetchGauge(api,
		fmt.Sprintf("envoy_cluster_out_%s_%s_%s_http_membership_total", servicename, namespace, envoyClustername),
		"", now)
	if err != nil {
		return nil, err
	}
	return metrics, nil
}

func fetchGauge(api v1.API, metricName string, labels string, now time.Time) (*MetricValue, error) {
	query := fmt.Sprintf("%s%s", metricName, labels)
	val, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	return &MetricValue{
		Query: query,
		Value: val}, nil
}

func fetchRate(api v1.API, metricName string, labels string, duration string, now time.Time) (*MetricValue, error) {
	query := fmt.Sprintf("rate(%s%s[%s])", metricName, labels, duration)
	val, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	return &MetricValue{
		Query: query,
		Value: val}, nil
}

func fetchHistogram(api v1.API, metricName string, labels string, duration string, now time.Time) (*MetricHistogram, error) {
	// Note: we may want to make returned stats configurable in the future
	// Average
	query := fmt.Sprintf(
		"sum(rate(%s_sum%s[%s])) / sum(rate(%s_count%s[%s]))", metricName, labels, duration, metricName, labels, duration)
	avg, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	// Median
	query = fmt.Sprintf(
		"histogram_quantile(0.5, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
	med, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	// Quantile 95
	query = fmt.Sprintf(
		"histogram_quantile(0.95, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
	q95, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	// Quantile 99
	query = fmt.Sprintf(
		"histogram_quantile(0.99, sum(rate(%s_bucket%s[%s])) by (le))", metricName, labels, duration)
	q99, err := fetchScalarDouble(api, query, now)
	if err != nil {
		return nil, err
	}
	return &MetricHistogram{
		Query:       query,
		Average:     avg,
		Median:      med,
		NinetyFiveP: q95,
		NinetyNineP: q99}, nil
}

func fetchScalarDouble(api v1.API, query string, now time.Time) (float64, error) {
	result, err := api.Query(context.Background(), query, now)
	if err != nil {
		return 0, err
	}
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		if len(matrix) > 0 {
			return float64(matrix[0].Value), nil
		}
	}
	return math.NaN(), nil
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by thi client
func (in *Client) API() v1.API {
	return v1.NewAPI(in.p8s)
}
