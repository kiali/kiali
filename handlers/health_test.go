package handlers

import (
	"context"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

// TestNamespaceAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceAppHealth(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)
	ts, k8s, prom := setupNamespaceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/health"

	k8s.MockServices("ns", []string{"reviews", "httpbin"})
	k8s.On("GetPods", "ns", mock.AnythingOfType("string")).Return(kubetest.FakePodList(), nil)
	k8s.MockEmptyWorkloads("ns")

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAllRequestRates", "ns", "17s", util.Clock.Now()).Return(model.Vector{}, nil)

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
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 1)
}

func setupNamespaceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, prom)

	setupMockData(k8s)

	mr := mux.NewRouter()

	mr.HandleFunc("/api/namespaces/{namespace}/health", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: "test"})
			NamespaceHealth(w, r.WithContext(context))
		}))

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

// TestAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestAppHealth(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)
	ts, k8s, prom := setupAppHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/apps/reviews/health"

	k8s.On("GetPods", "ns", "app=reviews").Return(kubetest.FakePodList(), nil)
	k8s.MockEmptyWorkloads("ns")

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAppRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), "17s", util.Clock.Now()).Return(model.Vector{}, model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetPods", 1)
	k8s.AssertNumberOfCalls(t, "GetDeployments", 1)
	k8s.AssertNumberOfCalls(t, "GetReplicaSets", 1)
	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
}

func setupAppHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, prom)

	setupMockData(k8s)

	mr := mux.NewRouter()

	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}/health", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: "test"})
			AppHealth(w, r.WithContext(context))
		}))

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

// TestServiceHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceHealth(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	ts, _, prom := setupServiceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/services/svc/health"

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), "17s", util.Clock.Now()).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
}

func setupServiceHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := kubetest.NewK8SClientMock()
	prom := new(prometheustest.PromClientMock)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, prom)

	setupMockData(k8s)
	k8s.On("GetService", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Service{}, nil)
	mr := mux.NewRouter()

	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/health", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: "test"})
			ServiceHealth(w, r.WithContext(context))
		}))

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

func setupMockData(k8s *kubetest.K8SClientMock) {
	clockTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	k8s.On("GetProject", "ns").Return(
		&osproject_v1.Project{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ns",
				CreationTimestamp: meta_v1.NewTime(clockTime.Add(-17 * time.Second)),
			},
		}, nil)
}
