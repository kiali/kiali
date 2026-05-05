package prometheus

import (
	"context"
	"errors"
	"testing"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNoopClientRateMethods(t *testing.T) {
	client := NewNoopClient()
	ctx := context.Background()
	now := time.Now()

	v, err := client.GetAllRequestRates(ctx, "ns", "cluster", "30s", now)
	assert.Empty(t, v)
	assert.NoError(t, err)

	vi, vo, err := client.GetAppRequestRates(ctx, "ns", "cluster", "app", "30s", now)
	assert.Empty(t, vi)
	assert.Empty(t, vo)
	assert.NoError(t, err)

	v, err = client.GetNamespaceServicesRequestRates(ctx, "ns", "cluster", "30s", now)
	assert.Empty(t, v)
	assert.NoError(t, err)

	v, err = client.GetServiceRequestRates(ctx, "ns", "cluster", "svc", "30s", now)
	assert.Empty(t, v)
	assert.NoError(t, err)

	vi, vo, err = client.GetWorkloadRequestRates(ctx, "ns", "cluster", "wkl", "30s", now)
	assert.Empty(t, vi)
	assert.Empty(t, vo)
	assert.NoError(t, err)
}

func TestNoopClientFetchMethods(t *testing.T) {
	client := NewNoopClient()
	ctx := context.Background()
	now := time.Now()

	m := client.FetchDelta(ctx, "metric", "labels", "grouping", now, time.Minute)
	assert.Empty(t, m.Matrix)
	assert.NoError(t, m.Err)

	m = client.FetchRange(ctx, "metric", "labels", "grouping", "avg", nil)
	assert.Empty(t, m.Matrix)
	assert.NoError(t, m.Err)

	m = client.FetchRateRange(ctx, "metric", []string{"label"}, "grouping", nil)
	assert.Empty(t, m.Matrix)
	assert.NoError(t, m.Err)

	h := client.FetchHistogramRange(ctx, "metric", "labels", "grouping", nil)
	assert.Empty(t, h)

	hv, err := client.FetchHistogramValues(ctx, "metric", "labels", "grouping", "30s", false, []string{"0.5"}, now)
	assert.Empty(t, hv)
	assert.NoError(t, err)
}

func TestNoopClientIntrospectionMethodsReturnDisabledError(t *testing.T) {
	client := NewNoopClient()
	ctx := context.Background()

	_, err := client.GetBuildInfo(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrPrometheusDisabled))

	_, err = client.GetConfiguration(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrPrometheusDisabled))

	_, err = client.GetRuntimeinfo(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrPrometheusDisabled))
}

func TestNoopClientMetricNameMethods(t *testing.T) {
	client := NewNoopClient()
	ctx := context.Background()

	names, err := client.GetExistingMetricNames(ctx, []string{"metric1", "metric2"})
	assert.Empty(t, names)
	assert.NoError(t, err)

	labels, err := client.GetMetricsForLabels(ctx, []string{"metric1"}, "label")
	assert.Empty(t, labels)
	assert.NoError(t, err)
}

func TestNoopClientAPIReturnsNoopAPI(t *testing.T) {
	client := NewNoopClient()
	api := client.API()
	require.NotNil(t, api, "API() must not return nil")

	ctx := context.Background()
	now := time.Now()

	// Data-read methods return empty results with nil error (no toast, graceful degradation)
	v, _, err := api.Query(ctx, "up", now)
	assert.NoError(t, err)
	assert.Empty(t, v)

	v, _, err = api.QueryRange(ctx, "up", prom_v1.Range{})
	assert.NoError(t, err)
	assert.Empty(t, v)

	exemplars, err := api.QueryExemplars(ctx, "up", now, now)
	assert.NoError(t, err)
	assert.Empty(t, exemplars)

	series, _, err := api.Series(ctx, nil, now, now)
	assert.NoError(t, err)
	assert.Empty(t, series)

	names, _, err := api.LabelNames(ctx, nil, now, now)
	assert.NoError(t, err)
	assert.Empty(t, names)

	values, _, err := api.LabelValues(ctx, "__name__", nil, now, now)
	assert.NoError(t, err)
	assert.Empty(t, values)

	// Admin/introspection methods still return ErrPrometheusDisabled
	_, err = api.Buildinfo(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrPrometheusDisabled))
}
