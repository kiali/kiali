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

// NoopClient implements ClientInterface returning empty/zero values for all data methods.
// Used when Prometheus is disabled in the Kiali configuration, allowing callers to
// proceed without errors and naturally produce empty results (empty graphs, no health
// data, etc.) rather than crashing or returning errors that would surface as UI toasts.
// Introspection methods (GetBuildInfo, GetConfiguration, GetRuntimeinfo) return
// ErrPrometheusDisabled so callers that check connectivity can detect the disabled state.
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

// noopAPI implements prom_v1.API and is returned by NoopClient.API().
// Prevents nil pointer panics when callers invoke client.API() directly.
//
// Data-read methods (Query, QueryRange, QueryExemplars, Series, LabelNames, LabelValues)
// return empty results with nil error so callers degrade gracefully without surfacing errors.
//
// Admin/introspection methods (Alerts, Config, Flags, Buildinfo, Runtimeinfo,
// CleanTombstones, DeleteSeries, Snapshot, Rules, Targets, etc.) return ErrPrometheusDisabled
// because these are either mutating operations that must not silently no-op, or
// introspection endpoints used to detect whether Prometheus is reachable.
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
	return []string{}, nil, nil
}

func (n *noopAPI) LabelValues(_ context.Context, _ string, _ []string, _, _ time.Time, _ ...prom_v1.Option) (model.LabelValues, prom_v1.Warnings, error) {
	return model.LabelValues{}, nil, nil
}

func (n *noopAPI) Query(_ context.Context, _ string, _ time.Time, _ ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	return model.Vector{}, nil, nil
}

func (n *noopAPI) QueryRange(_ context.Context, _ string, _ prom_v1.Range, _ ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	return model.Matrix{}, nil, nil
}

func (n *noopAPI) QueryExemplars(_ context.Context, _ string, _, _ time.Time) ([]prom_v1.ExemplarQueryResult, error) {
	return []prom_v1.ExemplarQueryResult{}, nil
}

func (n *noopAPI) Buildinfo(_ context.Context) (prom_v1.BuildinfoResult, error) {
	return prom_v1.BuildinfoResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Runtimeinfo(_ context.Context) (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, ErrPrometheusDisabled
}

func (n *noopAPI) Series(_ context.Context, _ []string, _, _ time.Time, _ ...prom_v1.Option) ([]model.LabelSet, prom_v1.Warnings, error) {
	return []model.LabelSet{}, nil, nil
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
