package handlers

import (
	"io/ioutil"
	"k8s.io/api/apps/v1beta2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	osappsv1 "github.com/openshift/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	corev1 "k8s.io/api/core/v1"
)

func TestAppMetricsDefault(t *testing.T) {
	ts, api, k8s := setupAppMetricsEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/apps/my_app/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	mockGetNamespace(k8s, "ns", time.Time{})

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, v1.Range{}, args[2])
		r := args[2].(v1.Range)
		assert.Contains(t, query, "_app=\"my_app\"")
		assert.Contains(t, query, "_namespace=\"ns\"")
		assert.Contains(t, query, "[1m]")
		assert.NotContains(t, query, "histogram_quantile")
		assert.Contains(t, query, " by (reporter)")
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

func TestAppMetricsWithParams(t *testing.T) {
	ts, api, k8s := setupAppMetricsEndpoint(t)
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/apps/my-app/metrics", nil)
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
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "0.95")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	mockGetNamespace(k8s, "ns", time.Time{})

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, v1.Range{}, args[2])
		r := args[2].(v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,reporter,response_code)")
			assert.Contains(t, query, "istio_request_bytes")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.Contains(t, query, " by (reporter,response_code)")
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

func setupAppMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock, *kubetest.K8SClientMock) {
	config.Set(config.NewConfig())
	api := new(prometheustest.PromAPIMock)
	k8s := new(kubetest.K8SClientMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(api)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			getAppMetrics(w, r, func() (*prometheus.Client, error) {
				return prom, nil
			}, func() (kubernetes.IstioClientInterface, error) {
				return k8s, nil
			})
		}))

	ts := httptest.NewServer(mr)
	business.SetWithBackends(nil, prom)
	return ts, api, k8s
}

func setupAppListEndpoint() (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	config.Set(config.NewConfig())
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/apps", AppList)
	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}", AppDetails)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

func TestAppsEndpoint(t *testing.T) {
	ts, k8s, _ := setupAppListEndpoint()
	defer ts.Close()

	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(business.FakeDeployments(), nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]corev1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]corev1.Pod{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return([]corev1.Service{}, nil)

	url := ts.URL + "/api/namespaces/ns/apps"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
	k8s.AssertNumberOfCalls(t, "GetPods", 1)
}

func TestAppDetailsEndpoint(t *testing.T) {
	ts, k8s, _ := setupAppListEndpoint()
	defer ts.Close()

	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(business.FakeDeployments(), nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]corev1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]corev1.Pod{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return(business.FakeServices(), nil)

	url := ts.URL + "/api/namespaces/ns/apps/httpbin"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
	k8s.AssertNumberOfCalls(t, "GetPods", 1)
	k8s.AssertNumberOfCalls(t, "GetServices", 1)
}

func mockGetNamespace(k8s *kubetest.K8SClientMock, name string, creationTime time.Time) {
	nsBookinfo := corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			CreationTimestamp: metav1.Time{Time: creationTime},
		},
	}
	k8s.On("GetNamespace", name).Return(&nsBookinfo, nil)
}
