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

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var (
	invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram
	FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error)
	FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric
	FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric
	GetAllRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetConfiguration() (prom_v1.ConfigResult, error)
	GetFlags() (prom_v1.FlagsResult, error)
	GetNamespaceServicesRequestRates(namespace, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetMetricsForLabels(labels []string) ([]string, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s api.Client
	api prom_v1.API
	ctx context.Context
}

var once sync.Once
var promCache PromCache

func initPromCache() {
	if config.Get().ExternalServices.Prometheus.CacheEnabled {
		log.Infof("[Prom Cache] Enabled")
		promCache = NewPromCache()
	} else {
		log.Infof("[Prom Cache] Disabled")
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
	once.Do(initPromCache)

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		// Note: if we are using the 'bearer' authentication method then we want to use the Kiali
		// service account token and not the user's token. This is because Kiali does filtering based
		// on the user's token and prevents people who shouldn't have access to particular metrics.
		token, err := kubernetes.GetKialiToken()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
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

	transportConfig, err := httputil.CreateTransport(&auth, roundTripper, httputil.DefaultTimeout)
	if err != nil {
		return nil, err
	}
	clientConfig.RoundTripper = transportConfig

	p8s, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, err
	}
	client := Client{p8s: p8s, api: prom_v1.NewAPI(p8s), ctx: context.Background()}
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
func (in *Client) GetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.Tracef("GetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetAllRequestRates(namespace, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getAllRequestRates(in.ctx, in.api, namespace, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetAllRequestRates(namespace, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetNamespaceServicesRequestRates queries Prometheus to fetch request counter rates, over a time interval, limited to
// requests for services in the namespace. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (rates, error)
func (in *Client) GetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.Tracef("GetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetNamespaceServicesRequestRates(namespace, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getNamespaceServicesRequestRates(in.ctx, in.api, namespace, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetNamespaceServicesRequestRates(namespace, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetServiceRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given service (hence only inbound). Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, error)
func (in *Client) GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.Tracef("GetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, result := promCache.GetServiceRequestRates(namespace, service, ratesInterval, queryTime); isCached {
			return result, nil
		}
	}
	result, err := getServiceRequestRates(in.ctx, in.api, namespace, service, queryTime, ratesInterval)
	if err != nil {
		return result, err
	}
	if promCache != nil {
		promCache.SetServiceRequestRates(namespace, service, ratesInterval, queryTime, result)
	}
	return result, nil
}

// GetAppRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given app, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.Tracef("GetAppRequestRates [namespace: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, app, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, inResult, outResult := promCache.GetAppRequestRates(namespace, app, ratesInterval, queryTime); isCached {
			return inResult, outResult, nil
		}
	}
	inResult, outResult, err := getItemRequestRates(in.ctx, in.api, namespace, app, "app", queryTime, ratesInterval)
	if err != nil {
		return inResult, outResult, err
	}
	if promCache != nil {
		promCache.SetAppRequestRates(namespace, app, ratesInterval, queryTime, inResult, outResult)
	}
	return inResult, outResult, nil
}

// GetWorkloadRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given workload, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.Tracef("GetWorkloadRequestRates [namespace: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, workload, ratesInterval, queryTime.String())
	if promCache != nil {
		if isCached, inResult, outResult := promCache.GetWorkloadRequestRates(namespace, workload, ratesInterval, queryTime); isCached {
			return inResult, outResult, nil
		}
	}
	inResult, outResult, err := getItemRequestRates(in.ctx, in.api, namespace, workload, "workload", queryTime, ratesInterval)
	if err != nil {
		return inResult, outResult, err
	}
	if promCache != nil {
		promCache.SetWorkloadRequestRates(namespace, workload, ratesInterval, queryTime, inResult, outResult)
	}
	return inResult, outResult, nil
}

// FetchRange fetches a simple metric (gauge or counter) in given range
func (in *Client) FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	query := fmt.Sprintf("%s(%s%s)", aggregator, metricName, labels)
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	query = roundSignificant(query, 0.001)
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

func (in *Client) GetContext() context.Context {
	return in.ctx
}

func (in *Client) GetFlags() (prom_v1.FlagsResult, error) {
	flags, err := in.API().Flags(in.ctx)
	if err != nil {
		return nil, err
	}
	return flags, nil
}

// GetMetricsForLabels returns a list of metrics existing for the provided labels set
func (in *Client) GetMetricsForLabels(labels []string) ([]string, error) {
	// Arbitrarily set time range. Meaning that discovery works with metrics produced within last hour
	end := time.Now()
	start := end.Add(-time.Hour)
	log.Tracef("[Prom] GetMetricsForLabels: %v", labels)
	results, warnings, err := in.api.Series(in.ctx, labels, start, end)
	if warnings != nil && len(warnings) > 0 {
		log.Warningf("GetMetricsForLabels. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return nil, err
	}
	var names []string
	for _, labelSet := range results {
		if name, ok := labelSet["__name__"]; ok {
			names = append(names, string(name))
		}
	}
	return names, nil
}

// SanitizeLabelName replaces anything that doesn't match invalidLabelCharRE with an underscore.
// Copied from https://github.com/prometheus/prometheus/blob/df80dc4d3970121f2f76cba79050983ffb3cdbb0/util/strutil/strconv.go
func SanitizeLabelName(name string) string {
	return invalidLabelCharRE.ReplaceAllString(name, "_")
}
