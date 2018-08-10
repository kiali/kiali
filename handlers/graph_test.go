package handlers

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
)

// Setup mock

func setupMocked() (*prometheus.Client, *prometheustest.PromAPIMock, error) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	business.SetWithBackends(k8s, nil)

	k8s.On("GetNamespaces").Return(
		&v1.NamespaceList{
			Items: []v1.Namespace{
				v1.Namespace{
					ObjectMeta: metav1.ObjectMeta{
						Name: "bookinfo",
					},
				},
			},
		}, nil)

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		return nil, nil, err
	}
	client.Inject(api)

	return client, api, nil
}

func mockQuery(api *prometheustest.PromAPIMock, query string, ret *model.Vector) {
	api.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
	api.On(
		"Query",
		mock.AnythingOfType("*context.cancelCtx"),
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
}

func TestNamespaceGraph(t *testing.T) {
	q0 := "round(sum(rate(istio_requests_total{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	q0m0 := model.Metric{
		"source_workload_namespace":     "unknown",
		"source_workload":               "unknown",
		"source_app":                    "unknown",
		"source_version":                "unknown",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "productpage",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1",
		"response_code":                 "200"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50}}

	q1 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace!=\"bookinfo\",destination_service_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	q1m0 := model.Metric{
		"source_workload_namespace":     "istio-system",
		"source_workload":               "ingressgateway-unknown",
		"source_app":                    "ingressgateway",
		"source_version":                "unknown",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "productpage",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1",
		"response_code":                 "200"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  100}}

	q2 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	q2m0 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "reviews",
		"destination_workload":          "reviews-v1",
		"destination_app":               "reviews",
		"destination_version":           "v1",
		"response_code":                 "200"}
	q2m1 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "reviews",
		"destination_workload":          "reviews-v2",
		"destination_app":               "reviews",
		"destination_version":           "v2",
		"response_code":                 "200"}
	q2m2 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "reviews",
		"destination_workload":          "reviews-v3",
		"destination_app":               "reviews",
		"destination_version":           "v3",
		"response_code":                 "200"}
	q2m3 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "details",
		"destination_workload":          "details-v1",
		"destination_app":               "details",
		"destination_version":           "v1",
		"response_code":                 "300"}
	q2m4 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "details",
		"destination_workload":          "details-v1",
		"destination_app":               "details",
		"destination_version":           "v1",
		"response_code":                 "400"}
	q2m5 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "details",
		"destination_workload":          "details-v1",
		"destination_app":               "details",
		"destination_version":           "v1",
		"response_code":                 "500"}
	q2m6 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "details",
		"destination_workload":          "details-v1",
		"destination_app":               "details",
		"destination_version":           "v1",
		"response_code":                 "200"}
	q2m7 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "productpage",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1",
		"response_code":                 "200"}
	q2m8 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v2",
		"source_app":                    "reviews",
		"source_version":                "v2",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "ratings",
		"destination_workload":          "ratings-v1",
		"destination_app":               "ratings",
		"destination_version":           "v1",
		"response_code":                 "200"}
	q2m9 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v2",
		"source_app":                    "reviews",
		"source_version":                "v2",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "reviews",
		"destination_workload":          "reviews-v2",
		"destination_app":               "reviews",
		"destination_version":           "v2",
		"response_code":                 "200"}
	q2m10 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v3",
		"source_app":                    "reviews",
		"source_version":                "v3",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "ratings",
		"destination_workload":          "ratings-v1",
		"destination_app":               "ratings",
		"destination_version":           "v1",
		"response_code":                 "200"}
	q2m11 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v3",
		"source_app":                    "reviews",
		"source_version":                "v3",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "reviews",
		"destination_workload":          "reviews-v3",
		"destination_app":               "reviews",
		"destination_version":           "v3",
		"response_code":                 "200"}
	q2m12 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v3",
		"source_app":                    "reviews",
		"source_version":                "v3",
		"destination_service_namespace": "bankapp",
		"destination_service_name":      "pricing",
		"destination_workload":          "pricing-v1",
		"destination_app":               "pricing",
		"destination_version":           "v1",
		"response_code":                 "200"}

	v2 := model.Vector{
		&model.Sample{
			Metric: q2m0,
			Value:  20},
		&model.Sample{
			Metric: q2m1,
			Value:  20},
		&model.Sample{
			Metric: q2m2,
			Value:  20},
		&model.Sample{
			Metric: q2m3,
			Value:  20},
		&model.Sample{
			Metric: q2m4,
			Value:  20},
		&model.Sample{
			Metric: q2m5,
			Value:  20},
		&model.Sample{
			Metric: q2m6,
			Value:  20},
		&model.Sample{
			Metric: q2m7,
			Value:  20},
		&model.Sample{
			Metric: q2m8,
			Value:  20},
		&model.Sample{
			Metric: q2m9,
			Value:  20},
		&model.Sample{
			Metric: q2m10,
			Value:  20},
		&model.Sample{
			Metric: q2m11,
			Value:  20},
		&model.Sample{
			Metric: q2m12,
			Value:  20}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			fut(w, r, client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespace
	url := ts.URL + "/api/namespaces/bookinfo/graph?appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_namespace_graph.expected")
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestMultiNamespaceGraph(t *testing.T) {
	q0 := "round(sum(rate(istio_requests_total{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	q0m0 := model.Metric{
		"source_workload_namespace":     "unknown",
		"source_workload":               "unknown",
		"source_app":                    "unknown",
		"source_version":                "unknown",
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "productpage",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1",
		"response_code":                 "200"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50}}

	q1 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace!=\"bookinfo\",destination_service_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	v1 := model.Vector{}

	q2 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	v2 := model.Vector{}

	q3 := "round(sum(rate(istio_requests_total{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"tutorial\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	q3m0 := model.Metric{
		"source_workload_namespace":     "unknown",
		"source_workload":               "unknown",
		"source_app":                    "unknown",
		"source_version":                "unknown",
		"destination_service_namespace": "tutorial",
		"destination_service_name":      "customer",
		"destination_workload":          "customer-v1",
		"destination_app":               "customer",
		"destination_version":           "v1",
		"response_code":                 "200"}
	v3 := model.Vector{
		&model.Sample{
			Metric: q3m0,
			Value:  50}}

	q4 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace!=\"tutorial\",destination_service_namespace=\"tutorial\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	v4 := model.Vector{}

	q5 := "round(sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"tutorial\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,response_code),0.001)"
	v5 := model.Vector{}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)
	mockQuery(api, q4, &v4)
	mockQuery(api, q5, &v5)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			fut(w, r, client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespace
	url := ts.URL + "/api/namespaces/bookinfo/graph?appenders&queryTime=1523364075&namespaces=bookinfo,tutorial"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_multi_namespace_graph.expected")
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

// The service graph is obsolete as no longer represent services in the graph.  It will probably
// be replaced with a drill down graph for a workload... TODO: Test for the future endpoint
