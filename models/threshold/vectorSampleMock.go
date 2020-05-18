package threshold

import "github.com/prometheus/common/model"

var Requests = model.Vector{
	&model.Sample{
		Metric: map[model.LabelName]model.LabelValue{
			"connection_security_policy":     "none",
			"destination_app":                "details",
			"destination_principal":          "unknown",
			"destination_service":            "details.bookinfo.svc.cluster.local",
			"destination_service_name":       "details",
			"destination_service_namespace":  "bookinfo",
			"destination_version":            "v1",
			"destination_workload":           "details-v1",
			"destination_workload_namespace": "bookinfo",
			"instance":                       "10.129.2.20:42422",
			"job":                            "istio-mesh",
			"reporter":                       "destination",
			"request_protocol":               "http",
			"response_code":                  "400",
			"response_flags":                 "-",
			"source_app":                     "productpage",
			"source_principal":               "unknown",
			"source_version":                 "v1",
			"source_workload":                "productpage-v1",
			"source_workload_namespace":      "bookinfo",
		},
	},
	&model.Sample{
		Metric: map[model.LabelName]model.LabelValue{
			"connection_security_policy":     "none",
			"destination_app":                "details",
			"destination_principal":          "unknown",
			"destination_service":            "details.bookinfo.svc.cluster.local",
			"destination_service_name":       "reviews",
			"destination_service_namespace":  "bookinfo",
			"destination_version":            "v1",
			"destination_workload":           "details-v1",
			"destination_workload_namespace": "bookinfo",
			"instance":                       "10.129.2.20:42422",
			"job":                            "istio-mesh",
			"reporter":                       "destination",
			"request_protocol":               "http",
			"response_code":                  "100",
			"response_flags":                 "-",
			"source_app":                     "productpage",
			"source_principal":               "unknown",
			"source_version":                 "v1",
			"source_workload":                "productpage-v1",
			"source_workload_namespace":      "bookinfo",
		},
	},
}
