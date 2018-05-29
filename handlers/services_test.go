package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
)

// TestServiceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceMetricsDefault(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/services/svc/metrics"
	now := time.Now()
	delta := 15 * time.Second
	coveredPath := 0
	path := make(chan int)

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, v1.Range{}, args[2])
		r := args[2].(v1.Range)
		assert.Contains(t, query, "svc.ns.svc.cluster.local")
		assert.Contains(t, query, "[1m]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le)")
			path <- 1
		} else {
			assert.NotContains(t, query, " by ")
			path <- 2
		}
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
	})

	// Update coveredPath through a channel to avoid data races.
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := range path {
			coveredPath |= i
		}
	}()

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	close(path)
	wg.Wait()
	assert.Equal(t, coveredPath, 3)
}

func TestServiceMetricsWithParams(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "rate")
	q.Add("step", "2")
	q.Add("queryTime", "1523364075")
	q.Add("duration", "1000")
	q.Add("byLabelsIn[]", "response_code")
	q.Add("byLabelsOut[]", "response_code")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	coveredPath := 0
	path := make(chan int)

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, v1.Range{}, args[2])
		r := args[2].(v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,response_code)")
			assert.Contains(t, query, "istio_request_size")
			path <- 1
		} else {
			assert.Contains(t, query, " by (response_code)")
			path <- 2
		}
		assert.Equal(t, 2*time.Second, r.Step)
		assert.WithinDuration(t, queryTime, r.End, delta)
		assert.WithinDuration(t, queryTime.Add(-1000*time.Second), r.Start, delta)
	})

	// Update coveredPath through a channel to avoid data races.
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := range path {
			coveredPath |= i
		}
	}()

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	close(path)
	wg.Wait()
	assert.Equal(t, coveredPath, 3)
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
	actual, _ := ioutil.ReadAll(resp.Body)

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "cannot parse query parameter 'duration'")
}

func TestServiceMetricsBadStep(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "cannot parse query parameter 'step'")
}

func TestServiceMetricsBadRateFunc(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.Equal(t, 400, resp.StatusCode)
	assert.Contains(t, string(actual), "query parameter 'rateFunc' must be either 'rate' or 'irate'")
}

func setupServiceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	client, api, err := setupMocked()
	if err != nil {
		t.Fatal(err)
	}

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			getServiceMetrics(w, r, func() (*prometheus.Client, error) {
				return client, nil
			})
		}))

	ts := httptest.NewServer(mr)
	return ts, api
}

// TestServiceHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceHealth(t *testing.T) {
	ts, k8s, prom := setupServiceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/services/svc/health"

	k8s.On("GetServiceDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return((*kubernetes.ServiceDetails)(nil), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return(1, 1, nil)

	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(model.Vector{}, model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetServiceDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
}

func setupServiceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/health", ServiceHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}
