package handlers

import (
	"github.com/kiali/kiali/config"
	"io/ioutil"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
	osappsv1 "github.com/openshift/api/apps/v1"
	osv1 "github.com/openshift/api/project/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
)

// TestNamespaceAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceAppHealth(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	ts, k8s, prom := setupNamespaceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/health"

	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return(kubetest.FakeServiceList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1.Pod{}, nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta1.Deployment{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]batch_v1beta1.CronJob{}, nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Contains(t, []string{"reviews", "httpbin"}, args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAllRequestRates", mock.AnythingOfType("string"), "17s", util.Clock.Now()).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetServices", 1)
	k8s.AssertNumberOfCalls(t, "GetPods", 1)
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
	k8s.AssertNumberOfCalls(t, "GetReplicaSets", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 2)
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 1)
}

func setupNamespaceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)
	setupMockData(k8s)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/health", NamespaceHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

// TestAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestAppHealth(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	ts, k8s, prom := setupAppHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/apps/reviews/health"

	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, map[string]string{"app": "reviews"}, args[1])
	}).Return([]v1.Service{kubetest.FakeServiceList()[0]}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "app=reviews", args[1])
	}).Return([]v1.Pod{}, nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta1.Deployment{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return([]batch_v1beta1.CronJob{}, nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "reviews", args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAppRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), "17s", util.Clock.Now()).Return(model.Vector{}, model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetServices", 1)
	k8s.AssertNumberOfCalls(t, "GetPods", 1)
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
	k8s.AssertNumberOfCalls(t, "GetReplicaSets", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
}

func setupAppHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)
	setupMockData(k8s)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}/health", AppHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

// TestServiceHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceHealth(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	ts, k8s, prom := setupServiceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/services/svc/health"

	k8s.On("GetService", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return(kubetest.FakeService(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), "17s", util.Clock.Now()).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetService", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
}

func setupServiceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)
	setupMockData(k8s)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/health", ServiceHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

func setupMockData(k8s *kubetest.K8SClientMock) {
	clockTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{clockTime}

	k8s.On("GetProject", "ns").Return(
		&osv1.Project{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "ns",
				CreationTimestamp: metav1.NewTime(clockTime.Add(-17 * time.Second)),
			},
		}, nil)
}
