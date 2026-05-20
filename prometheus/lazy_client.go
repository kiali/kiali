package prometheus

import (
	"context"
	"sync/atomic"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var _ ClientInterface = (*LazyClient)(nil)

const defaultLazyClientRetryInterval = 30 * time.Second

// LazyClient implements ClientInterface with deferred Prometheus connectivity.
// It starts serving immediately with a NoopClient and spawns a background
// goroutine that retries NewClient + a health probe until Prometheus is
// reachable, then atomically swaps in the real client. All business-layer
// consumers hold a pointer to the same LazyClient, so the swap transparently
// upgrades every caller with no locking on reads.
type LazyClient struct {
	ptr atomic.Pointer[ClientInterface]
}

func NewLazyClient(ctx context.Context, conf config.Config, kialiSAToken string) *LazyClient {
	return newLazyClient(ctx, conf, kialiSAToken, defaultLazyClientRetryInterval)
}

func newLazyClient(ctx context.Context, conf config.Config, kialiSAToken string, retryInterval time.Duration) *LazyClient {
	lc := &LazyClient{}
	var noop ClientInterface = NewNoopClient()
	lc.ptr.Store(&noop)

	config.SetPrometheusDisabledReason("Connecting to Prometheus, metrics features are temporarily unavailable")

	go lc.connect(ctx, conf, kialiSAToken, retryInterval)
	return lc
}

func (lc *LazyClient) connect(ctx context.Context, conf config.Config, kialiSAToken string, retryInterval time.Duration) {
	healthURL := conf.ExternalServices.Prometheus.HealthCheckUrl
	if healthURL == "" {
		healthURL = conf.ExternalServices.Prometheus.URL + "/-/healthy"
	}

	var client *Client
	retryErr := wait.PollUntilContextCancel(ctx, retryInterval, true, func(ctx context.Context) (bool, error) {
		c, err := NewClient(conf, kialiSAToken)
		if err != nil {
			log.Warningf("Prometheus client init failed: %v. Retrying in %s", err, retryInterval)
			return false, nil
		}
		_, statusCode, _, probeErr := httputil.HttpGet(healthURL, &conf.ExternalServices.Prometheus.Auth, 10*time.Second, nil, nil, &conf)
		if probeErr != nil || statusCode > 399 {
			log.Warningf("Prometheus unreachable at [%s] (status %d): %v. Retrying in %s", healthURL, statusCode, probeErr, retryInterval)
			return false, nil
		}
		client = c
		return true, nil
	})
	if retryErr != nil {
		log.Warningf("Prometheus client initialization cancelled (context done): %s", retryErr)
		return
	}

	lc.set(client)
	config.SetPrometheusDisabledReason("")
	log.Info("Prometheus connected -- metrics features restored")
}

func (lc *LazyClient) set(c ClientInterface) {
	lc.ptr.Store(&c)
}

func (lc *LazyClient) get() ClientInterface {
	return *lc.ptr.Load()
}

func (lc *LazyClient) API() prom_v1.API {
	return lc.get().API()
}

func (lc *LazyClient) FetchDelta(ctx context.Context, metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric {
	return lc.get().FetchDelta(ctx, metricName, labels, grouping, queryTime, duration)
}

func (lc *LazyClient) FetchHistogramRange(ctx context.Context, metricName, labels, grouping string, q *RangeQuery) Histogram {
	return lc.get().FetchHistogramRange(ctx, metricName, labels, grouping, q)
}

func (lc *LazyClient) FetchHistogramValues(ctx context.Context, metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	return lc.get().FetchHistogramValues(ctx, metricName, labels, grouping, rateInterval, avg, quantiles, queryTime)
}

func (lc *LazyClient) FetchRange(ctx context.Context, metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	return lc.get().FetchRange(ctx, metricName, labels, grouping, aggregator, q)
}

func (lc *LazyClient) FetchRateRange(ctx context.Context, metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	return lc.get().FetchRateRange(ctx, metricName, labels, grouping, q)
}

func (lc *LazyClient) GetAllRequestRates(ctx context.Context, namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return lc.get().GetAllRequestRates(ctx, namespace, cluster, ratesInterval, queryTime)
}

func (lc *LazyClient) GetAppRequestRates(ctx context.Context, namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return lc.get().GetAppRequestRates(ctx, namespace, cluster, app, ratesInterval, queryTime)
}

func (lc *LazyClient) GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error) {
	return lc.get().GetBuildInfo(ctx)
}

func (lc *LazyClient) GetConfiguration(ctx context.Context) (prom_v1.ConfigResult, error) {
	return lc.get().GetConfiguration(ctx)
}

func (lc *LazyClient) GetExistingMetricNames(ctx context.Context, metricNames []string) ([]string, error) {
	return lc.get().GetExistingMetricNames(ctx, metricNames)
}

func (lc *LazyClient) GetMetricsForLabels(ctx context.Context, metricNames []string, labels string) ([]string, error) {
	return lc.get().GetMetricsForLabels(ctx, metricNames, labels)
}

func (lc *LazyClient) GetNamespaceServicesRequestRates(ctx context.Context, namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return lc.get().GetNamespaceServicesRequestRates(ctx, namespace, cluster, ratesInterval, queryTime)
}

func (lc *LazyClient) GetRuntimeinfo(ctx context.Context) (prom_v1.RuntimeinfoResult, error) {
	return lc.get().GetRuntimeinfo(ctx)
}

func (lc *LazyClient) GetServiceRequestRates(ctx context.Context, namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	return lc.get().GetServiceRequestRates(ctx, namespace, cluster, service, ratesInterval, queryTime)
}

func (lc *LazyClient) GetWorkloadRequestRates(ctx context.Context, namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	return lc.get().GetWorkloadRequestRates(ctx, namespace, cluster, workload, ratesInterval, queryTime)
}
