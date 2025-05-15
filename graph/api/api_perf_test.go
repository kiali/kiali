package api

import (
	"flag"
	"fmt"

	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"
	cmdapi "k8s.io/client-go/tools/clientcmd/api"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

var numberOfNamespacesFlag int

func init() {
	flag.IntVar(&numberOfNamespacesFlag, "num-namespaces", 10, "Number of namespaces to create for Graph benchmark setup.")
}

func parseFlags(b *testing.B) {
	b.Helper()
	flag.Parse()
}

func mockNamespaceGraphPerf(b *testing.B, numNs int) (*prometheus.Client, *prometheustest.PromAPIMock, error, *business.Layer) {
	client, api, biz := setupMockedPerf(b, numNs)

	for i := 1; i <= numNs; i++ {
		q0 := fmt.Sprintf(`round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace!="bookinfo%d",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.bookinfo%d\\..+$"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags) > 0,0.001)`, i, i)
		v0 := model.Vector{}

		q1 := fmt.Sprintf(`round(sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags) > 0,0.001)`, i)
		q1m0 := model.Metric{
			"source_workload_namespace":      "istio-system",
			"source_workload":                "ingressgateway-unknown",
			"source_canonical_service":       "ingressgateway",
			"source_canonical_revision":      "latest",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "productpage:9080",
			"destination_service_name":       "productpage",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "productpage-v1",
			"destination_canonical_service":  "productpage",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m1 := model.Metric{
			"source_workload_namespace":      "unknown",
			"source_workload":                "unknown",
			"source_canonical_service":       "unknown",
			"source_canonical_revision":      "unknown",
			"source_cluster":                 "unknown",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "productpage:9080",
			"destination_service_name":       "productpage",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "productpage-v1",
			"destination_canonical_service":  "productpage",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m2 := model.Metric{
			"source_workload_namespace":      "unknown",
			"source_workload":                "unknown",
			"source_canonical_service":       "unknown",
			"source_canonical_revision":      "unknown",
			"source_cluster":                 "unknown",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "",
			"destination_service_name":       "",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "kiali-2412", // test case when there is no destination_service_name
			"destination_canonical_service":  "",
			"destination_canonical_revision": "",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m3 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v1",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m4 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v2",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v2",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m5 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v3",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v3",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m6 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "300",
			"response_flags":                 "-",
		}
		q1m7 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "400",
			"response_flags":                 "-",
		}
		q1m8 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q1m9 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m10 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "productpage:9080",
			"destination_service_name":       "productpage",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "productpage-v1",
			"destination_canonical_service":  "productpage",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m11 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m12 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q1m13 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v2",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v2",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m14 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q1m15 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q1m16 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v3",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v3",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		v1 := model.Vector{
			&model.Sample{
				Metric: q1m0,
				Value:  100,
			},
			&model.Sample{
				Metric: q1m1,
				Value:  50,
			},
			&model.Sample{
				Metric: q1m2,
				Value:  50,
			},
			&model.Sample{
				Metric: q1m3,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m4,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m5,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m6,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m7,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m8,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m9,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m10,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m11,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m12,
				Value:  10,
			},
			&model.Sample{
				Metric: q1m13,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m14,
				Value:  20,
			},
			&model.Sample{
				Metric: q1m15,
				Value:  10,
			},
			&model.Sample{
				Metric: q1m16,
				Value:  20,
			},
		}

		q2 := fmt.Sprintf(`round(sum(rate(istio_requests_total{reporter="source",source_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags) > 0,0.001)`, i)
		q2m0 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v1",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m1 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v2",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v2",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m2 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v3",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v3",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m3 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "300",
			"response_flags":                 "-",
		}
		q2m4 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "400",
			"response_flags":                 "-",
		}
		q2m5 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q2m6 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "details:9080",
			"destination_service_name":       "details",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "details-v1",
			"destination_canonical_service":  "details",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m7 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "productpage:9080",
			"destination_service_name":       "productpage",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "productpage-v1",
			"destination_canonical_service":  "productpage",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m8 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m9 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q2m10 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v2",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v2",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v2",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v2",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m11 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m12 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "ratings:9080",
			"destination_service_name":       "ratings",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "ratings-v1",
			"destination_canonical_service":  "ratings",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "500",
			"response_flags":                 "-",
		}
		q2m13 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "reviews:9080",
			"destination_service_name":       "reviews",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "reviews-v3",
			"destination_canonical_service":  "reviews",
			"destination_canonical_revision": "v3",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m14 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  "bankapp",
			"destination_service":            "pricing:9080",
			"destination_service_name":       "pricing",
			"destination_workload_namespace": "bankapp",
			"destination_workload":           "pricing-v1",
			"destination_canonical_service":  "pricing",
			"destination_canonical_revision": "v1",
			"request_protocol":               "http",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		q2m15 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "unknown",
			"destination_service_namespace":  "unknown",
			"destination_service":            "unknown",
			"destination_service_name":       "unknown",
			"destination_workload_namespace": "unknown",
			"destination_workload":           "unknown",
			"destination_canonical_service":  "unknown",
			"destination_canonical_revision": "unknown",
			"request_protocol":               "http",
			"response_code":                  "404",
			"response_flags":                 "NR",
		}
		q2m16 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  "bankapp",
			"destination_service":            "deposit:9080",
			"destination_service_name":       "deposit",
			"destination_workload_namespace": "bankapp",
			"destination_workload":           "deposit-v1",
			"destination_canonical_service":  "deposit",
			"destination_canonical_revision": "v1",
			"request_protocol":               "grpc",
			"response_code":                  "200",
			"grpc_response_status":           "0",
			"response_flags":                 "-",
		}
		v2 := model.Vector{
			&model.Sample{
				Metric: q2m0,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m1,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m2,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m3,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m4,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m5,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m6,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m7,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m8,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m9,
				Value:  10,
			},
			&model.Sample{
				Metric: q2m10,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m11,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m12,
				Value:  10,
			},
			&model.Sample{
				Metric: q2m13,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m14,
				Value:  20,
			},
			&model.Sample{
				Metric: q2m15,
				Value:  4,
			},
			&model.Sample{
				Metric: q2m16,
				Value:  50,
			},
		}

		q3 := fmt.Sprintf(`round(sum(rate(istio_tcp_sent_bytes_total{app!="ztunnel",reporter="source",source_workload_namespace!="bookinfo%d",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.bookinfo%d\\..+$"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i, i)
		v3 := model.Vector{}

		q4 := fmt.Sprintf(`round(sum(rate(istio_tcp_sent_bytes_total{app!="ztunnel",reporter="destination",destination_workload_namespace="bookinfo%d"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i)
		q4m0 := model.Metric{
			"source_workload_namespace":      "istio-system",
			"source_workload":                "ingressgateway-unknown",
			"source_canonical_service":       "ingressgateway",
			"source_canonical_revision":      "latest",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		q4m1 := model.Metric{
			"source_workload_namespace":      "unknown",
			"source_workload":                "unknown",
			"source_canonical_service":       "unknown",
			"source_canonical_revision":      "unknown",
			"source_cluster":                 "unknown",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		q4m2 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		v4 := model.Vector{
			&model.Sample{
				Metric: q4m0,
				Value:  150,
			},
			&model.Sample{
				Metric: q4m1,
				Value:  400,
			},
			&model.Sample{
				Metric: q4m2,
				Value:  31,
			},
		}

		q5 := fmt.Sprintf(`round(sum(rate(istio_tcp_sent_bytes_total{app!="ztunnel",reporter="source",source_workload_namespace="bookinfo%d"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i)
		q5m0 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		v5 := model.Vector{
			&model.Sample{
				Metric: q5m0,
				Value:  31,
			},
		}

		mockQuery(api, q0, &v0)
		mockQuery(api, q1, &v1)
		mockQuery(api, q2, &v2)
		mockQuery(api, q3, &v3)
		mockQuery(api, q4, &v4)
		mockQuery(api, q5, &v5)
	}

	return client, api, nil, biz
}

func setupMockedPerf(b *testing.B, numNs int) (*prometheus.Client, *prometheustest.PromAPIMock, *business.Layer) {
	b.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	var fakeNamespaces []runtime.Object
	for i := 1; i <= numNs; i++ {
		fakeNamespaces = append(fakeNamespaces, kubetest.FakeNamespace(fmt.Sprintf("bookinfo%d", i)))
	}

	fakeNamespaces = append(fakeNamespaces, kubetest.FakeNamespace("tutorial"))

	k8s := kubetest.NewFakeK8sClient(fakeNamespaces...)
	authInfo := map[string]*cmdapi.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		b.Fatal(err)
	}
	client.Inject(api)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)
	testingCache := cache.NewTestingCache(b, k8s, *conf)
	business.WithKialiCache(testingCache)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), testingCache, conf)
	business.WithDiscovery(discovery)

	biz, err := business.NewLayer(conf, testingCache, mockClientFactory, client, nil, nil, nil, discovery, authInfo)
	require.NoError(b, err)

	return client, api, biz
}

func mockNamespaceRatesGraphPerf(b *testing.B, numNs int) (*prometheus.Client, *prometheustest.PromAPIMock, error, *business.Layer) {
	client, api, err, biz := mockNamespaceGraphPerf(b, numNs)
	if err != nil {
		return client, api, err, biz
	}
	for i := 1; i <= numNs; i++ {
		q6 := fmt.Sprintf(`round(sum(rate(istio_tcp_received_bytes_total{app!="ztunnel",reporter="source",source_workload_namespace!="bookinfo%d",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.bookinfo%d\\..+$"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i, i)
		v6 := model.Vector{}

		q7 := fmt.Sprintf(`round(sum(rate(istio_tcp_received_bytes_total{app!="ztunnel",reporter="destination",destination_workload_namespace="bookinfo%d"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i)
		q7m0 := model.Metric{
			"source_workload_namespace":      "istio-system",
			"source_workload":                "ingressgateway-unknown",
			"source_canonical_service":       "ingressgateway",
			"source_canonical_revision":      "latest",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		q7m1 := model.Metric{
			"source_workload_namespace":      "unknown",
			"source_workload":                "unknown",
			"source_canonical_service":       "unknown",
			"source_canonical_revision":      "unknown",
			"source_cluster":                 "unknown",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		q7m2 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		v7 := model.Vector{
			&model.Sample{
				Metric: q7m0,
				Value:  300,
			},
			&model.Sample{
				Metric: q7m1,
				Value:  800,
			},
			&model.Sample{
				Metric: q7m2,
				Value:  62,
			},
		}

		q8 := fmt.Sprintf(`round(sum(rate(istio_tcp_received_bytes_total{app!="ztunnel",reporter="source",source_workload_namespace="bookinfo%d"} [600s])) by (app,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_flags) > 0,0.001)`, i)
		q8m0 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "productpage-v1",
			"source_canonical_service":       "productpage",
			"source_canonical_revision":      "v1",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_service":            "tcp:9080",
			"destination_service_name":       "tcp",
			"destination_workload_namespace": model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"destination_workload":           "tcp-v1",
			"destination_canonical_service":  "tcp",
			"destination_canonical_revision": "v1",
			"response_flags":                 "-",
		}
		v8 := model.Vector{
			&model.Sample{
				Metric: q8m0,
				Value:  62,
			},
		}

		q9 := fmt.Sprintf(`round(sum(rate(istio_request_messages_total{reporter="source",source_workload_namespace!="bookinfo%d",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.bookinfo%d\\..+$"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i, i)
		v9 := model.Vector{}

		q10 := fmt.Sprintf(`round(sum(rate(istio_request_messages_total{reporter="destination",destination_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i)
		v10 := model.Vector{}

		q11 := fmt.Sprintf(`round(sum(rate(istio_request_messages_total{reporter="source",source_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i)
		q11m0 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  "bankapp",
			"destination_service":            "deposit:9080",
			"destination_service_name":       "deposit",
			"destination_workload_namespace": "bankapp",
			"destination_workload":           "deposit-v1",
			"destination_canonical_service":  "deposit",
			"destination_canonical_revision": "v1",
		}
		v11 := model.Vector{
			&model.Sample{
				Metric: q11m0,
				Value:  50,
			},
		}

		q12 := fmt.Sprintf(`round(sum(rate(istio_response_messages_total{reporter="source",source_workload_namespace!="bookinfo%d",destination_workload_namespace="unknown",destination_workload="unknown",destination_service=~"^.+\\.bookinfo%d\\..+$"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i, i)
		v12 := model.Vector{}

		q13 := fmt.Sprintf(`round(sum(rate(istio_response_messages_total{reporter="destination",destination_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i)
		v13 := model.Vector{}

		q14 := fmt.Sprintf(`round(sum(rate(istio_response_messages_total{reporter="source",source_workload_namespace="bookinfo%d"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision) > 0,0.001)`, i)
		q14m0 := model.Metric{
			"source_workload_namespace":      model.LabelValue(fmt.Sprintf("bookinfo%d", i)),
			"source_workload":                "reviews-v3",
			"source_canonical_service":       "reviews",
			"source_canonical_revision":      "v3",
			"source_cluster":                 "east",
			"destination_cluster":            "east",
			"destination_service_namespace":  "bankapp",
			"destination_service":            "deposit:9080",
			"destination_service_name":       "deposit",
			"destination_workload_namespace": "bankapp",
			"destination_workload":           "deposit-v1",
			"destination_canonical_service":  "deposit",
			"destination_canonical_revision": "v1",
		}
		v14 := model.Vector{
			&model.Sample{
				Metric: q14m0,
				Value:  100,
			},
		}

		mockQuery(api, q6, &v6)
		mockQuery(api, q7, &v7)
		mockQuery(api, q8, &v8)
		mockQuery(api, q9, &v9)
		mockQuery(api, q10, &v10)
		mockQuery(api, q11, &v11)
		mockQuery(api, q12, &v12)
		mockQuery(api, q13, &v13)
		mockQuery(api, q14, &v14)
	}

	return client, api, nil, biz
}

func BenchmarkVersionedAppGraph(b *testing.B) {
	parseFlags(b)

	client, _, err, biz := mockNamespaceRatesGraphPerf(b, numberOfNamespacesFlag)
	if err != nil {
		b.Fatal(err)
	}

	namespaces := ""
	for i := 1; i <= numberOfNamespacesFlag; i++ {
		if i > 1 {
			namespaces += ","
		}
		namespaces += fmt.Sprintf("bookinfo%d", i)
	}

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/graph", func(w http.ResponseWriter, r *http.Request) {
		options := graph.NewOptions(r, &biz.Namespace)
		options.Rates.Ambient = graph.AmbientTrafficNone
		options.Appenders.AppenderNames = []string{"deadNode", "istio", "serviceEntry", "meshCheck", "workloadEntry", "health"}
		code, config := graphNamespacesIstio(r.Context(), biz, client, options)
		respond(w, code, config)
	})

	ts := httptest.NewServer(mr)
	defer ts.Close()

	url := ts.URL + "/api/namespaces/graph?namespaces=" + namespaces + "&graphType=versionedApp&appenders&queryTime=1523364075"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := http.Get(url)
		if err != nil {
			b.Fatal(err)
		}
		_, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			b.Fatal(err)
		}
		if resp.StatusCode != 200 {
			b.Fatalf("Unexpected status code: %d", resp.StatusCode)
		}
	}
}
