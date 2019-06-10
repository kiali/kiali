package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// Setup mock

func setupMocked() (*prometheus.Client, *prometheustest.PromAPIMock, *kubetest.K8SClientMock, error) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)

	k8s.On("GetNamespaces").Return(
		&core_v1.NamespaceList{
			Items: []core_v1.Namespace{
				core_v1.Namespace{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "bookinfo",
					},
				},
				core_v1.Namespace{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "tutorial",
					},
				},
			},
		}, nil)

	k8s.On("GetProjects").Return(
		[]osproject_v1.Project{
			osproject_v1.Project{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "bookinfo",
				},
			},
			osproject_v1.Project{
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

// mockNamespaceGraph provides the same single-namespace mocks to be used for different graph types
func mockNamespaceGraph(t *testing.T) (*prometheus.Client, error) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q0m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q0m1 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "kiali-2412", // test case when there is no destination_service_name
		"destination_app":                "",
		"destination_version":            "",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50},
		&model.Sample{
			Metric: q0m1,
			Value:  50}}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace!="bookinfo",source_workload!="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  100}}

	q2 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q2m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v1",
		"destination_app":                "reviews",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m1 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v2",
		"destination_app":                "reviews",
		"destination_version":            "v2",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m2 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v3",
		"destination_app":                "reviews",
		"destination_version":            "v3",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m3 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "300",
		"response_flags":                 "-"}
	q2m4 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "400",
		"response_flags":                 "-"}
	q2m5 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q2m6 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m7 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m8 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v2",
		"source_app":                     "reviews",
		"source_version":                 "v2",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "ratings",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "ratings-v1",
		"destination_app":                "ratings",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m9 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v2",
		"source_app":                     "reviews",
		"source_version":                 "v2",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "ratings",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "ratings-v1",
		"destination_app":                "ratings",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q2m10 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v2",
		"source_app":                     "reviews",
		"source_version":                 "v2",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v2",
		"destination_app":                "reviews",
		"destination_version":            "v2",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m11 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v3",
		"source_app":                     "reviews",
		"source_version":                 "v3",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "ratings",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "ratings-v1",
		"destination_app":                "ratings",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m12 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v3",
		"source_app":                     "reviews",
		"source_version":                 "v3",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "ratings",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "ratings-v1",
		"destination_app":                "ratings",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q2m13 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v3",
		"source_app":                     "reviews",
		"source_version":                 "v3",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v3",
		"destination_app":                "reviews",
		"destination_version":            "v3",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m14 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v3",
		"source_app":                     "reviews",
		"source_version":                 "v3",
		"destination_service_namespace":  "bankapp",
		"destination_service_name":       "pricing",
		"destination_workload_namespace": "bankapp",
		"destination_workload":           "pricing-v1",
		"destination_app":                "pricing",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q2m15 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "reviews-v3",
		"source_app":                     "reviews",
		"source_version":                 "v3",
		"destination_service_namespace":  "unknown",
		"destination_service_name":       "unknown",
		"destination_workload_namespace": "unknown",
		"destination_workload":           "unknown",
		"destination_app":                "unknown",
		"destination_version":            "unknown",
		"request_protocol":               "http",
		"response_code":                  "404",
		"response_flags":                 "NR"}

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
			Value:  10},
		&model.Sample{
			Metric: q2m10,
			Value:  20},
		&model.Sample{
			Metric: q2m11,
			Value:  20},
		&model.Sample{
			Metric: q2m12,
			Value:  10},
		&model.Sample{
			Metric: q2m13,
			Value:  20},
		&model.Sample{
			Metric: q2m14,
			Value:  20},
		&model.Sample{
			Metric: q2m15,
			Value:  4}}

	q3 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="destination",source_workload="unknown",destination_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q3m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v3 := model.Vector{
		&model.Sample{
			Metric: q3m0,
			Value:  400}}

	q4 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace!="bookinfo",source_workload!="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q4m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v4 := model.Vector{
		&model.Sample{
			Metric: q4m0,
			Value:  150}}

	q5 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q5m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}

	v5 := model.Vector{
		&model.Sample{
			Metric: q5m0,
			Value:  31}}

	client, api, _, err := setupMocked()
	if err != nil {
		return client, err
	}

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)
	mockQuery(api, q4, &v4)
	mockQuery(api, q5, &v5)

	return client, nil
}

func TestAppGraph(t *testing.T) {
	client, err := mockNamespaceGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespaces
	url := ts.URL + "/api/namespaces/graph?namespaces=bookinfo&graphType=app&groupBy=app&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_app_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestVersionedAppGraph(t *testing.T) {
	client, err := mockNamespaceGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespaces
	url := ts.URL + "/api/namespaces/graph?namespaces=bookinfo&graphType=versionedApp&groupBy=app&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_versioned_app_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestServiceGraph(t *testing.T) {
	client, err := mockNamespaceGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespaces
	url := ts.URL + "/api/namespaces/graph?namespaces=bookinfo&graphType=service&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_service_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestWorkloadGraph(t *testing.T) {
	client, err := mockNamespaceGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespaces
	url := ts.URL + "/api/namespaces/graph?namespaces=bookinfo&graphType=workload&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_workload_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestAppNodeGraph(t *testing.T) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",destination_service_namespace="bookinfo",destination_app="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q0m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q0m1 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50},
		&model.Sample{
			Metric: q0m1,
			Value:  100}}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo",source_app="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v1",
		"destination_app":                "reviews",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m1 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v2",
		"destination_app":                "reviews",
		"destination_version":            "v2",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m2 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v3",
		"destination_app":                "reviews",
		"destination_version":            "v3",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m3 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "300",
		"response_flags":                 "-"}
	q1m4 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "400",
		"response_flags":                 "-"}
	q1m5 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q1m6 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m7 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m8 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "unknown",
		"destination_service_name":       "unknown",
		"destination_workload_namespace": "unknown",
		"destination_workload":           "unknown",
		"destination_app":                "unknown",
		"destination_version":            "unknown",
		"request_protocol":               "http",
		"response_code":                  "404",
		"response_flags":                 "NR"}

	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  20},
		&model.Sample{
			Metric: q1m1,
			Value:  20},
		&model.Sample{
			Metric: q1m2,
			Value:  20},
		&model.Sample{
			Metric: q1m3,
			Value:  20},
		&model.Sample{
			Metric: q1m4,
			Value:  20},
		&model.Sample{
			Metric: q1m5,
			Value:  20},
		&model.Sample{
			Metric: q1m6,
			Value:  20},
		&model.Sample{
			Metric: q1m7,
			Value:  20},
		&model.Sample{
			Metric: q1m8,
			Value:  4}}

	q2 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",destination_service_namespace="bookinfo",destination_app="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v2 := model.Vector{}

	q3 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="bookinfo",source_app="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q3m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v3 := model.Vector{
		&model.Sample{
			Metric: q3m0,
			Value:  31}}

	client, api, _, err := setupMocked()
	if err != nil {
		return
	}

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/applications/{app}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNode
	url := ts.URL + "/api/namespaces/bookinfo/applications/productpage/graph?graphType=versionedApp&groupBy=app&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_app_node_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestVersionedAppNodeGraph(t *testing.T) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",destination_service_namespace="bookinfo",destination_app="productpage",destination_version="v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q0m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q0m1 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50},
		&model.Sample{
			Metric: q0m1,
			Value:  100}}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo",source_app="productpage",source_version="v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v1",
		"destination_app":                "reviews",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m1 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v2",
		"destination_app":                "reviews",
		"destination_version":            "v2",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m2 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v3",
		"destination_app":                "reviews",
		"destination_version":            "v3",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m3 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "300",
		"response_flags":                 "-"}
	q1m4 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "400",
		"response_flags":                 "-"}
	q1m5 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q1m6 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m7 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m8 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "unknown",
		"destination_service_name":       "unknown",
		"destination_workload_namespace": "unknown",
		"destination_workload":           "unknown",
		"destination_app":                "unknown",
		"destination_version":            "unknown",
		"request_protocol":               "http",
		"response_code":                  "404",
		"response_flags":                 "NR"}

	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  20},
		&model.Sample{
			Metric: q1m1,
			Value:  20},
		&model.Sample{
			Metric: q1m2,
			Value:  20},
		&model.Sample{
			Metric: q1m3,
			Value:  20},
		&model.Sample{
			Metric: q1m4,
			Value:  20},
		&model.Sample{
			Metric: q1m5,
			Value:  20},
		&model.Sample{
			Metric: q1m6,
			Value:  20},
		&model.Sample{
			Metric: q1m7,
			Value:  20},
		&model.Sample{
			Metric: q1m8,
			Value:  4}}

	q2 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",destination_service_namespace="bookinfo",destination_app="productpage",destination_version="v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v2 := model.Vector{}

	q3 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="bookinfo",source_app="productpage",source_version="v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q3m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v3 := model.Vector{
		&model.Sample{
			Metric: q3m0,
			Value:  31}}

	client, api, _, err := setupMocked()
	if err != nil {
		return
	}

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/applications/{app}/versions/{version}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNode
	url := ts.URL + "/api/namespaces/bookinfo/applications/productpage/versions/v1/graph?graphType=versionedApp&groupBy=app&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_versioned_app_node_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestWorkloadNodeGraph(t *testing.T) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo",destination_workload="productpage-v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q0m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q0m1 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50},
		&model.Sample{
			Metric: q0m1,
			Value:  100}}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo",source_workload="productpage-v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v1",
		"destination_app":                "reviews",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m1 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v2",
		"destination_app":                "reviews",
		"destination_version":            "v2",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m2 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "reviews",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "reviews-v3",
		"destination_app":                "reviews",
		"destination_version":            "v3",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m3 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "300",
		"response_flags":                 "-"}
	q1m4 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "400",
		"response_flags":                 "-"}
	q1m5 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "500",
		"response_flags":                 "-"}
	q1m6 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "details",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "details-v1",
		"destination_app":                "details",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m7 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	q1m8 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "unknown",
		"destination_service_name":       "unknown",
		"destination_workload_namespace": "unknown",
		"destination_workload":           "unknown",
		"destination_app":                "unknown",
		"destination_version":            "unknown",
		"request_protocol":               "http",
		"response_code":                  "404",
		"response_flags":                 "NR"}

	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  20},
		&model.Sample{
			Metric: q1m1,
			Value:  20},
		&model.Sample{
			Metric: q1m2,
			Value:  20},
		&model.Sample{
			Metric: q1m3,
			Value:  20},
		&model.Sample{
			Metric: q1m4,
			Value:  20},
		&model.Sample{
			Metric: q1m5,
			Value:  20},
		&model.Sample{
			Metric: q1m6,
			Value:  20},
		&model.Sample{
			Metric: q1m7,
			Value:  20},
		&model.Sample{
			Metric: q1m8,
			Value:  4}}

	q2 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",destination_workload_namespace="bookinfo",destination_workload="productpage-v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v2 := model.Vector{}

	q3 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="bookinfo",source_workload="productpage-v1"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q3m0 := model.Metric{
		"source_workload_namespace":      "bookinfo",
		"source_workload":                "productpage-v1",
		"source_app":                     "productpage",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "tcp",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "tcp-v1",
		"destination_app":                "tcp",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v3 := model.Vector{
		&model.Sample{
			Metric: q3m0,
			Value:  31}}

	client, api, _, err := setupMocked()
	if err != nil {
		return
	}

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/workloads/{workload}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNode
	url := ts.URL + "/api/namespaces/bookinfo/workloads/productpage-v1/graph?graphType=workload&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_workload_node_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

func TestServiceNodeGraph(t *testing.T) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload="unknown",destination_service_namespace="bookinfo",destination_service_name="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	v0 := model.Vector{}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",destination_service_namespace="bookinfo",destination_service_name="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  100}}

	q2 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",destination_service_namespace="bookinfo",destination_service_name="productpage"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	q2m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"response_flags":                 "-"}
	v2 := model.Vector{
		&model.Sample{
			Metric: q2m0,
			Value:  31}}

	client, api, _, err := setupMocked()
	if err != nil {
		return
	}

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNode
	url := ts.URL + "/api/namespaces/bookinfo/services/productpage/graph?graphType=workload&appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_service_node_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}

// TestComplexGraph aims to provide test coverage for a more robust graph and specific corner cases. Listed below are coverage cases
// - multi-namespace
// - a "shared" node (internal in ns-1, outsider in ns-2)
// note: this is still not particularly robust, not sure how to include appenders in unit tests given that they create their own new business/kube clients
func TestComplexGraph(t *testing.T) {
	q0 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q0m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50}}

	q1 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace!="bookinfo",source_workload!="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	v1 := model.Vector{}

	q2 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	v2 := model.Vector{}

	q3 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="destination",source_workload="unknown",destination_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v3 := model.Vector{}

	q4 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace!="bookinfo",source_workload!="unknown",destination_service_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v4 := model.Vector{}

	q5 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="bookinfo"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v5 := model.Vector{}

	q6 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload="unknown",destination_service_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q6m0 := model.Metric{
		"source_workload_namespace":      "unknown",
		"source_workload":                "unknown",
		"source_app":                     "unknown",
		"source_version":                 "unknown",
		"destination_service_namespace":  "tutorial",
		"destination_service_name":       "customer",
		"destination_workload_namespace": "tutorial",
		"destination_workload":           "customer-v1",
		"destination_app":                "customer",
		"destination_version":            "v1",
		"request_protocol":               "grpc",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v6 := model.Vector{
		&model.Sample{
			Metric: q6m0,
			Value:  50}}

	q7 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace!="tutorial",source_workload!="unknown",destination_service_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	v7 := model.Vector{}

	q8 := `round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,request_protocol,response_code,response_flags),0.001)`
	q8m0 := model.Metric{
		"source_workload_namespace":      "tutorial",
		"source_workload":                "customer-v1",
		"source_app":                     "customer",
		"source_version":                 "v1",
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"request_protocol":               "http",
		"response_code":                  "200",
		"response_flags":                 "-"}
	v8 := model.Vector{
		&model.Sample{
			Metric: q8m0,
			Value:  50}}

	q9 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="destination",source_workload="unknown",destination_workload_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v9 := model.Vector{}

	q10 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace!="tutorial",source_workload!="unknown",destination_service_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v10 := model.Vector{}

	q11 := `round(sum(rate(istio_tcp_sent_bytes_total{reporter="source",source_workload_namespace="tutorial"} [600s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,response_flags),0.001)`
	v11 := model.Vector{}

	client, api, _, err := setupMocked()
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
	mockQuery(api, q6, &v6)
	mockQuery(api, q7, &v7)
	mockQuery(api, q8, &v8)
	mockQuery(api, q9, &v9)
	mockQuery(api, q10, &v10)
	mockQuery(api, q11, &v11)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := context.WithValue(r.Context(), "token", "test")
			fut(w, r.WithContext(context), client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphNamespaces
	url := ts.URL + "/api/namespaces/graph?graphType=versionedApp&groupBy=app&appenders=&queryTime=1523364075&namespaces=bookinfo,tutorial"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_complex_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}
