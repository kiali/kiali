package handlers

import (
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
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// TestServiceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceMetricsDefault(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("direction", "inbound")
	req.URL.RawQuery = q.Encode()
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "destination_service_name=\"svc\"")
		assert.Contains(t, query, "destination_service_namespace=\"ns\"")
		assert.Contains(t, query, "[1m]")
		assert.NotContains(t, query, "histogram_quantile")
		atomic.AddUint32(&gaugeSentinel, 1)
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
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
	assert.NotZero(t, gaugeSentinel)
}

func TestServiceMetricsWithParams(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("direction", "inbound")
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
		assert.Contains(t, query, "destination_service_name=\"svc\"")
		assert.Contains(t, query, "destination_service_namespace=\"ns\"")
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

func TestServiceMetricsBadQueryTime(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
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

func TestServiceMetricsBadDuration(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
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

func TestServiceMetricsCantParseQuantiles(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("step", "99")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "abc")
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
	assert.Contains(t, string(actual), "cannot parse query parameter 'quantiles'")
}

func TestServiceMetricsBadQuantiles(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("step", "99")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "1.5")
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
	assert.Contains(t, string(actual), "invalid quantile(s)")
}

func TestServiceMetricsBadStep(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
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

func TestServiceMetricsBadRateFunc(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
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

func TestServiceMetricsInaccessibleNamespace(t *testing.T) {
	k := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}})
	k.OpenShift = true
	ts, _ := setupServiceMetricsEndpointWithClient(t, &noPrivClient{UserClientInterface: k})

	url := ts.URL + "/api/namespaces/my_namespace/services/svc/metrics"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func setupServiceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	k := kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		kubetest.FakeNamespace("my_namespace"),
		kubetest.FakeNamespace("ns"))
	k.OpenShift = true

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	handler := WithFakeAuthInfo(conf, ServiceMetrics(conf, cache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}

func setupServiceMetricsEndpointWithClient(t *testing.T, client kubernetes.ClientInterface) (*httptest.Server, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()

	cf := kubetest.NewFakeClientFactoryWithClient(conf, client.(kubernetes.UserClientInterface))
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)

	handler := WithFakeAuthInfo(conf, ServiceMetrics(conf, cache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/metrics", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	return ts, xapi
}
