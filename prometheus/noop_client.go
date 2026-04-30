package prometheus

import (
	"context"
	"errors"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

var ErrPrometheusDisabled = errors.New("prometheus is disabled")

// Compile-time interface satisfaction guards
var _ ClientInterface = (*NoopClient)(nil)
var _ prom_v1.API = (*noopAPI)(nil)

// NoopClient implements ClientInterface but returns empty results for all methods.
// Used when Prometheus is disabled in the Kiali configuration.
type NoopClient struct {
	api noopAPI
}

func NewNoopClient() *NoopClient {
	return &NoopClient{}
}

func (n *NoopClient) API() prom_v1.API {
	return &n.api
}

func (n *NoopClient) FetchDelta(_ context.Context, _, _, _ string, _ time.Time, _ time.Duration) Metric {
	return Metric{}
}

func (n *NoopClient) FetchHistogramRange(_ context.Context, _, _, _ string, _ *RangeQuery) Histogram {
	return Histogram{}
}

func (n *NoopClient) FetchHistogramValues(_ context.Context, _, _, _, _ string, _ bool, _ []string, _ time.Time) (map[string]model.Vector, error) {
	return map[string]model.Vector{}, nil
}

func (n *NoopClient) FetchRange(_ context.Context, _, _, _, _ string, _ *RangeQuery) Metric {
	return Metric{}
}

func (n *NoopClient) FetchRateRange(_ context.Context, _ string, _ []string, _ string, _ *RangeQuery) Metric {
	return Metric{}
}

func (n *NoopClient) GetAllRequestRates(_ context.Context, _, _, _ string, _ time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

func (n *NoopClient) GetAppRequestRates(_ context.Context, _, _, _, _ string, _ time.Time) (model.Vector, model.Vector, error) {
	return model.Vector{}, model.Vector{}, nil
}

func (n *NoopClient) GetBuildInfo(_ context.Context) (*prom_v1.BuildinfoResult, error) {
	return nil, ErrPrometheusDisabled
}

func (n *NoopClient) GetConfiguration(_ context.Context) (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, ErrPrometheusDisabled
}

func (n *NoopClient) GetExistingMetricNames(_ context.Context, _ []string) ([]string, error) {
	return []string{}, nil
}

func (n *NoopClient) GetMetricsForLabels(_ context.Context, _ []string, _ string) ([]string, error) {
	return []string{}, nil
}

func (n *NoopClient) GetNamespaceServicesRequestRates(_ context.Context, _, _, _ string, _ time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

func (n *NoopClient) GetServiceRequestRates(_ context.Context, _, _, _, _ string, _ time.Time) (model.Vector, error) {
	return model.Vector{}, nil
}

func (n *NoopClient) GetRuntimeinfo(_ context.Context) (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, ErrPrometheusDisabled
}

func (n *NoopClient) GetWorkloadRequestRates(_ context.Context, _, _, _, _ string, _ time.Time) (model.Vector, model.Vector, error) {
	return model.Vector{}, model.Vector{}, nil
}

// noopAPI implements prom_v1.API with empty/error results.
// Prevents nil pointer panics when callers use client.API() directly.
type noopAPI struct{}

func (n *noopAPI) Alerts(_ context.Context) (prom_v1.AlertsResult, error) {
	return prom_v1.AlertsResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) AlertManagers(_ context.Context) (prom_v1.AlertManagersResult, error) {
	return prom_v1.AlertManagersResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) CleanTombstones(_ context.Context) error {
	return ErrPrometheusDisabled
}

func (n *noopAPI) Config(_ context.Context) (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) DeleteSeries(_ context.Context, _ []string, _, _ time.Time) error {
	return ErrPrometheusDisabled
}

func (n *noopAPI) Flags(_ context.Context) (prom_v1.FlagsResult, error) {
	return prom_v1.FlagsResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) LabelNames(_ context.Context, _ []string, _, _ time.Time, _ ...prom_v1.Option) ([]string, prom_v1.Warnings, error) {
	return []string{}, nil, ErrPrometheusDisabled
}

func (n *noopAPI) LabelValues(_ context.Context, _ string, _ []string, _, _ time.Time, _ ...prom_v1.Option) (model.LabelValues, prom_v1.Warnings, error) {
	return model.LabelValues{}, nil, ErrPrometheusDisabled
}

func (n *noopAPI) Query(_ context.Context, _ string, _ time.Time, _ ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	return model.Vector{}, nil, ErrPrometheusDisabled
}

func (n *noopAPI) QueryRange(_ context.Context, _ string, _ prom_v1.Range, _ ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	return model.Matrix{}, nil, ErrPrometheusDisabled
}

func (n *noopAPI) QueryExemplars(_ context.Context, _ string, _, _ time.Time) ([]prom_v1.ExemplarQueryResult, error) {
	return []prom_v1.ExemplarQueryResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Buildinfo(_ context.Context) (prom_v1.BuildinfoResult, error) {
	return prom_v1.BuildinfoResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Runtimeinfo(_ context.Context) (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Series(_ context.Context, _ []string, _, _ time.Time, _ ...prom_v1.Option) ([]model.LabelSet, prom_v1.Warnings, error) {
	return []model.LabelSet{}, nil, ErrPrometheusDisabled
}

func (n *noopAPI) Snapshot(_ context.Context, _ bool) (prom_v1.SnapshotResult, error) {
	return prom_v1.SnapshotResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Rules(_ context.Context) (prom_v1.RulesResult, error) {
	return prom_v1.RulesResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Targets(_ context.Context) (prom_v1.TargetsResult, error) {
	return prom_v1.TargetsResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) TargetsMetadata(_ context.Context, _, _, _ string) ([]prom_v1.MetricMetadata, error) {
	return []prom_v1.MetricMetadata{}, ErrPrometheusDisabled
}

func (n *noopAPI) Metadata(_ context.Context, _, _ string) (map[string][]prom_v1.Metadata, error) {
	return map[string][]prom_v1.Metadata{}, ErrPrometheusDisabled
}

func (n *noopAPI) TSDB(_ context.Context, _ ...prom_v1.Option) (prom_v1.TSDBResult, error) {
	return prom_v1.TSDBResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) WalReplay(_ context.Context) (prom_v1.WalReplayStatus, error) {
	return prom_v1.WalReplayStatus{}, ErrPrometheusDisabled
}
