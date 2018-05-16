package routing

import (
	"net/http"

	"github.com/kiali/kiali/handlers"
)

// Route describes a single route
type Route struct {
	Name        string
	Method      string
	Pattern     string
	HandlerFunc http.HandlerFunc
}

// Routes holds an array of Route
type Routes struct {
	Routes []Route
}

// NewRoutes creates and returns all the API routes
func NewRoutes() (r *Routes) {
	r = new(Routes)

	r.Routes = []Route{
		{
			"Root",
			"GET",
			"/api",
			handlers.Root,
		},
		{ // another way to get to root, both show status
			"Status",
			"GET",
			"/api/status",
			handlers.Root,
		},
		{
			"IstioConfigList",
			"GET",
			"/api/namespaces/{namespace}/istio",
			handlers.IstioConfigList,
		},
		{
			"IstioConfigDetails",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigDetails,
		},
		/*
			TODO the /rules endpoint is now deprecated in favor of /istio
		*/
		{
			"IstioRuleList",
			"GET",
			"/api/namespaces/{namespace}/rules",
			handlers.IstioRuleList,
		},
		/*
			TODO the /rules/{rule} is now deprecated in favor of /istio/{object_type}/{object}
		*/
		{
			"IstioRuleDetails",
			"GET",
			"/api/namespaces/{namespace}/rules/{rule}",
			handlers.IstioRuleDetails,
		},
		{
			"ServiceList",
			"GET",
			"/api/namespaces/{namespace}/services",
			handlers.ServiceList,
		},
		{
			"ServiceDetails",
			"GET",
			"/api/namespaces/{namespace}/services/{service}",
			handlers.ServiceDetails,
		},
		{
			"NamespaceList",
			"GET",
			"/api/namespaces",
			handlers.NamespaceList,
		},
		{
			// Supported query parameters:
			// version:				When provided, filters metrics for a specific version of this service
			// step:				  Duration indicating desired step between two datapoints, in seconds (default 15)
			// duration:      Duration indicating desired query period, in seconds (default 1800 = 30 minutes)
			// rateInterval:  Interval used for rate and histogram calculation (default 1m)
			// rateFunc:		  Rate: standard 'rate' or instant 'irate' (default is 'rate')
			// filters[]:			List of metrics to fetch (empty by default). When empty, all metrics are fetched. Expected name here is the Kiali internal metric name
			// byLabelsIn[]:  List of labels to use for grouping input metrics (empty by default). Example: response_code,source_version
			// byLabelsOut[]: List of labels to use for grouping output metrics (empty by default). Example: response_code,destination_version

			"ServiceMetrics",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/metrics",
			handlers.ServiceMetrics,
		},
		{
			"ServiceHealth",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/health",
			handlers.ServiceHealth,
		},
		{
			"ServiceValidations",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/istio_validations",
			handlers.ServiceIstioValidations,
		},
		{
			"NamespaceMetrics",
			"GET",
			"/api/namespaces/{namespace}/metrics",
			handlers.NamespaceMetrics,
		},
		{
			// Supported query parameters:
			// vendor:         cytoscape (default) | vizceral
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// queryTime:      Unix timestamp in seconds is query range end time (default now)
			// duration:       Duration indicating desired query period (default 10m)
			// appenders:      comma-separated list of desired appenders (default all)

			"GraphNamespace",
			"GET",
			"/api/namespaces/{namespace}/graph",
			handlers.GraphNamespace,
		},
		{
			// Supported query parameters:
			// vendor:         cytoscape (default)
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// queryTime:      Unix timestamp in seconds is query range end time (default now)
			// duration:       Duration indicating desired query period (default 10m)
			// appenders:      comma-separated list of desired appenders (default all)

			"GraphService",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/graph",
			handlers.GraphService,
		},
		{
			"GrafanaURL",
			"GET",
			"/api/grafana",
			handlers.GetGrafanaInfo,
		},
		{
			"JaegerURL",
			"GET",
			"/api/jaeger",
			handlers.GetJaegerInfo,
		},
	}

	return
}
