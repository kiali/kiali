package routing

import (
	"net/http"

	"github.com/kiali/kiali/handlers"
)

// Route describes a single route
type Route struct {
	Name          string
	Method        string
	Pattern       string
	HandlerFunc   http.HandlerFunc
	Authenticated bool
}

// Routes holds an array of Route
type Routes struct {
	Routes []Route
}

// NewRoutes creates and returns all the API routes
func NewRoutes() (r *Routes) {
	r = new(Routes)

	r.Routes = []Route{
		// swagger:route GET / Root
		// ---
		// Endpoint to get the status of Kiali
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: statusInfo
		{
			"Root",
			"GET",
			"/api",
			handlers.Root,
			false,
		},
		// swagger:route GET /token GetToken
		// ---
		// Endpoint to get the authentication token
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		//	   Security:
		//     authorization: user, password
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: tokenGenerated
		{ // Request the token
			"Status",
			"GET",
			"/api/token",
			handlers.GetToken,
			true,
		},
		// swagger:route GET /status getStatus
		// ---
		// Endpoint to get the status of Kiali
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: statusInfo
		{
			"Status",
			"GET",
			"/api/status",
			handlers.Root,
			false,
		},
		// swagger:route GET /namespaces/{namespace}/istio istioConfigList
		// ---
		// Endpoint to get the list of Istio Config of a namespace
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: istioConfigList
		//
		{
			"IstioConfigList",
			"GET",
			"/api/namespaces/{namespace}/istio",
			handlers.IstioConfigList,
			true,
		},
		{
			"IstioConfigDetails",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigDetails,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/istio/{object_type}/{object}/istio_validations validations objectValidations
		// ---
		// Endpoint to get the list of istio object validations for a service
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: typeValidationsResponse
		//
		{
			"IstioConfigValidation",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}/istio_validations",
			handlers.IstioConfigValidations,
			true,
		},
		{
			"ServiceList",
			"GET",
			"/api/namespaces/{namespace}/services",
			handlers.ServiceList,
			true,
		},
		{
			"ServiceDetails",
			"GET",
			"/api/namespaces/{namespace}/services/{service}",
			handlers.ServiceDetails,
			true,
		},
		{
			"NamespaceList",
			"GET",
			"/api/namespaces",
			handlers.NamespaceList,
			true,
		},
		{
			// Supported query parameters:
			// version:       When provided, filters metrics for a specific version of this service
			// step:          Duration indicating desired step between two datapoints, in seconds (default 15)
			// duration:      Duration indicating desired query period, in seconds (default 1800 = 30 minutes)
			// rateInterval:  Interval used for rate and histogram calculation (default 1m)
			// rateFunc:      Rate: standard 'rate' or instant 'irate' (default is 'rate')
			// filters[]:     List of metrics to fetch (empty by default). When empty, all metrics are fetched. Expected name here is the Kiali internal metric name
			// byLabelsIn[]:  List of labels to use for grouping input metrics (empty by default). Example: response_code,source_version
			// byLabelsOut[]: List of labels to use for grouping output metrics (empty by default). Example: response_code,destination_version
			// includeIstio:  Include istio-system destinations in collected metrics (default false)

			"ServiceMetrics",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/metrics",
			handlers.ServiceMetrics,
			true,
		},
		{
			"ServiceHealth",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/health",
			handlers.ServiceHealth,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/istio_validations validations serviceValidations
		// ---
		// Endpoint to get the list of istio object validations for a service
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: typeValidationsResponse
		//
		{
			"ServiceValidations",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/istio_validations",
			handlers.ServiceIstioValidations,
			true,
		},
		{
			"NamespaceMetrics",
			"GET",
			"/api/namespaces/{namespace}/metrics",
			handlers.NamespaceMetrics,
			true,
		},
		{
			"NamespaceHealth",
			"GET",
			"/api/namespaces/{namespace}/health",
			handlers.NamespaceHealth,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/istio_validations validations namespaceValidations
		// ---
		// Endpoint to get the list of istio object validations for a namespace
		//
		//     Consumes:
		//     - application/json
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      default: genericError
		//      404: notFoundError
		//      500: internalError
		//      200: namespaceValidationsResponse
		//
		{
			"NamespaceValidations",
			"GET",
			"/api/namespaces/{namespace}/istio_validations",
			handlers.NamespaceIstioValidations,
			true,
		},
		{
			// Supported query parameters:
			// appenders:      comma-separated list of desired appenders (default all)
			// duration:       Duration indicating desired query period (default 10m)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// includeIstio    include istio-system services in graph (default false)
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// namespaces:     comma-separated list of namespaces will override path param (path param 'all' for all namespaces)
			// queryTime:      Unix timestamp in seconds is query range end time (default now)
			// vendor:         cytoscape (default) | vizceral

			"GraphNamespace",
			"GET",
			"/api/namespaces/{namespace}/graph",
			handlers.GraphNamespace,
			true,
		},
		{
			// Supported query parameters:
			// appenders:      comma-separated list of desired appenders (default all)
			// duration:       Duration indicating desired query period (default 10m)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// includeIstio    include istio-system services in graph (default false)
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// queryTime:      Unix timestamp in seconds is query range end time (default now)

			"GraphService",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/graph",
			handlers.GraphService,
			true,
		},
		{
			"GrafanaURL",
			"GET",
			"/api/grafana",
			handlers.GetGrafanaInfo,
			true,
		},
		{
			"JaegerURL",
			"GET",
			"/api/jaeger",
			handlers.GetJaegerInfo,
			true,
		},
	}

	return
}
