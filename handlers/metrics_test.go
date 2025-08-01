package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestExtractMetricsQueryParams(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "irate")
	q.Add("step", "10")
	q.Add("queryTime", "1523364061") // 2018-04-10T12:41:01
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:21
	q.Add("byLabels[]", "response_code")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	q.Add("reporter", "destination")
	q.Add("direction", "outbound")
	q.Add("requestProtocol", "http")
	req.URL.RawQuery = q.Encode()

	mq := models.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Time{}))
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, "5h", mq.RateInterval)
	assert.Equal(t, "irate", mq.RateFunc)
	assert.Equal(t, 10*time.Second, mq.Step)
	assert.Equal(t, []string{"response_code"}, mq.ByLabels)
	assert.Equal(t, []string{"request_count", "request_size"}, mq.Filters)
	assert.Equal(t, "destination", mq.Reporter)
	assert.Equal(t, "outbound", mq.Direction)
	assert.Equal(t, "http", mq.RequestProtocol)

	// Check that start date is normalized for step
	// Interval [12:24:21, 12:41:01] should be converted to [12:24:20, 12:41:01]
	assert.Equal(t, time.Unix(1523363060, 0), mq.Start)
	assert.Equal(t, 20, mq.Start.Second())
	assert.Equal(t, time.Unix(1523364061, 0), mq.End)
	assert.Equal(t, 1, mq.End.Second())
}

func TestExtractMetricsQueryParamsStepLimitCase(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("step", "10")
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	req.URL.RawQuery = q.Encode()

	mq := models.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Time{}))
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, time.Unix(1523363060, 0), mq.Start)
	assert.Equal(t, 20, mq.Start.Second())
	assert.Equal(t, time.Unix(1523364060, 0), mq.End)
	assert.Equal(t, 0, mq.End.Second())
}

func TestExtractMetricsQueryIntervalBoundary(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	q.Add("rateInterval", "35m")
	req.URL.RawQuery = q.Encode()

	mq := models.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Date(2018, 4, 10, 12, 10, 0, 0, time.UTC)))
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, "1860s", mq.RateInterval)
}

func TestExtractMetricsQueryStartTimeBoundary(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	q.Add("rateInterval", "1m")
	req.URL.RawQuery = q.Encode()

	mq := models.IstioMetricsQuery{Namespace: "ns"}
	namespaceTimestamp := time.Date(2018, 4, 10, 12, 30, 0, 0, time.UTC)

	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", namespaceTimestamp))
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, namespaceTimestamp.Add(1*time.Minute).UTC(), mq.Start.UTC())
}

func buildNamespace(name string, creationTime time.Time) *models.Namespace {
	return &models.Namespace{
		Name:              name,
		CreationTimestamp: creationTime,
	}
}

func TestAggregateMetricsDefault(t *testing.T) {
	ts, api := setupAggregateMetricsEndpoint(t)

	url := ts.URL + "/api/namespaces/ns/aggregates/my_aggregate/my_aggregate_value/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "_aggregate=\"my_aggregate\"")
		assert.Contains(t, query, "_aggregateValue=\"my_aggregate_value\"")
		assert.Contains(t, query, "_namespace=\"ns\"")
		assert.Contains(t, query, "outbound")
		assert.Contains(t, query, "destination")
		assert.NotContains(t, query, "histogram_quantile")
		atomic.AddUint32(&gaugeSentinel, 1)
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
	})

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	// default has direction=outbound
	actual, _ := io.ReadAll(resp.Body)
	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'direction' must be 'inbound'")
}

func TestAggregateMetricsWithParams(t *testing.T) {
	ts, api := setupAggregateMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/aggregates/my_aggregate/my_aggregate_value/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "rate")
	q.Add("step", "2")
	q.Add("queryTime", "1523364075")
	q.Add("duration", "1000")
	q.Add("byLabels[]", "response_code")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "0.95")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	q.Add("direction", "inbound")
	q.Add("reporter", "destination")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,response_code)")
			assert.Contains(t, query, "istio_request_bytes")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.Contains(t, query, " by (response_code)")
			atomic.AddUint32(&gaugeSentinel, 1)
		}
		assert.Equal(t, 2*time.Second, r.Step)
		assert.WithinDuration(t, queryTime, r.End, delta)
		assert.WithinDuration(t, queryTime.Add(-1000*time.Second), r.Start, delta)
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestAggregateMetricsInaccessibleNamespace(t *testing.T) {
	k := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}})
	k.OpenShift = true

	ts, _ := setupAggregateMetricsEndpointWithClient(t, &noPrivClient{k})

	url := ts.URL + "/api/namespaces/my_namespace/aggregates/my_aggregate/my_aggregate_value/metrics"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assertExpectedStatusCode(t, http.StatusForbidden, resp)
}

func assertExpectedStatusCode(t *testing.T, expectedStatusCode int, resp *http.Response) {
	t.Helper()
	if expectedStatusCode != resp.StatusCode {
		body, _ := io.ReadAll(resp.Body)
		defer resp.Body.Close()
		assert.Fail(t, fmt.Sprintf("Invalid http status code. Expected: %d\tGot: %d\tBody: %s", expectedStatusCode, resp.StatusCode, body))
	}
}

func TestAggregateMetricsBadDirection(t *testing.T) {
	ts, _ := setupAggregateMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/aggregates/my_aggregate/my_aggregate_value/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("direction", "outbound")
	req.URL.RawQuery = q.Encode()

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}

	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'direction' must be 'inbound'")
}

func TestAggregateMetricsBadReporter(t *testing.T) {
	ts, _ := setupAggregateMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/aggregates/my_aggregate/my_aggregate_value/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("direction", "inbound")
	q.Add("reporter", "source")
	req.URL.RawQuery = q.Encode()

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}

	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'reporter' must be 'destination'")
}

func setupAggregateMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	xapi := new(prometheustest.PromAPIMock)
	k := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}})
	k.OpenShift = true
	prom, err := prometheus.NewClient(*config.NewConfig(), k.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	handler := WithFakeAuthInfo(conf, AggregateMetrics(conf, cache, discovery, cf, prom))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}

func setupAggregateMetricsEndpointWithClient(t *testing.T, k kubernetes.ClientInterface) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*config.NewConfig(), k.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k.(kubernetes.UserClientInterface))
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	handler := WithFakeAuthInfo(conf, AggregateMetrics(conf, cache, discovery, cf, prom))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}

func TestPrepareStatsQueriesPartialError(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	xapi := new(prometheustest.PromAPIMock)
	baseClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("ns1"),
		kubetest.FakeNamespace("ns2"),
	)
	prom, err := prometheus.NewClient(*config.NewConfig(), baseClient.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	k := &nsForbidden{baseClient, "nsNil"}
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	req := httptest.NewRequest("GET", "/foo", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))
	userClients, err := getUserClients(req, cf)
	require.NoError(err)
	namespace := business.NewNamespaceService(cache, conf, discovery, cf.GetSAClients(), userClients)
	w := httptest.NewRecorder()
	queryTime := time.Date(2020, 10, 22, 0, 0, 0, 0, time.UTC).Unix()

	rawQ := []models.MetricsStatsQuery{
		{
			Target: models.Target{
				Namespace: "ns1",
				Name:      "foo",
				Kind:      "app",
			},
			Direction:    "inbound",
			RawInterval:  "3h",
			Avg:          true,
			Quantiles:    []string{"0.90", "0.5"},
			RawQueryTime: queryTime,
		},
		{
			Target: models.Target{
				Namespace: "ns1",
				Name:      "foo",
				Kind:      "app",
			},
			Direction:    "inbound",
			RawInterval:  "30m",
			Avg:          true,
			Quantiles:    []string{"0.90", "0.5"},
			RawQueryTime: queryTime,
		},
		{
			Target: models.Target{
				Namespace: "ns2",
				Name:      "bar",
				Kind:      "app",
			},
			Direction:    "outbound",
			RawInterval:  "30m",
			Avg:          true,
			Quantiles:    []string{"0.90", "0.5"},
			RawQueryTime: queryTime,
		},
		{
			Target: models.Target{
				Namespace: "nsNil",
				Name:      "baz",
				Kind:      "app",
			},
			Direction:    "inbound",
			RawInterval:  "30m",
			Avg:          true,
			Quantiles:    []string{"0.90", "0.5"},
			RawQueryTime: queryTime,
		},
	}

	queries, errs := prepareStatsQueries(req.Context(), &namespace, rawQ)

	assert.NotNil(errs)
	errsStr := errs.Strings()
	require.Len(errsStr, 1)
	assert.Equal("namespace 'nsNil', cluster: '': no privileges", errsStr[0])
	require.Len(queries, 3)
	assert.Equal("ns1", queries[0].Target.Namespace)
	assert.Equal("3h", queries[0].Interval)
	assert.Equal("ns1", queries[1].Target.Namespace)
	assert.Equal("30m", queries[1].Interval)
	assert.Equal("ns2", queries[2].Target.Namespace)
	assert.Equal("30m", queries[2].Interval)
	assert.Equal(http.StatusOK, w.Code)
}

func TestPrepareStatsQueriesNoErrorIntervalAdjusted(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	queryTime := time.Date(2020, 10, 22, 0, 0, 0, 0, time.UTC)
	k := kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns3", CreationTimestamp: meta_v1.NewTime(queryTime.Add(-1 * time.Hour))}})
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	req := httptest.NewRequest("GET", "/foo", nil)
	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))
	userClients, err := getUserClients(req, cf)
	require.NoError(err)
	namespace := business.NewNamespaceService(cache, conf, discovery, cf.GetSAClients(), userClients)
	w := httptest.NewRecorder()

	rawQ := []models.MetricsStatsQuery{{
		Target: models.Target{
			Namespace: "ns3",
			Name:      "foo",
			Kind:      "app",
		},
		Direction:    "inbound",
		RawInterval:  "3h",
		Avg:          true,
		Quantiles:    []string{"0.90", "0.5"},
		RawQueryTime: queryTime.Unix(),
	}}

	queries, errs := prepareStatsQueries(req.Context(), &namespace, rawQ)

	assert.Nil(errs)
	assert.Len(queries, 1)
	assert.Equal("ns3", queries[0].Target.Namespace)
	assert.Equal("3600s", queries[0].Interval) // 3h adjusted to 1h (3600s) due to namespace creation date
	assert.Equal(http.StatusOK, w.Code)
}

func TestValidateBadRequest(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	queryTime := time.Date(2020, 10, 22, 0, 0, 0, 0, time.UTC)
	conf := config.NewConfig()
	k := kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns3", CreationTimestamp: meta_v1.NewTime(queryTime.Add(-1 * time.Hour))}})
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	req := httptest.NewRequest("GET", "/foo", nil)
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}))
	userClients, err := getUserClients(req, cf)
	require.NoError(err)
	namespace := business.NewNamespaceService(cache, conf, discovery, cf.GetSAClients(), userClients)

	rawQ := []models.MetricsStatsQuery{{
		Target: models.Target{
			Namespace: "ns1",
			Name:      "foo",
			Kind:      "x",
		},
		Direction:    "x",
		RawInterval:  "30m",
		Avg:          true,
		Quantiles:    []string{"0.90", "0.5"},
		RawQueryTime: queryTime.Unix(),
	}}

	_, errs := prepareStatsQueries(req.Context(), &namespace, rawQ)

	assert.NotNil(errs)
	assert.Contains(errs.Error(), "bad request")
	assert.Len(errs.Strings(), 2)
}

func TestWorkloadMetricsDefault(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	url := ts.URL + "/api/namespaces/ns/workloads/my_workload/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "_workload=\"my_workload\"")
		assert.Contains(t, query, "_namespace=\"ns\"")
		assert.Contains(t, query, "[1m]")
		assert.NotContains(t, query, "histogram_quantile")
		atomic.AddUint32(&gaugeSentinel, 1)
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
	})

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, gaugeSentinel)
}

func TestWorkloadMetricsWithParams(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/workloads/my-workload/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "rate")
	q.Add("step", "2")
	q.Add("queryTime", "1523364075")
	q.Add("duration", "1000")
	q.Add("byLabels[]", "response_code")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "0.95")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,response_code)")
			assert.Contains(t, query, "istio_request_bytes")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.Contains(t, query, " by (response_code)")
			atomic.AddUint32(&gaugeSentinel, 1)
		}
		assert.Equal(t, 2*time.Second, r.Step)
		assert.WithinDuration(t, queryTime, r.End, delta)
		assert.WithinDuration(t, queryTime.Add(-1000*time.Second), r.Start, delta)
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestWorkloadMetricsBadQueryTime(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/workloads/my-workload/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("step", "99")
	q.Add("queryTime", "abc")
	q.Add("duration", "1000")
	req.URL.RawQuery = q.Encode()

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		// Make sure there's no client call and we fail fast
		t.Error("Unexpected call to client while having bad request")
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "cannot parse query parameter 'queryTime'")
}

func TestWorkloadMetricsBadDuration(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/workloads/my-workload/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("step", "99")
	q.Add("duration", "abc")
	req.URL.RawQuery = q.Encode()

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		// Make sure there's no client call and we fail fast
		t.Error("Unexpected call to client while having bad request")
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "cannot parse query parameter 'duration'")
}

func TestWorkloadMetricsBadStep(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/workloads/my-workload/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("step", "abc")
	q.Add("duration", "1000")
	req.URL.RawQuery = q.Encode()

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		// Make sure there's no client call and we fail fast
		t.Error("Unexpected call to client while having bad request")
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "cannot parse query parameter 'step'")
}

func TestWorkloadMetricsBadRateFunc(t *testing.T) {
	ts, api := setupWorkloadMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/workloads/my-workload/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "invalid rate func")
	req.URL.RawQuery = q.Encode()

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		// Make sure there's no client call and we fail fast
		t.Error("Unexpected call to client while having bad request")
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "query parameter 'rateFunc' must be either 'rate' or 'irate'")
}

func TestWorkloadMetricsInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("ns"),
		kubetest.FakeNamespace("my_namespace"))
	ts, _ := setupWorkloadMetricsEndpointWithClient(t, &nsForbidden{k8s, "my_namespace"})

	url := ts.URL + "/api/namespaces/my_namespace/workloads/my_workload/metrics"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func setupWorkloadMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("ns"))

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*config.NewConfig(), k8s.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	handler := WithFakeAuthInfo(conf, WorkloadMetrics(conf, cache, discovery, cf, prom))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/workloads/{workload}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}

func setupWorkloadMetricsEndpointWithClient(t *testing.T, k8s kubernetes.ClientInterface) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s.(kubernetes.UserClientInterface))
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*config.NewConfig(), k8s.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	handler := WithFakeAuthInfo(conf, WorkloadMetrics(conf, cache, discovery, cf, prom))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/workloads/{workload}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}

// TestNamespaceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceMetricsDefault(t *testing.T) {
	ts, api := setupNamespaceMetricsEndpoint(t)

	url := ts.URL + "/api/namespaces/ns/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "_namespace=\"ns\"")
		assert.Contains(t, query, "[1m]")
		assert.NotContains(t, query, "histogram_quantile")
		atomic.AddUint32(&gaugeSentinel, 1)
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
	})

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, gaugeSentinel)
}

func TestNamespaceMetricsWithParams(t *testing.T) {
	ts, api := setupNamespaceMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "rate")
	q.Add("step", "2")
	q.Add("queryTime", "1523364075")
	q.Add("duration", "1000")
	q.Add("byLabels[]", "response_code")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "0.95")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,response_code)")
			assert.Contains(t, query, "istio_request_bytes")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.Contains(t, query, " by (response_code)")
			atomic.AddUint32(&gaugeSentinel, 1)
		}
		assert.Equal(t, 2*time.Second, r.Step)
		assert.WithinDuration(t, queryTime, r.End, delta)
		assert.WithinDuration(t, queryTime.Add(-1000*time.Second), r.Start, delta)
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestNamespaceMetricsInaccessibleNamespace(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("my_namespace"))
	ts, _ := setupNamespaceMetricsEndpointWithClient(t, &noPrivClient{k8s})

	url := ts.URL + "/api/namespaces/my_namespace/metrics"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func setupNamespaceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	client, xapi, k8s := setupMocked(t)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	handler := WithFakeAuthInfo(conf, NamespaceMetrics(conf, cache, discovery, cf, client))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, xapi
}

func setupNamespaceMetricsEndpointWithClient(t *testing.T, k kubernetes.ClientInterface) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*config.NewConfig(), k.GetToken())
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k.(kubernetes.UserClientInterface))
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	handler := WithFakeAuthInfo(conf, NamespaceMetrics(conf, cache, discovery, cf, prom))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, xapi
}

func setupMocked(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock, *kubetest.FakeK8sClient) {
	t.Helper()

	k := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("tutorial"),
		kubetest.FakeNamespace("ns"),
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
	)
	k.OpenShift = true

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient(*config.NewConfig(), k.GetToken())
	if err != nil {
		t.Fatal(err)
		return nil, nil, nil
	}
	client.Inject(api)

	return client, api, k
}
