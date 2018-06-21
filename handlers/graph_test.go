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
	q0 := "round(sum(rate(istio_request_count{source_service!~\".*\\\\.bookinfo\\\\..*\",destination_service=~\".*\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q0m0 := model.Metric{
		"source_service":      "unknown",
		"source_version":      "unknown",
		"destination_service": "productpage.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "true"}
	q0m1 := model.Metric{
		"source_service":      "ingressgateway.istio-system.svc.cluster.local",
		"source_version":      "unknown",
		"destination_service": "productpage.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "true"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50},
		&model.Sample{
			Metric: q0m1,
			Value:  100}}

	q1 := "round(sum(rate(istio_request_count{source_service=~\".*\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q1m0 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m1 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v2",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m2 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v3",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m3 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "details.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "300",
		"connection_mtls":     "false"}
	q1m4 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "details.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "400",
		"connection_mtls":     "false"}
	q1m5 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "details.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "500",
		"connection_mtls":     "false"}
	q1m6 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "details.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m7 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "productpage.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m8 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m9 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v2",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m10 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v3",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m11 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v3",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v3",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m12 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v3",
		"destination_service": "pricing.bankapp.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}

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
			Value:  20},
		&model.Sample{
			Metric: q1m9,
			Value:  20},
		&model.Sample{
			Metric: q1m10,
			Value:  20},
		&model.Sample{
			Metric: q1m11,
			Value:  20},
		&model.Sample{
			Metric: q1m12,
			Value:  20}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

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
	q0 := "round(sum(rate(istio_request_count{source_service!~\".*\\\\.bookinfo\\\\..*\",destination_service=~\".*\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q0m0 := model.Metric{
		"source_service":      "unknown",
		"source_version":      "unknown",
		"destination_service": "productpage.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  50}}

	q1 := "round(sum(rate(istio_request_count{source_service=~\".*\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	v1 := model.Vector{}

	q2 := "round(sum(rate(istio_request_count{source_service!~\".*\\\\.tutorial\\\\..*\",destination_service=~\".*\\\\.tutorial\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q2m0 := model.Metric{
		"source_service":      "unknown",
		"source_version":      "unknown",
		"destination_service": "customer.tutorial.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	v2 := model.Vector{
		&model.Sample{
			Metric: q2m0,
			Value:  50}}

	q3 := "round(sum(rate(istio_request_count{source_service=~\".*\\\\.tutorial\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	v3 := model.Vector{}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)
	mockQuery(api, q3, &v3)

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

func TestServiceGraph(t *testing.T) {
	q0 := "round(sum(rate(istio_request_count{destination_service=~\"reviews\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q0m0 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q0m1 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v2",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q0m2 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v3",
		"response_code":       "200",
		"connection_mtls":     "false"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  20},
		&model.Sample{
			Metric: q0m1,
			Value:  20},
		&model.Sample{
			Metric: q0m2,
			Value:  20}}

	q1 := "round(sum(rate(istio_request_count{source_service=~\"reviews\\\\.bookinfo\\\\..*\",response_code=~\"[2345][0-9][0-9]\"} [600s])) by (source_service,source_version,destination_service,destination_version,response_code,connection_mtls),0.001)"
	q1m0 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v2",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m1 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v3",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v3",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m2 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
	q1m3 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v3",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1",
		"response_code":       "200",
		"connection_mtls":     "false"}
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
			Value:  20}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	var fut func(w http.ResponseWriter, r *http.Request, c *prometheus.Client)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/services/{service}/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			fut(w, r, client)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphService
	url := ts.URL + "/api/namespaces/bookinfo/services/reviews/graph?appenders&queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := ioutil.ReadAll(resp.Body)
	expected, _ := ioutil.ReadFile("testdata/test_service_graph.expected")
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.Equal(t, expected, actual) {
		fmt.Printf("\nActual:\n%v", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}
