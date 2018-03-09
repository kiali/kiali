package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/swift-sunshine/swscore/prometheus/prometheustest"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/mock"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/swift-sunshine/swscore/prometheus"
)

// TestServiceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceMetricsDefault(t *testing.T) {
	ts, api := setupServiceMetricsEndpoint(t)
	defer ts.Close()

	coveredPaths := 0
	url := ts.URL + "/api/namespaces/ns/services/svc/metrics"
	now := time.Now()
	delta := 2 * time.Second

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		switch r := args[2].(type) {
		case time.Time:
			// Health = envoy metrics
			assert.Contains(t, args[1], "svc_ns_svc_cluster_local")
			assert.WithinDuration(t, now, r, delta)
			coveredPaths |= 2
		case v1.Range:
			// Other metrics = Istio metrics
			assert.Contains(t, args[1], "svc.ns.svc.cluster.local")
			assert.Contains(t, args[1], "["+metricsDefaultRateInterval+"]")
			assert.Equal(t, metricsDefaultStepSec*time.Second, r.Step)
			assert.WithinDuration(t, now, r.End, delta)
			assert.WithinDuration(t, now.Add(-metricsDefaultDurationMin*time.Minute), r.Start, delta)
			coveredPaths |= 1
		}
	})

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	assert.Equal(t, 3, coveredPaths)
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
	q.Add("step", "99")
	q.Add("duration", "1000")
	req.URL.RawQuery = q.Encode()

	coveredPaths := 0
	now := time.Now()
	delta := 2 * time.Second

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		switch r := args[2].(type) {
		case time.Time:
			// Health = envoy metrics
			assert.WithinDuration(t, now, r, delta)
			coveredPaths |= 2
		case v1.Range:
			// Other metrics = Istio metrics
			assert.Contains(t, args[1], "[5h]")
			assert.Equal(t, 99*time.Second, r.Step)
			assert.WithinDuration(t, now, r.End, delta)
			assert.WithinDuration(t, now.Add(-1000*time.Second), r.Start, delta)
			coveredPaths |= 1
		}
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	assert.Equal(t, 3, coveredPaths)
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
