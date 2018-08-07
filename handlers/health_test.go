package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
)

// TestNamespaceAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestNamespaceAppHealth(t *testing.T) {
	ts, k8s, prom := setupNamespaceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/health"

	k8s.On("GetNamespaceAppsDetails", mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
	}).Return(k8s.FakeNamespaceApps(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Contains(t, []string{"reviews", "httpbin"}, args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	prom.On("GetAllRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetNamespaceAppsDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 2)
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 1)
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

// TestAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestAppHealth(t *testing.T) {
	ts, k8s, prom := setupAppHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/apps/reviews/health"

	k8s.On("GetAppDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "reviews", args[1])
	}).Return(k8s.FakeAppDetails(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "reviews", args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	prom.On("GetAppRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(model.Vector{}, model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetAppDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
}

func setupAppHealthEndpoint(t *testing.T) (*httptest.Server, *kubetest.K8SClientMock, *prometheustest.PromClientMock) {
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}/health", AppHealth)

	ts := httptest.NewServer(mr)
	return ts, k8s, prom
}

// TestServiceHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestServiceHealth(t *testing.T) {
	ts, k8s, prom := setupServiceHealthEndpoint(t)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/ns/services/svc/health"

	k8s.On("GetServiceDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return(k8s.FakeServiceDetails(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal(t, "ns", args[0])
		assert.Equal(t, "svc", args[1])
	}).Return(prometheus.EnvoyServiceHealth{}, nil)

	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	k8s.AssertNumberOfCalls(t, "GetServiceDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
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
