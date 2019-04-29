package prometheustest

import (
	"context"
	"time"

	"github.com/kiali/kiali/prometheus"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
)

// PromAPIMock for mocking Prometheus API
type PromAPIMock struct {
	mock.Mock
}

func (o *PromAPIMock) AlertManagers(ctx context.Context) (prom_v1.AlertManagersResult, error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.AlertManagersResult), args.Error(1)
}

func (o *PromAPIMock) CleanTombstones(ctx context.Context) error {
	args := o.Called(ctx)
	return args.Error(0)
}

func (o *PromAPIMock) Config(ctx context.Context) (prom_v1.ConfigResult, error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.ConfigResult), args.Error(1)
}

func (o *PromAPIMock) DeleteSeries(ctx context.Context, matches []string, startTime time.Time, endTime time.Time) error {
	args := o.Called(ctx, matches, startTime, endTime)
	return args.Error(0)
}

func (o *PromAPIMock) Flags(ctx context.Context) (prom_v1.FlagsResult, error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.FlagsResult), args.Error(1)
}

func (o *PromAPIMock) LabelValues(ctx context.Context, label string) (model.LabelValues, error) {
	args := o.Called(ctx, label)
	return args.Get(0).(model.LabelValues), args.Error(1)
}

func (o *PromAPIMock) Query(ctx context.Context, query string, ts time.Time) (model.Value, error) {
	args := o.Called(ctx, query, ts)
	return args.Get(0).(model.Value), args.Error(1)
}

func (o *PromAPIMock) QueryRange(ctx context.Context, query string, r prom_v1.Range) (model.Value, error) {
	args := o.Called(ctx, query, r)
	return args.Get(0).(model.Value), args.Error(1)
}

func (o *PromAPIMock) Series(ctx context.Context, matches []string, startTime time.Time, endTime time.Time) ([]model.LabelSet, error) {
	args := o.Called(ctx, matches, startTime, endTime)
	return args.Get(0).([]model.LabelSet), args.Error(1)
}

func (o *PromAPIMock) Snapshot(ctx context.Context, skipHead bool) (prom_v1.SnapshotResult, error) {
	args := o.Called(ctx, skipHead)
	return args.Get(0).(prom_v1.SnapshotResult), args.Error(1)
}

func (o *PromAPIMock) Targets(ctx context.Context) (prom_v1.TargetsResult, error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.TargetsResult), args.Error(1)
}

// AlwaysReturnEmpty mocks all possible queries to return empty result
func (o *PromAPIMock) AlwaysReturnEmpty() {
	metric := model.Metric{
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	o.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("time.Time"),
	).Return(model.Vector{}, nil)
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: metric,
			Values: []model.SamplePair{}}}
	o.On(
		"QueryRange",
		mock.AnythingOfType("*context.emptyCtx"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("v1.Range"),
	).Return(matrix, nil)
}

// SpyArgumentsAndReturnEmpty mocks all possible queries to return empty result,
// allowing to spy arguments through input callback
func (o *PromAPIMock) SpyArgumentsAndReturnEmpty(fn func(args mock.Arguments)) {
	metric := model.Metric{
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	o.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("time.Time"),
	).Run(fn).Return(model.Vector{}, nil)
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: metric,
			Values: []model.SamplePair{}}}
	o.On(
		"QueryRange",
		mock.AnythingOfType("*context.emptyCtx"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("v1.Range"),
	).Run(fn).Return(matrix, nil)
}

type PromClientMock struct {
	mock.Mock
}

// MockAppRequestRates mocks GetAppRequestRates for given namespace and app, returning in & out vectors
func (o *PromClientMock) MockAppRequestRates(namespace, app string, in, out model.Vector) {
	o.On("GetAppRequestRates", namespace, app, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(in, out, nil)
}

// MockServiceRequestRates mocks GetServiceRequestRates for given namespace and service, returning in vector
func (o *PromClientMock) MockServiceRequestRates(namespace, service string, in model.Vector) {
	o.On("GetServiceRequestRates", namespace, service, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(in, nil)
}

// MockWorkloadRequestRates mocks GetWorkloadRequestRates for given namespace and workload, returning in & out vectors
func (o *PromClientMock) MockWorkloadRequestRates(namespace, wkld string, in, out model.Vector) {
	o.On("GetWorkloadRequestRates", namespace, wkld, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(in, out, nil)
}

// MockEmptyMetricsDiscovery mocks GetMetricsForLabels (for runtimes metrics discovery) as being empty
func (o *PromClientMock) MockEmptyMetricsDiscovery() {
	o.On("GetMetricsForLabels", mock.AnythingOfType("[]string")).Return([]string{}, nil)
}

func (o *PromClientMock) GetAllRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	args := o.Called(namespace, ratesInterval, queryTime)
	return args.Get(0).(model.Vector), args.Error(1)
}

func (o *PromClientMock) GetConfiguration() (prom_v1.ConfigResult, error) {
	args := o.Called()
	return args.Get(0).(prom_v1.ConfigResult), args.Error(1)
}

func (o *PromClientMock) GetFlags() (prom_v1.FlagsResult, error) {
	args := o.Called()
	return args.Get(0).(prom_v1.FlagsResult), args.Error(1)
}

func (o *PromClientMock) GetNamespaceServicesRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	args := o.Called(namespace, ratesInterval, queryTime)
	return args.Get(0).(model.Vector), args.Error(1)
}

func (o *PromClientMock) GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	args := o.Called(namespace, app, ratesInterval, queryTime)
	return args.Get(0).(model.Vector), args.Get(1).(model.Vector), args.Error(2)
}

func (o *PromClientMock) GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	args := o.Called(namespace, service, ratesInterval, queryTime)
	return args.Get(0).(model.Vector), args.Error(1)
}

func (o *PromClientMock) GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	args := o.Called(namespace, workload, ratesInterval, queryTime)
	return args.Get(0).(model.Vector), args.Get(1).(model.Vector), args.Error(2)
}

func (o *PromClientMock) FetchRange(metricName, labels, grouping, aggregator string, q *prometheus.BaseMetricsQuery) *prometheus.Metric {
	args := o.Called(metricName, labels, grouping, aggregator, q)
	return args.Get(0).(*prometheus.Metric)
}

func (o *PromClientMock) FetchRateRange(metricName, labels, grouping string, q *prometheus.BaseMetricsQuery) *prometheus.Metric {
	args := o.Called(metricName, labels, grouping, q)
	return args.Get(0).(*prometheus.Metric)
}

func (o *PromClientMock) FetchHistogramRange(metricName, labels, grouping string, q *prometheus.BaseMetricsQuery) prometheus.Histogram {
	args := o.Called(metricName, labels, grouping, q)
	return args.Get(0).(prometheus.Histogram)
}

func (o *PromClientMock) GetMetrics(query *prometheus.IstioMetricsQuery) prometheus.Metrics {
	args := o.Called(query)
	return args.Get(0).(prometheus.Metrics)
}

func (o *PromClientMock) GetMetricsForLabels(labels []string) ([]string, error) {
	args := o.Called(labels)
	return args.Get(0).([]string), args.Error(1)
}
