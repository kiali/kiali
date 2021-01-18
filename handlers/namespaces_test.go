package handlers

import (
	"context"
	"errors"
	"fmt"
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
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// TestNamespaceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceMetricsDefault(t *testing.T) {
	ts, api, _ := setupNamespaceMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, gaugeSentinel)
}

func TestNamespaceMetricsWithParams(t *testing.T) {
	ts, api, _ := setupNamespaceMetricsEndpoint(t)
	defer ts.Close()

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
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestNamespaceMetricsInaccessibleNamespace(t *testing.T) {
	ts, _, k8s := setupNamespaceMetricsEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/my_namespace/metrics"

	var nsNil *osproject_v1.Project
	k8s.On("GetProject", "my_namespace").Return(nsNil, errors.New("no privileges"))

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	k8s.AssertCalled(t, "GetProject", "my_namespace")
}

func setupNamespaceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock, *kubetest.K8SClientMock) {
	client, xapi, k8s, err := setupMocked()
	if err != nil {
		t.Fatal(err)
	}
	k8s.On("GetProject", "ns").Return(&osproject_v1.Project{}, nil)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: "test"})
			getNamespaceMetrics(w, r.WithContext(context), func() (*prometheus.Client, error) {
				return client, nil
			})
		}))

	ts := httptest.NewServer(mr)
	return ts, xapi, k8s
}

// Setup mock

func setupMocked() (*prometheus.Client, *prometheustest.PromAPIMock, *kubetest.K8SClientMock, error) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)
	k8s := new(kubetest.K8SClientMock)

	k8s.On("GetNamespaces").Return(
		&core_v1.NamespaceList{
			Items: []core_v1.Namespace{
				{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "bookinfo",
					},
				},
				{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "tutorial",
					},
				},
			},
		}, nil)

	fmt.Println("!!! Set up standard mock")
	k8s.On("GetProjects").Return(
		[]osproject_v1.Project{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "bookinfo",
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "tutorial",
				},
			},
		}, nil)

	k8s.On("IsOpenShift").Return(true)

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		return nil, nil, nil, err
	}
	client.Inject(api)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)

	return client, api, k8s, nil
}
