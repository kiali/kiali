package prometheus

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric
	FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram
	FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error)
	FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric
	FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric
	GetAllRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetConfiguration() (prom_v1.ConfigResult, error)
	GetExistingMetricNames(metricNames []string) ([]string, error)
	GetFlags() (prom_v1.FlagsResult, error)
	GetMetricsForLabels(metricNames []string, labels string) ([]string, error)
	GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error)
	GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s api.Client
	api prom_v1.API
	ctx context.Context
}

var (
	once      sync.Once
	promCache PromCache
)

func initPromCache(ctx context.Context) {
	if config.Get().ExternalServices.Prometheus.CacheEnabled {
		log.FromContext(ctx).Info().Msgf("PromCache Enabled")
		promCache = NewPromCache(ctx)
	} else {
		log.FromContext(ctx).Info().Msgf("PromCache Disabled")
	}
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	return NewClientForConfig(config.Get().ExternalServices.Prometheus)
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClientForConfig(cfg config.PrometheusConfig) (*Client, error) {
	clientConfig := api.Config{Address: cfg.URL}

	// Prom Cache will be initialized once at first use of Prometheus Client
	once.Do(func() {
		// create the cache with its own context/logger
		zl := log.WithGroup(promCachelogGroupName)
		ctx := log.ToContext(context.Background(), zl)
		initPromCache(ctx)
	})

	// prepare the client logger and put it in a context
	zl := log.WithGroup(logGroupName)
	ctx := log.ToContext(context.Background(), zl)

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		// Note: if we are using the 'bearer' authentication method then we want to use the Kiali
		// service account token and not the user's token. This is because Kiali does filtering based
		// on the user's token and prevents people who shouldn't have access to particular metrics.
		token, _, err := kubernetes.GetKialiTokenForHomeCluster()
		if err != nil {
			zl.Error().Msgf("Could not read the Kiali Service Account token: %v", err)
			return nil, err
		}
		auth.Token = token
	}

	// make a copy of the prometheus DefaultRoundTripper to avoid race condition (issue #3518)
	// Do not copy the struct itself, it contains a lock. Re-create it from scratch instead.
	roundTripper := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	transportConfig, err := httputil.CreateTransport(&auth, roundTripper, httputil.DefaultTimeout, cfg.CustomHeaders)
	if err != nil {
		return nil, err
	}
	clientConfig.RoundTripper = transportConfig

	p8s, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}
	client := Client{
		p8s: p8s,
		api: prom_v1.NewAPI(p8s),
		ctx: ctx,
	}
	return &client, nil
}

// Inject allows for replacing the API with a mock For testing
func (in *Client) Inject(api prom_v1.API) {
	in.api = api
}

// GetAllRequestRates queries Prometheus to fetch request counter rates, over a time interval, for requests
// into, internal to, or out of the namespace. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (rates, error)
func (in *Client) GetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetAllRequestRates(namespace, cluster, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getAllRequestRates(in.ctx, in.api, namespace, cluster, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetAllRequestRates(namespace, cluster, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetNamespaceServicesRequestRates queries Prometheus to fetch request counter rates, over a time interval, limited to
// requests for services in the namespace. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (rates, error)
func (in *Client) GetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getNamespaceServicesRequestRates(in.ctx, in.api, namespace, cluster, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetNamespaceServicesRequestRates(namespace, cluster, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetServiceRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given service (hence only inbound). Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, error)
func (in *Client) GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetServiceRequestRates(namespace, cluster, service, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getServiceRequestRates(in.ctx, in.api, namespace, cluster, service, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetServiceRequestRates(namespace, cluster, service, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetAppRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given app, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetAppRequestRates [namespace: %s] [cluster: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, app, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, inResult, outResult := promCache.GetAppRequestRates(namespace, cluster, app, ratesInterval, queryTime); isCached {
			return inResult, outResult, nil
		}
	}
	inResult, outResult, err := getItemRequestRates(in.ctx, in.api, namespace, cluster, app, "app", queryTime, ratesInterval)
	if err != nil {
		return inResult, outResult, err
	}
	if promCache != nil {
		promCache.SetAppRequestRates(namespace, cluster, app, ratesInterval, queryTime, inResult, outResult)
	}
	return inResult, outResult, nil
}

// GetWorkloadRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given workload, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetWorkloadRequestRates [namespace: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, workload, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, inResult, outResult := promCache.GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval, queryTime); isCached {
			return inResult, outResult, nil
		}
	}
	inResult, outResult, err := getItemRequestRates(in.ctx, in.api, namespace, cluster, workload, "workload", queryTime, ratesInterval)
	if err != nil {
		return inResult, outResult, err
	}
	if promCache != nil {
		promCache.SetWorkloadRequestRates(namespace, cluster, workload, ratesInterval, queryTime, inResult, outResult)
	}
	return inResult, outResult, nil
}

// FetchDelta fetches a delta for a simple metric (gauge or counter), for a given duration
func (in *Client) FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric {
	query := fmt.Sprintf("delta(%s%s[%s])", metricName, labels, duration.Round(time.Second).String())
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	return fetchQuery(in.ctx, in.api, query, queryTime)
}

// FetchRange fetches a simple metric (gauge or counter) in given range
func (in *Client) FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	query := fmt.Sprintf("%s(%s%s)", aggregator, metricName, labels)
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	return fetchRange(in.ctx, in.api, query, q.Range)
}

// FetchRateRange fetches a counter's rate in given range
func (in *Client) FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	return fetchRateRange(in.ctx, in.api, metricName, labels, grouping, q)
}

// FetchHistogramRange fetches bucketed metric as histogram in given range
func (in *Client) FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram {
	return fetchHistogramRange(in.ctx, in.api, metricName, labels, grouping, q)
}

// FetchHistogramValues fetches bucketed metric as histogram at a given specific time
func (in *Client) FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	return fetchHistogramValues(in.ctx, in.api, metricName, labels, grouping, rateInterval, avg, quantiles, queryTime)
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by this client
func (in *Client) API() prom_v1.API {
	return in.api
}

// Address return the configured Prometheus service URL
func (in *Client) Address() string {
	return config.Get().ExternalServices.Prometheus.URL
}

func (in *Client) GetConfiguration() (prom_v1.ConfigResult, error) {
	config, err := in.API().Config(in.ctx)
	if err != nil {
		return prom_v1.ConfigResult{}, err
	}
	return config, nil
}

// func (in *Client) GetContext() context.Context {
// 	return in.ctx
// }

func (in *Client) GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error) {
	ri, err := in.API().Runtimeinfo(in.ctx)
	if err != nil {
		return prom_v1.RuntimeinfoResult{}, err
	}
	return ri, nil
}

// GetMetricsForLabels returns a list of metrics existing for the provided labels set. Only metrics that match a name in the given
// list of metricNames will be returned - others will be ignored.
func (in *Client) GetMetricsForLabels(metricNames []string, labelQueryString string) ([]string, error) {
	if len(metricNames) == 0 {
		return []string{}, nil
	}

	zl := log.FromContext(in.ctx)

	zl.Trace().Msgf("GetMetricsForLabels: labels=[%v] metricNames=[%v]", labelQueryString, metricNames)
	startT := time.Now()
	queryString := fmt.Sprintf("count(%v) by (__name__)", labelQueryString)
	results, warnings, err := in.api.Query(in.ctx, queryString, time.Now())
	if len(warnings) > 0 {
		zl.Warn().Msgf("GetMetricsForLabels. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}

	metricsWeAreLookingFor := make(map[string]bool, len(metricNames))
	for i := 0; i < len(metricNames); i++ {
		metricsWeAreLookingFor[metricNames[i]] = true
	}

	metricsWeFound := make([]string, 0, 5)
	for _, item := range results.(model.Vector) {
		n := string(item.Metric["__name__"])
		if metricsWeAreLookingFor[n] {
			metricsWeFound = append(metricsWeFound, n)
		}
	}

	zl.Trace().Msgf("GetMetricsForLabels: exec time=[%v], results count=[%v], looking for count=[%v], found count=[%v]", time.Since(startT), len(results.(model.Vector)), len(metricsWeAreLookingFor), len(metricsWeFound))
	return metricsWeFound, nil
}

// GetExistingMetricNames returns a list of the requested metric names that exist in Prometheus (meaning there is a matching __name__ label).
func (in *Client) GetExistingMetricNames(metricNames []string) ([]string, error) {
	if len(metricNames) == 0 {
		return []string{}, nil
	}

	zl := log.FromContext(in.ctx)

	zl.Trace().Msgf("GetExistingMetricNames: metricNames=[%v]", metricNames)
	startT := time.Now()
	results, warnings, err := in.api.LabelValues(in.ctx, "__name__", []string{}, time.Unix(0, 0), time.Now())
	if len(warnings) > 0 {
		zl.Warn().Msgf("GetExistingMetricNames. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}

	metricsWeAreLookingFor := make(map[string]bool, len(metricNames))
	for i := 0; i < len(metricNames); i++ {
		metricsWeAreLookingFor[string(metricNames[i])] = true
	}

	metricsWeFound := make([]string, 0, len(metricNames))
	for _, item := range results {
		name := string(item)
		if metricsWeAreLookingFor[name] {
			metricsWeFound = append(metricsWeFound, name)
		}
	}

	zl.Trace().Msgf("GetExistingMetricNames: exec time=[%v], results count=[%v], looking for count=[%v], found count=[%v]", time.Since(startT), len(results), len(metricsWeAreLookingFor), len(metricsWeFound))
	return metricsWeFound, nil
}

// SanitizeLabelName replaces anything that doesn't match invalidLabelCharRE with an underscore.
// Copied from https://github.com/prometheus/prometheus/blob/df80dc4d3970121f2f76cba79050983ffb3cdbb0/util/strutil/strconv.go
func SanitizeLabelName(name string) string {
	return invalidLabelCharRE.ReplaceAllString(name, "_")
}
