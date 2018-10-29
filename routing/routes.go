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

// Routes holds an array of Route. A note on swagger documentation. The path variables and query parameters
// are defined in ../doc.go.  YOu need to manually associate params and routes.
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
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		// responses:
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
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		//    Security:
		//     authorization: user, password
		//
		// responses:
		//      500: internalError
		//      200: tokenGenerated
		{ // Request the token
			"Token",
			"GET",
			"/api/token",
			handlers.GetToken,
			true,
		},
		// swagger:route GET /status getStatus
		// ---
		// Endpoint to get the status of Kiali
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: statusInfo
		{
			"Status",
			"GET",
			"/api/status",
			handlers.Root,
			false,
		},
		// swagger:route GET /namespaces/{namespace}/istio config istioConfigList
		// ---
		// Endpoint to get the list of Istio Config of a namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
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
		// swagger:route GET /namespaces/{namespace}/istio/{object_type}/{object} config istioConfigDetails
		// ---
		// Endpoint to get the Istio Config of an Istio object
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      404: notFoundError
		//      500: internalError
		//      200: istioConfigDetailsResponse
		//
		{
			"IstioConfigDetails",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigDetails,
			true,
		},
		// swagger:route DELETE /namespaces/{namespace}/istio/{object_type}/{object}
		// ---
		// Endpoint to delete the Istio Config of an (arbitrary) Istio object
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
		//      200: delete
		//
		{
			"IstioConfigDelete",
			"DELETE",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigDelete,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/istio/{object_type}/{object}/istio_validations config objectValidations
		// ---
		// Endpoint to get the list of istio object validations for a service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      404: notFoundError
		//      500: internalError
		//      200: typeValidationsResponse
		//
		{
			"IstioConfigValidations",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}/istio_validations",
			handlers.IstioConfigValidations,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services services serviceList
		// ---
		// Endpoint to get the details of a given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: serviceListResponse
		//
		{
			"ServiceList",
			"GET",
			"/api/namespaces/{namespace}/services",
			handlers.ServiceList,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service} services serviceDetails
		// ---
		// Endpoint to get the details of a given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200: serviceDetailsResponse
		//
		{
			"ServiceDetails",
			"GET",
			"/api/namespaces/{namespace}/services/{service}",
			handlers.ServiceDetails,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/workloads workloads workloadList
		// ---
		// Endpoint to get the list of workloads for a namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: workloadListResponse
		//
		{
			"WorkloadList",
			"GET",
			"/api/namespaces/{namespace}/workloads",
			handlers.WorkloadList,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/workloads/{workload} workloads workloadDetails
		// ---
		// Endpoint to get the workload details
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      404: notFoundError
		//      200: workloadDetails
		//
		{
			"WorkloadDetails",
			"GET",
			"/api/namespaces/{namespace}/workloads/{workload}",
			handlers.WorkloadDetails,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/apps apps appList
		// ---
		// Endpoint to get the list of apps for a namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: appListResponse
		//
		{
			"AppList",
			"GET",
			"/api/namespaces/{namespace}/apps",
			handlers.AppList,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/apps/{app} apps appDetails
		// ---
		// Endpoint to get the app details
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      404: notFoundError
		//      200: appDetails
		//
		{
			"AppDetails",
			"GET",
			"/api/namespaces/{namespace}/apps/{app}",
			handlers.AppDetails,
			true,
		},
		// swagger:route GET /namespaces namespaces namespaceList
		// ---
		// Endpoint to get the list of the available namespaces
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: namespaceList
		//
		{
			"NamespaceList",
			"GET",
			"/api/namespaces",
			handlers.NamespaceList,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/services/{service}/metrics services serviceMetrics
		// ---
		// Endpoint to fetch metrics to be displayed, related to a single service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: metricsResponse
		//
		{
			"ServiceMetrics",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/metrics",
			handlers.ServiceMetrics,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/apps/{app}/metrics apps appMetrics
		// ---
		// Endpoint to fetch metrics to be displayed, related to a single app
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: metricsResponse
		//
		{
			"AppMetrics",
			"GET",
			"/api/namespaces/{namespace}/apps/{app}/metrics",
			handlers.AppMetrics,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/workloads/{workload}/metrics workloads workloadMetrics
		// ---
		// Endpoint to fetch metrics to be displayed, related to a single workload
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: metricsResponse
		//
		{
			"WorkloadMetrics",
			"GET",
			"/api/namespaces/{namespace}/workloads/{workload}/metrics",
			handlers.WorkloadMetrics,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/services/{service}/health services serviceHealth
		// ---
		// Get health associated to the given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: serviceHealthResponse
		//      404: notFoundError
		//      500: internalError
		//
		{
			"ServiceHealth",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/health",
			handlers.ServiceHealth,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/apps/{app}/health apps appHealth
		// ---
		// Get health associated to the given app
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: appHealthResponse
		//      404: notFoundError
		//      500: internalError
		//
		{
			"AppHealth",
			"GET",
			"/api/namespaces/{namespace}/apps/{app}/health",
			handlers.AppHealth,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/workloads/{workload}/health workloads workloadHealth
		// ---
		// Get health associated to the given workload
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: workloadHealthResponse
		//      404: notFoundError
		//      500: internalError
		//
		{
			"WorkloadHealth",
			"GET",
			"/api/namespaces/{namespace}/workloads/{workload}/health",
			handlers.WorkloadHealth,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/istio_validations services serviceValidations
		// ---
		// Endpoint to get the list of istio object validations for a service
		//
		// responses:
		//      500: internalError
		//      404: notFoundError
		//      200: typeValidationsResponse
		//
		{
			"ServiceValidations",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/istio_validations",
			handlers.ServiceIstioValidations,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/metrics namespaces namespaceMetrics
		// ---
		// Endpoint to fetch metrics to be displayed, related to a namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: metricsResponse
		//
		{
			"NamespaceMetrics",
			"GET",
			"/api/namespaces/{namespace}/metrics",
			handlers.NamespaceMetrics,
			true,
		},
		// swagger:route GET /api/namespaces/{namespace}/health namespaces namespaceHealth
		// ---
		// Get health for all objects in the given namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: namespaceAppHealthResponse
		//      400: badRequestError
		//      500: internalError
		//
		{
			"NamespaceHealth",
			"GET",
			"/api/namespaces/{namespace}/health",
			handlers.NamespaceHealth,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/istio_validations namespaces namespaceValidations
		// ---
		// Endpoint to get the list of istio object validations for a namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      404: notFoundError
		//      200: namespaceValidationsResponse
		//
		{
			"NamespaceValidations",
			"GET",
			"/api/namespaces/{namespace}/istio_validations",
			handlers.NamespaceIstioValidations,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/graph graphs graphNamespace
		// ---
		// The backing JSON for a namespaces graph.
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      500: internalError
		//      200: graphResponse
		//
		{
			"GraphNamespace",
			"GET",
			"/api/namespaces/{namespace}/graph",
			handlers.GraphNamespace,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/applications/{app}/versions/{version}/graph graphs graphAppVersion
		// ---
		// The backing JSON for a versioned app node detail graph.
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      500: internalError
		//      200: graphResponse
		//
		{

			"GraphAppVersion",
			"GET",
			"/api/namespaces/{namespace}/applications/{app}/versions/{version}/graph",
			handlers.GraphNode,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/applications/{app}/graph graphs graphApp
		// ---
		// The backing JSON for an app node detail graph.
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      500: internalError
		//      200: graphResponse
		//
		{
			"GraphApp",
			"GET",
			"/api/namespaces/{namespace}/applications/{app}/graph",
			handlers.GraphNode,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/graph graphs graphService
		// ---
		// The backing JSON for a service node detail graph.
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      500: internalError
		//      200: graphResponse
		//
		{
			"GraphService",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/graph",
			handlers.GraphNode,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/workloads/{workload}/graph graphs graphWorkload
		// ---
		// The backing JSON for a workload node detail graph.
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      500: internalError
		//      200: graphResponse
		//
		{
			"GraphWorkload",
			"GET",
			"/api/namespaces/{namespace}/workloads/{workload}/graph",
			handlers.GraphNode,
			true,
		},
		// swagger:route GET /grafana grafanaInfo
		// ---
		// Get the grafana URL and other descriptors
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      406: notAcceptableError
		//      500: internalError
		//      200: grafanaInfoResponse
		//      204: grafanaInfoResponse
		//
		{
			"GrafanaURL",
			"GET",
			"/api/grafana",
			handlers.GetGrafanaInfo,
			true,
		},
		// swagger:route GET /jaeger jaegerInfo
		// ---
		// Get the jaeger URL and other descriptors
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      406: notAcceptableError
		//      200: jaegerInfoResponse
		//
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
