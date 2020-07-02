package handlers

import (
	"context"
	"errors"
	"io/ioutil"
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

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
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

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
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

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
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

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
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
	ts, api, _ := setupAggregateMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'direction' must be 'inbound'")
}

func TestAggregateMetricsWithParams(t *testing.T) {
	ts, api, _ := setupAggregateMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestAggregateMetricsInaccessibleNamespace(t *testing.T) {
	ts, _, k8s := setupAggregateMetricsEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/my_namespace/aggregates/my_aggregate/my_aggregate_value/metrics"

	var nsNil *osproject_v1.Project
	k8s.On("GetProject", "my_namespace").Return(nsNil, errors.New("no privileges"))

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	k8s.AssertCalled(t, "GetProject", "my_namespace")
}

func TestAggregateMetricsBadDirection(t *testing.T) {
	ts, _, _ := setupAggregateMetricsEndpoint(t)
	defer ts.Close()

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

	actual, _ := ioutil.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'direction' must be 'inbound'")
}

func TestAggregateMetricsBadReporter(t *testing.T) {
	ts, _, _ := setupAggregateMetricsEndpoint(t)
	defer ts.Close()

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

	actual, _ := ioutil.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "'reporter' must be 'destination'")
}

func setupAggregateMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock, *kubetest.K8SClientMock) {
	config.Set(config.NewConfig())
	api := new(prometheustest.PromAPIMock)
	k8s := kubetest.NewK8SClientMock()
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(api)
	k8s.On("GetProject", "ns").Return(&osproject_v1.Project{}, nil)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			getAggregateMetrics(w, r.WithContext(context), func() (*prometheus.Client, error) {
				return prom, nil
			})
		}))

	ts := httptest.NewServer(mr)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, prom)

	return ts, api, k8s
}
