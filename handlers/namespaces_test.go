package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	kube_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
)

// TestNamespaceMetricsDefault is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceMetricsDefault(t *testing.T) {
	ts, api := setupNamespaceMetricsEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, v1.Range{}, args[2])
		r := args[2].(v1.Range)
		assert.Contains(t, query, ".*\\\\.ns\\\\..*")
		assert.Contains(t, query, "[1m]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le)")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.NotContains(t, query, " by ")
			atomic.AddUint32(&gaugeSentinel, 1)
		}
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
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

func TestNamespaceMetricsWithParams(t *testing.T) {
	ts, api := setupNamespaceMetricsEndpoint(t)
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
	q.Add("byLabelsIn[]", "response_code")
	q.Add("byLabelsOut[]", "response_code")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

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

func setupNamespaceMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock) {
	client, api, err := setupMocked()
	if err != nil {
		t.Fatal(err)
	}

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			getNamespaceMetrics(w, r, func() (*prometheus.Client, error) {
				return client, nil
			})
		}))

	ts := httptest.NewServer(mr)
	return ts, api
}

// TestNamespaceHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceHealth(t *testing.T) {
	ts, k8s, prom := setupNamespaceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/health"

	k8s.On("GetFullServices", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return(fakeServiceList(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Contains(t, []string{"reviews", "httpbin"}, args[1])
	}).Return(prometheus.EnvoyHealth{}, nil)

	prom.On("GetNamespaceServicesRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(model.Vector{}, model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetFullServices", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 2)
}

func setupNamespaceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/health", NamespaceHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

func fakeServiceList() *kubernetes.ServiceList {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:45 +0300")

	return &kubernetes.ServiceList{
		Services: &kube_v1.ServiceList{
			Items: []kube_v1.Service{
				kube_v1.Service{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:      "reviews",
						Namespace: "tutorial",
						Labels: map[string]string{
							"app":     "reviews",
							"version": "v1"}},
					Spec: kube_v1.ServiceSpec{
						ClusterIP: "fromservice",
						Type:      "ClusterIP",
						Selector:  map[string]string{"app": "reviews"},
						Ports: []kube_v1.ServicePort{
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3001},
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3000}}}},
				kube_v1.Service{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:      "httpbin",
						Namespace: "tutorial",
						Labels: map[string]string{
							"app":     "httpbin",
							"version": "v1"}},
					Spec: kube_v1.ServiceSpec{
						ClusterIP: "fromservice",
						Type:      "ClusterIP",
						Selector:  map[string]string{"app": "httpbin"},
						Ports: []kube_v1.ServicePort{
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3001},
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3000}}}},
			}},
		Pods: &kube_v1.PodList{
			Items: []kube_v1.Pod{
				kube_v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "reviews-v1",
						Labels: map[string]string{"app": "reviews", "version": "v1"}}},
				kube_v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "reviews-v2",
						Labels: map[string]string{"app": "reviews", "version": "v2"}}},
				kube_v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "httpbin-v1",
						Labels: map[string]string{"app": "httpbin", "version": "v1"}}},
			}},
		Deployments: &v1beta1.DeploymentList{
			Items: []v1beta1.Deployment{
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v1",
						CreationTimestamp: meta_v1.NewTime(t1)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            3,
						AvailableReplicas:   2,
						UnavailableReplicas: 1},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v2",
						CreationTimestamp: meta_v1.NewTime(t1)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            2,
						AvailableReplicas:   1,
						UnavailableReplicas: 1},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "httpbin-v1",
						CreationTimestamp: meta_v1.NewTime(t2)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            1,
						AvailableReplicas:   1,
						UnavailableReplicas: 0},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "httpbin", "version": "v1"}}}},
			}}}
}
