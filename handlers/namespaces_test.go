package handlers

import (
	"context"
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
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

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
	ts, _ := setupNamespaceMetricsEndpoint(t)
	k8s := kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "my_namespace"}})
	business.SetupBusinessLayer(t, &noPrivClient{k8s}, *config.NewConfig())

	url := ts.URL + "/api/namespaces/my_namespace/metrics"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestNamespaceInfo(t *testing.T) {
	setupMocked(t)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/info", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), &api.AuthInfo{Token: "test"})
			NamespaceInfo(w, r.WithContext(context))
		}))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/info", nil)
	if err != nil {
		t.Fatal(err)
	}

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
}

type notRemote struct{}

func (n *notRemote) IsRemoteCluster(context.Context, string) bool { return false }

func setupNamespaceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	client, xapi := setupMocked(t)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/metrics", WithAuthInfo(
		&api.AuthInfo{Token: "test"},
		NamespaceMetrics(func() (*prometheus.Client, error) { return client, nil }, &notRemote{}),
	))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, xapi
}

// Setup mock

func setupMocked(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock) {
	t.Helper()

	conf := config.NewConfig()
	config.Set(conf)

	k := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
	)
	k.OpenShift = true

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
		return nil, nil
	}
	client.Inject(api)

	business.SetupBusinessLayer(t, k, *conf)

	return client, api
}
