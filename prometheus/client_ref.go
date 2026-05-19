package prometheus

import (
	"context"
	"sync/atomic"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// Compile-time interface satisfaction guard.
var _ ClientInterface = (*ClientRef)(nil)

// ClientRef is an atomically-swappable holder for a ClientInterface. It starts
// with an initial client (typically a NoopClient) and is upgraded to a real
// client exactly once — when the background connectivity goroutine succeeds.
// All business-layer consumers hold a pointer to the same ClientRef, so the
// single Set call transparently upgrades every caller with no locking on reads.
//
// This mirrors how tracing handles startup: Kiali begins serving immediately
// with degraded behaviour, then upgrades when the backend is ready.
type ClientRef struct {
	// ptr stores a *ClientInterface. atomic.Pointer requires a concrete pointer
	// type, so we box the interface value in a pointer-to-interface.
	ptr atomic.Pointer[ClientInterface]
}

// NewClientRef returns a ClientRef backed by initial. Pass prometheus.NewNoopClient()
// to start in degraded mode until Set is called with a real client.
func NewClientRef(initial ClientInterface) *ClientRef {
	r := &ClientRef{}
	r.ptr.Store(&initial)
	return r
}

// Set replaces the underlying client. Expected to be called at most once, from
// the background goroutine that establishes Prometheus connectivity at startup.
func (r *ClientRef) Set(c ClientInterface) {
	r.ptr.Store(&c)
}

func (r *ClientRef) get() ClientInterface {
	return *r.ptr.Load()
}

func (r *ClientRef) API() prom_v1.API {
	return r.get().API()
}

func (r *ClientRef) FetchDelta(ctx context.Context, metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric {
	return r.get().FetchDelta(ctx, metricName, labels, grouping, queryTime, duration)
}

func (r *ClientRef) FetchHistogramRange(ctx context.Context, metricName, labels, grouping string, q *RangeQuery) Histogram {
	return r.get().FetchHistogramRange(ctx, metricName, labels, grouping, q)
}

func (r *ClientRef) FetchHistogramValues(ctx context.Context, metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	return r.get().FetchHistogramValues(ctx, metricName, labels, grouping, rateInterval, avg, quantiles, queryTime)
}

func (r *ClientRef) FetchRange(ctx context.Context, metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	return r.get().FetchRange(ctx, metricName, labels, grouping, aggregator, q)
}

func (r *ClientRef) FetchRateRange(ctx context.Context, metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	return r.get().FetchRateRange(ctx, metricName, labels, grouping, q)
}

func (r *ClientRef) GetAllRequestRates(ctx context.Context, namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return r.get().GetAllRequestRates(ctx, namespace, cluster, ratesInterval, queryTime)
}

func (r *ClientRef) GetAppRequestRates(ctx context.Context, namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return r.get().GetAppRequestRates(ctx, namespace, cluster, app, ratesInterval, queryTime)
}

func (r *ClientRef) GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error) {
	return r.get().GetBuildInfo(ctx)
}

func (r *ClientRef) GetConfiguration(ctx context.Context) (prom_v1.ConfigResult, error) {
	return r.get().GetConfiguration(ctx)
}

func (r *ClientRef) GetExistingMetricNames(ctx context.Context, metricNames []string) ([]string, error) {
	return r.get().GetExistingMetricNames(ctx, metricNames)
}

func (r *ClientRef) GetMetricsForLabels(ctx context.Context, metricNames []string, labels string) ([]string, error) {
	return r.get().GetMetricsForLabels(ctx, metricNames, labels)
}

func (r *ClientRef) GetNamespaceServicesRequestRates(ctx context.Context, namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return r.get().GetNamespaceServicesRequestRates(ctx, namespace, cluster, ratesInterval, queryTime)
}

func (r *ClientRef) GetRuntimeinfo(ctx context.Context) (prom_v1.RuntimeinfoResult, error) {
	return r.get().GetRuntimeinfo(ctx)
}

func (r *ClientRef) GetServiceRequestRates(ctx context.Context, namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return r.get().GetServiceRequestRates(ctx, namespace, cluster, service, ratesInterval, queryTime)
}

func (r *ClientRef) GetWorkloadRequestRates(ctx context.Context, namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return r.get().GetWorkloadRequestRates(ctx, namespace, cluster, workload, ratesInterval, queryTime)
}
