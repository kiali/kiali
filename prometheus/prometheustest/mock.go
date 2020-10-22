package prometheustest

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/prometheus"
)

// PromAPIMock for mocking Prometheus API
type PromAPIMock struct {
	mock.Mock
}

func (o *PromAPIMock) Alerts(ctx context.Context) (prom_v1.AlertsResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.AlertsResult), nil
}

func (o *PromAPIMock) AlertManagers(ctx context.Context) (prom_v1.AlertManagersResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.AlertManagersResult), nil
}

func (o *PromAPIMock) CleanTombstones(ctx context.Context) api.Error {
	o.Called(ctx)
	return nil
}

func (o *PromAPIMock) Config(ctx context.Context) (prom_v1.ConfigResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.ConfigResult), nil
}

func (o *PromAPIMock) DeleteSeries(ctx context.Context, matches []string, startTime time.Time, endTime time.Time) api.Error {
	args := o.Called(ctx, matches, startTime, endTime)
	return args.Get(0).(api.Error)
}

func (o *PromAPIMock) Flags(ctx context.Context) (prom_v1.FlagsResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.FlagsResult), nil
}

func (o *PromAPIMock) LabelValues(ctx context.Context, label string) (model.LabelValues, api.Error) {
	args := o.Called(ctx, label)
	return args.Get(0).(model.LabelValues), nil
}

func (o *PromAPIMock) Query(ctx context.Context, query string, ts time.Time) (model.Value, api.Error) {
	args := o.Called(ctx, query, ts)
	return args.Get(0).(model.Value), nil
}

func (o *PromAPIMock) QueryRange(ctx context.Context, query string, r prom_v1.Range) (model.Value, api.Error) {
	args := o.Called(ctx, query, r)
	return args.Get(0).(model.Value), nil
}

func (o *PromAPIMock) Rules(ctx context.Context) (prom_v1.RulesResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.RulesResult), nil
}

func (o *PromAPIMock) Series(ctx context.Context, matches []string, startTime time.Time, endTime time.Time) ([]model.LabelSet, api.Error) {
	args := o.Called(ctx, matches, startTime, endTime)
	return args.Get(0).([]model.LabelSet), nil
}

func (o *PromAPIMock) Snapshot(ctx context.Context, skipHead bool) (prom_v1.SnapshotResult, api.Error) {
	args := o.Called(ctx, skipHead)
	return args.Get(0).(prom_v1.SnapshotResult), nil
}

func (o *PromAPIMock) Targets(ctx context.Context) (prom_v1.TargetsResult, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).(prom_v1.TargetsResult), nil
}

func (o *PromAPIMock) TargetsMetadata(ctx context.Context, matchTarget, metric, limit string) ([]prom_v1.MetricMetadata, api.Error) {
	args := o.Called(ctx)
	return args.Get(0).([]prom_v1.MetricMetadata), nil
}

func (o *PromAPIMock) OnQueryTime(query string, t *time.Time, ret model.Vector) {
	if t == nil {
		o.On("Query", mock.AnythingOfType("*context.emptyCtx"), query, mock.AnythingOfType("time.Time")).Return(ret, nil)
	} else {
		o.On("Query", mock.AnythingOfType("*context.emptyCtx"), query, *t).Return(ret, nil)
	}
}

func (o *PromAPIMock) MockTimeRounded(query string, ret model.Vector) {
	o.OnQueryTime(round(query), nil, ret)
}

func (o *PromAPIMock) OnQueryRange(query string, r *prom_v1.Range, ret model.Matrix) {
	if r == nil {
		o.On("QueryRange", mock.AnythingOfType("*context.emptyCtx"), query, mock.AnythingOfType("v1.Range")).Return(ret, nil)
	} else {
		o.On("QueryRange", mock.AnythingOfType("*context.emptyCtx"), query, *r).Return(ret, nil)
	}
}

func singleValueMatrix(ret model.SampleValue) model.Matrix {
	return model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{
				"reporter": "destination",
				"__name__": "whatever",
				"instance": "whatever",
				"job":      "whatever"},
			Values: []model.SamplePair{{Timestamp: 0, Value: ret}}}}
}

func emptyMatrix() model.Matrix {
	return model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{
				"reporter": "destination",
				"__name__": "whatever",
				"instance": "whatever",
				"job":      "whatever"},
			Values: []model.SamplePair{}}}
}

func (o *PromAPIMock) MockRangeErrRounded(query string, ret model.SampleValue) {
	o.OnQueryRange(roundErrs(query), nil, singleValueMatrix(ret))
}

func (o *PromAPIMock) MockRangeRounded(query string, ret model.SampleValue) {
	o.OnQueryRange(round(query), nil, singleValueMatrix(ret))
}

func (o *PromAPIMock) MockEmptyRangeRounded(query string) {
	o.OnQueryRange(round(query), nil, emptyMatrix())
}

func (o *PromAPIMock) MockHistoValue(baseName, suffix string, retAvg model.Vector, retMed model.Vector, ret95 model.Vector, ret99 model.Vector) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	o.MockTimeRounded("histogram_quantile(0.5, "+histMetric, retMed)
	o.MockTimeRounded("histogram_quantile(0.95, "+histMetric, ret95)
	o.MockTimeRounded("histogram_quantile(0.99, "+histMetric, ret99)
	o.MockTimeRounded("histogram_quantile(0.999, "+histMetric, ret99)
	o.MockTimeRounded("sum(rate("+baseName+"_sum"+suffix+")) / sum(rate("+baseName+"_count"+suffix+"))", retAvg)
}

func (o *PromAPIMock) MockHistoValueGroupedBy(baseName, labels, groups string, retAvg model.Vector, retMed model.Vector, ret95 model.Vector, ret99 model.Vector) {
	histMetric := "sum(rate(" + baseName + "_bucket" + labels + ")) by (le," + groups + "))"
	o.MockTimeRounded("histogram_quantile(0.5, "+histMetric, retMed)
	o.MockTimeRounded("histogram_quantile(0.95, "+histMetric, ret95)
	o.MockTimeRounded("histogram_quantile(0.99, "+histMetric, ret99)
	o.MockTimeRounded("histogram_quantile(0.999, "+histMetric, ret99)
	o.MockTimeRounded("sum(rate("+baseName+"_sum"+labels+")) by ("+groups+") / sum(rate("+baseName+"_count"+labels+")) by ("+groups+")", retAvg)
}

func (o *PromAPIMock) MockHistoRange(baseName string, suffix string, retAvg model.SampleValue, retMed model.SampleValue, ret95 model.SampleValue, ret99 model.SampleValue) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	o.MockRangeRounded("histogram_quantile(0.5, "+histMetric, retMed)
	o.MockRangeRounded("histogram_quantile(0.95, "+histMetric, ret95)
	o.MockRangeRounded("histogram_quantile(0.99, "+histMetric, ret99)
	o.MockRangeRounded("histogram_quantile(0.999, "+histMetric, ret99)
	o.MockRangeRounded("sum(rate("+baseName+"_sum"+suffix+")) / sum(rate("+baseName+"_count"+suffix+"))", retAvg)
}

func (o *PromAPIMock) MockEmptyHistoRange(baseName string, suffix string) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	o.MockEmptyRangeRounded("histogram_quantile(0.5, " + histMetric)
	o.MockEmptyRangeRounded("histogram_quantile(0.95, " + histMetric)
	o.MockEmptyRangeRounded("histogram_quantile(0.99, " + histMetric)
	o.MockEmptyRangeRounded("histogram_quantile(0.999, " + histMetric)
	o.MockEmptyRangeRounded("sum(rate(" + baseName + "_sum" + suffix + ")) / sum(rate(" + baseName + "_count" + suffix + "))")
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

func (o *PromClientMock) FetchRange(metricName, labels, grouping, aggregator string, q *prometheus.RangeQuery) *prometheus.Metric {
	args := o.Called(metricName, labels, grouping, aggregator, q)
	return args.Get(0).(*prometheus.Metric)
}

func (o *PromClientMock) FetchRateRange(metricName string, labels []string, grouping string, q *prometheus.RangeQuery) *prometheus.Metric {
	args := o.Called(metricName, labels, grouping, q)
	return args.Get(0).(*prometheus.Metric)
}

func (o *PromClientMock) FetchHistogramRange(metricName, labels, grouping string, q *prometheus.RangeQuery) prometheus.Histogram {
	args := o.Called(metricName, labels, grouping, q)
	return args.Get(0).(prometheus.Histogram)
}

func (o *PromClientMock) FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	args := o.Called(metricName, labels, grouping, rateInterval, avg, quantiles, queryTime)
	return args.Get(0).(map[string]model.Vector), args.Error((1))
}

func round(q string) string {
	return fmt.Sprintf("round(%s, 0.001000) > 0.001000 or %s", q, q)
}

func roundErrs(q string) string {
	return fmt.Sprintf("round((%s), 0.001000) > 0.001000 or (%s)", q, q)
}
