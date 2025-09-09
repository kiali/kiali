package prometheustest

import (
	"context"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/prometheus"
)

// FakeClient implements prometheus.ClientInterface for testing purposes
// All methods return empty values
type FakeClient struct{}

// API returns nil API for testing
func (f *FakeClient) API() prom_v1.API {
	return nil
}

// FetchDelta returns empty Metric
func (f *FakeClient) FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) prometheus.Metric {
	return prometheus.Metric{}
}

// FetchHistogramRange returns empty Histogram
func (f *FakeClient) FetchHistogramRange(metricName, labels, grouping string, q *prometheus.RangeQuery) prometheus.Histogram {
	return prometheus.Histogram{}
}

// FetchHistogramValues returns empty map and nil error
func (f *FakeClient) FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	return map[string]model.Vector{}, nil
}

// FetchRange returns empty Metric
func (f *FakeClient) FetchRange(metricName, labels, grouping, aggregator string, q *prometheus.RangeQuery) prometheus.Metric {
	return prometheus.Metric{}
}

// FetchRateRange returns empty Metric
func (f *FakeClient) FetchRateRange(metricName string, labels []string, grouping string, q *prometheus.RangeQuery) prometheus.Metric {
	return prometheus.Metric{}
}

// GetAllRequestRates returns empty Vector and nil error
func (f *FakeClient) GetAllRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

// GetAppRequestRates returns empty Vectors and nil error
func (f *FakeClient) GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return model.Vector{}, model.Vector{}, nil
}

// GetBuildInfo returns empty BuildinfoResult and nil error
func (f *FakeClient) GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error) {
	return &prom_v1.BuildinfoResult{}, nil
}

// GetConfiguration returns empty ConfigResult and nil error
func (f *FakeClient) GetConfiguration() (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, nil
}

// GetExistingMetricNames returns empty slice and nil error
func (f *FakeClient) GetExistingMetricNames(metricNames []string) ([]string, error) {
	return []string{}, nil
}

// GetMetricsForLabels returns empty slice and nil error
func (f *FakeClient) GetMetricsForLabels(metricNames []string, labels string) ([]string, error) {
	return []string{}, nil
}

// GetNamespaceServicesRequestRates returns empty Vector and nil error
func (f *FakeClient) GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

// GetServiceRequestRates returns empty Vector and nil error
func (f *FakeClient) GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

// GetRuntimeinfo returns empty RuntimeinfoResult and nil error
func (f *FakeClient) GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, nil
}

// GetWorkloadRequestRates returns empty Vectors and nil error
func (f *FakeClient) GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return model.Vector{}, model.Vector{}, nil
}
