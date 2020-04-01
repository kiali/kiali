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
		// swagger:route GET /healthz kiali healthz
		// ---
		// Endpoint to get the health of Kiali
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		// responses:
		//		500: internalError
		//		200
		{
			"Healthz",
			"GET",
			"/healthz",
			handlers.Healthz,
			false,
		},
		// swagger:route GET / kiali root
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
		// swagger:route GET /authenticate auth authenticate
		// ---
		// Endpoint to authenticate the user
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
		//      200: tokenResponse
		{
			"Authenticate",
			"GET",
			"/api/authenticate",
			handlers.Authenticate,
			false,
		},
		// swagger:route POST /authenticate auth openshiftCheckToken
		// ---
		// Endpoint to check if a token from Openshift is working correctly
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: tokenResponse
		{
			"OpenshiftCheckToken",
			"POST",
			"/api/authenticate",
			handlers.Authenticate,
			false,
		},
		// swagger:route GET /logout auth logout
		// ---
		// Endpoint to logout an user (unset the session cookie)
		//
		//     Schemes: http, https
		//
		// responses:
		//      204: noContent
		{
			"Logout",
			"GET",
			"/api/logout",
			handlers.Logout,
			false,
		},
		// swagger:route GET /auth/info auth authenticationInfo
		// ---
		// Endpoint to get login info, such as strategy, authorization endpoints
		// for OAuth providers and so on.
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
		//      500: internalError
		//      200: authenticationInfo
		{
			"AuthenticationInfo",
			"GET",
			"/api/auth/info",
			handlers.AuthenticationInfo,
			false,
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
			true,
		},
		// swagger:route GET /config kiali getConfig
		// ---
		// Endpoint to get the config of Kiali
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
			"Config",
			"GET",
			"/api/config",
			handlers.Config,
			true,
		},
		// swagger:route GET /istio/permissions config getPermissions
		// ---
		// Endpoint to get the caller permissions on new Istio Config objects
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      200: istioConfigPermissions
		{
			"IstioConfigPermissions",
			"GET",
			"/api/istio/permissions",
			handlers.IstioConfigPermissions,
			true,
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
		// swagger:route GET /namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object} config istioConfigDetailsSubtype
		// ---
		// Endpoint to get the Istio Config of an Istio object used for templates and adapters that is necessary to define a subtype
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
			"IstioConfigDetailsSubtype",
			"GET",
			"/api/namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object}",
			handlers.IstioConfigDetails,
			true,
		},
		// swagger:route DELETE /namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object} config istioConfigDeleteSubtype
		// ---
		// Endpoint to delete the Istio Config of an Istio object used for templates and adapters
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200
		//
		{
			"IstioConfigDeleteSubtype",
			"DELETE",
			"/api/namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object}",
			handlers.IstioConfigDelete,
			true,
		},
		// swagger:route PATCH /namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object} config istioConfigUpdateSubtype
		// ---
		// Endpoint to update the Istio Config of an Istio object used for templates and adapters using Json Merge Patch strategy.
		//
		//     Consumes:
		//	   - application/json
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
			"IstioConfigUpdateSubtype",
			"PATCH",
			"/api/namespaces/{namespace}/istio/{object_type}/{object_subtype}/{object}",
			handlers.IstioConfigUpdate,
			true,
		},
		// swagger:route POST /namespaces/{namespace}/istio/{object_type}/{object_subtype} config istioConfigCreateSubtype
		// ---
		// Endpoint to create an Istio object by using an Istio Config item
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//		202
		//		201: istioConfigDetailsResponse
		//      200: istioConfigDetailsResponse
		//
		{
			"IstioConfigCreateSubtype",
			"POST",
			"/api/namespaces/{namespace}/istio/{object_type}/{object_subtype}",
			handlers.IstioConfigCreate,
			true,
		},
		// swagger:route DELETE /namespaces/{namespace}/istio/{object_type}/{object} config istioConfigDelete
		// ---
		// Endpoint to delete the Istio Config of an (arbitrary) Istio object
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200
		//
		{
			"IstioConfigDelete",
			"DELETE",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigDelete,
			true,
		},
		// swagger:route PATCH /namespaces/{namespace}/istio/{object_type}/{object} config istioConfigUpdate
		// ---
		// Endpoint to update the Istio Config of an Istio object used for templates and adapters using Json Merge Patch strategy.
		//
		//     Consumes:
		//	   - application/json
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
			"IstioConfigUpdate",
			"PATCH",
			"/api/namespaces/{namespace}/istio/{object_type}/{object}",
			handlers.IstioConfigUpdate,
			true,
		},
		// swagger:route POST /namespaces/{namespace}/istio/{object_type} config istioConfigCreate
		// ---
		// Endpoint to create an Istio object by using an Istio Config item
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//		202
		//		201: istioConfigDetailsResponse
		//      200: istioConfigDetailsResponse
		//
		{
			"IstioConfigCreate",
			"POST",
			"/api/namespaces/{namespace}/istio/{object_type}",
			handlers.IstioConfigCreate,
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
		// swagger:route GET /namespaces/{namespace}/services/{service}/spans traces spansList
		// ---
		// Endpoint to get Jaeger spans for a given service
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		// 		500: internalError
		//		200: spansResponse
		{
			"ServiceSpans",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/spans",
			handlers.ServiceSpans,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/traces traces tracesList
		// ---
		// Endpoint to get the traces of a given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200: tracesDetailResponse
		//
		{
			"TracesList",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/traces",
			handlers.TraceServiceDetails,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/errortraces traces errorTraces
		// ---
		// Endpoint to get the number of traces in error for a given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200: errorTracesResponse
		//
		{
			"ErrorTraces",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/errortraces",
			handlers.ErrorTraces,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/traces traces tracesDetail
		// ---
		// Endpoint to get a specific trace of a given service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      404: notFoundError
		//      500: internalError
		//      200: tracesDetailResponse
		//
		{
			"TracesDetails",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/traces/{traceID}",
			handlers.TraceDetails,
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
		// swagger:route GET /namespaces/{namespace}/services/{service}/metrics services serviceMetrics
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
		// swagger:route GET /namespaces/{namespace}/apps/{app}/metrics apps appMetrics
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
		// swagger:route GET /namespaces/{namespace}/workloads/{workload}/metrics workloads workloadMetrics
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
		// swagger:route GET /namespaces/{namespace}/services/{service}/dashboard services serviceDashboard
		// ---
		// Endpoint to fetch dashboard to be displayed, related to a single service
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: dashboardResponse
		//
		{
			"ServiceDashboard",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/dashboard",
			handlers.ServiceDashboard,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/apps/{app}/dashboard apps appDashboard
		// ---
		// Endpoint to fetch dashboard to be displayed, related to a single app
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: dashboardResponse
		//
		{
			"AppDashboard",
			"GET",
			"/api/namespaces/{namespace}/apps/{app}/dashboard",
			handlers.AppDashboard,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/workloads/{workload}/dashboard workloads workloadDashboard
		// ---
		// Endpoint to fetch dashboard to be displayed, related to a single workload
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: dashboardResponse
		//
		{
			"WorkloadDashboard",
			"GET",
			"/api/namespaces/{namespace}/workloads/{workload}/dashboard",
			handlers.WorkloadDashboard,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/customdashboard/{dashboard} dashboards customDashboard
		// ---
		// Endpoint to fetch a custom dashboard
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      400: badRequestError
		//      503: serviceUnavailableError
		//      200: dashboardResponse
		//
		{
			"CustomDashboard",
			"GET",
			"/api/namespaces/{namespace}/customdashboard/{dashboard}",
			handlers.CustomDashboard,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/services/{service}/health services serviceHealth
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
		// swagger:route GET /namespaces/{namespace}/apps/{app}/health apps appHealth
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
		// swagger:route GET /namespaces/{namespace}/workloads/{workload}/health workloads workloadHealth
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
		// swagger:route GET /namespaces/{namespace}/metrics namespaces namespaceMetrics
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
		// swagger:route GET /namespaces/{namespace}/health namespaces namespaceHealth
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
		// swagger:route GET /namespaces/{namespace}/validations namespaces namespaceValidations
		// ---
		// Get validation summary for all objects in the given namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: namespaceValidationSummaryResponse
		//      400: badRequestError
		//      500: internalError
		//
		{
			"NamespaceValidationSummary",
			"GET",
			"/api/namespaces/{namespace}/validations",
			handlers.NamespaceValidationSummary,
			true,
		},
		// swagger:route GET /mesh/tls tls meshTls
		// ---
		// Get TLS status for the whole mesh
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: meshTlsResponse
		//      400: badRequestError
		//      500: internalError
		//
		{
			"NamespaceTls",
			"GET",
			"/api/mesh/tls",
			handlers.MeshTls,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/tls tls namespaceTls
		// ---
		// Get TLS status for the given namespace
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      200: namespaceTlsResponse
		//      400: badRequestError
		//      500: internalError
		//
		{
			"NamespaceTls",
			"GET",
			"/api/namespaces/{namespace}/tls",
			handlers.NamespaceTls,
			true,
		},
		// swagger:route GET /namespaces/graph graphs graphNamespaces
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
			"GraphNamespaces",
			"GET",
			"/api/namespaces/graph",
			handlers.GraphNamespaces,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/applications/{app}/versions/{version}/graph graphs graphAppVersion
		// ---
		// The backing JSON for a versioned app node detail graph. (supported graphTypes: app | versionedApp)
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
		// The backing JSON for an app node detail graph. (supported graphTypes: app | versionedApp)
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
		// swagger:route GET /grafana integrations grafanaInfo
		// ---
		// Get the grafana URL and other descriptors
		//
		//     Produces:
		//     - application/json
		//
		//     Schemes: http, https
		//
		// responses:
		//      500: internalError
		//      503: serviceUnavailableError
		//      200: grafanaInfoResponse
		//      204: noContent
		//
		{
			"GrafanaURL",
			"GET",
			"/api/grafana",
			handlers.GetGrafanaInfo,
			true,
		},
		// swagger:route GET /jaeger integrations jaegerInfo
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
		// swagger:route GET /namespaces/{namespace}/pods/{pod} pods podDetails
		// ---
		// Endpoint to get pod details
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
			"PodDetails",
			"GET",
			"/api/namespaces/{namespace}/pods/{pod}",
			handlers.PodDetails,
			true,
		},
		// swagger:route GET /namespaces/{namespace}/pods/{pod}/logs pods podLogs
		// ---
		// Endpoint to get pod logs
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
			"PodLogs",
			"GET",
			"/api/namespaces/{namespace}/pods/{pod}/logs",
			handlers.PodLogs,
			true,
		},
		// swagger:route GET /threescale threescale getThreeScaleInfo
		// ---
		// Endpoint to check if threescale adapter is present in the cluster and if user can write adapter config
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: threeScaleInfoResponse
		{
			"ThreeScaleInfo",
			"GET",
			"/api/threescale",
			handlers.ThreeScaleStatus,
			true,
		},
		// swagger:route GET /threescale/handlers threescale getThreeScaleHandlers
		// ---
		// Endpoint to fetch threescale handlers generated from Kiali
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: threeScaleHandlersResponse
		{
			"ThreeScaleHandlersList",
			"GET",
			"/api/threescale/handlers",
			handlers.ThreeScaleHandlersList,
			true,
		},
		// swagger:route POST /threescale/handlers threescale postThreeScaleHandlers
		// ---
		// Endpoint to create a new threescale handler+instance generated by Kiali
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: threeScaleHandlersResponse
		{
			"ThreeScaleHandlersCreate",
			"POST",
			"/api/threescale/handlers",
			handlers.ThreeScaleHandlersCreate,
			true,
		},
		// swagger:route PATCH /threescale/handlers/{threescaleHandlerName} threescale patchThreeScaleHandler
		// ---
		// Endpoint to update an existing threescale handler generated by Kiali
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		404: notFoundError
		//		200: threeScaleHandlersResponse
		{
			"ThreeScaleHandlerPatch",
			"PATCH",
			"/api/threescale/handlers/{threescaleHandlerName}",
			handlers.ThreeScaleHandlersUpdate,
			true,
		},
		// swagger:route DELETE /threescale/handlers/{threescaleHandlerName} threescale deleteThreeScaleHandler
		// ---
		// Endpoint to delete an existing threescale handler+instance generated by Kiali
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		404: notFoundError
		//		200: threeScaleHandlersResponse
		{
			"ThreeScaleHandlerDelete",
			"DELETE",
			"/api/threescale/handlers/{threescaleHandlerName}",
			handlers.ThreeScaleHandlersDelete,
			true,
		},
		// swagger:route GET /threescale/namespaces/{namespace}/services/{service} threescale getThreeScaleService
		// ---
		// Endpoint to get an existing threescale rule for a given service
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		// 		500: internalError
		//		404: notFoundError
		//		200: threeScaleRuleResponse
		{
			"ThreeScaleServiceRuleGet",
			"GET",
			"/api/threescale/namespaces/{namespace}/services/{service}",
			handlers.ThreeScaleServiceRuleGet,
			true,
		},
		// swagger:route POST /threescale/namespaces/{namespace}/services threescale postThreeScaleService
		// ---
		// Endpoint to create a new threescale rule for a given service
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		// 		500: internalError
		//		200: threeScaleRuleResponse
		{
			"ThreeScaleServiceRuleCreate",
			"POST",
			"/api/threescale/namespaces/{namespace}/services",
			handlers.ThreeScaleServiceRuleCreate,
			true,
		},
		// swagger:route PATCH /threescale/namespaces/{namespace}/services/{service} threescale patchThreeScaleService
		// ---
		// Endpoint to update an existing threescale rule for a given service
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		// 		500: internalError
		//		404: notFoundError
		//		200: threeScaleRuleResponse
		{
			"ThreeScaleServiceRuleUpdate",
			"PATCH",
			"/api/threescale/namespaces/{namespace}/services/{service}",
			handlers.ThreeScaleServiceRuleUpdate,
			true,
		},
		// swagger:route DELETE /threescale/namespaces/{namespace}/services/{service} threescale deleteThreeScaleService
		// ---
		// Endpoint to delete an existing threescale rule for a given service
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		// 		500: internalError
		//		404: notFoundError
		//		200
		{
			"ThreeScaleServiceRuleDelete",
			"DELETE",
			"/api/threescale/namespaces/{namespace}/services/{service}",
			handlers.ThreeScaleServiceRuleDelete,
			true,
		},
		// swagger:route GET /iter8
		// ---
		// Endpoint to check if threescale adapter is present in the cluster and if user can write adapter config
		//
		//		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: iter8StatusResponse
		{
			"Iter8Info",
			"GET",
			"/api/iter8",
			handlers.Iter8Status,
			true,
		},
		// swagger:route GET /iter8/namespaces/{namespace}/experiments/{name} iter8 getIter8Experiments
		// ---
		// Endpoint to fetch iter8 experiments by namespace and name
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: iter8ExperimentGetDetailResponse
		{
			"Iter8ExperimentsByNamespaceAndName",
			"GET",
			"/api/iter8/namespaces/{namespace}/experiments/{name}",
			handlers.Iter8ExperimentGet,
			true,
		},
		// swagger:route GET /iter8/experiments iter8 iter8Experiments
		// ---
		// Endpoint to fetch iter8 experiments for all namespaces user have access.
		// User can define a comman separated list of namespaces.
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: iter8ExperimentsResponse
		{
			"Iter8Experiments",
			"GET",
			"/api/iter8/experiments",
			handlers.Iter8Experiments,
			true,
		},

		// swagger:route POST /iter8/namespaces/{namespace}/experiments iter8 postIter8Experiments
		// ---
		// Endpoint to create new iter8 experiments for a given namespace.
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: iter8ExperimentGetDetailResponse
		{
			Name:          "Iter8ExperimentCreate",
			Method:        "POST",
			Pattern:       "/api/iter8/namespaces/{namespace}/experiments",
			HandlerFunc:   handlers.Iter8ExperimentCreate,
			Authenticated: true,
		},
		// swagger:route PATCH /iter8/experiments/{namespace}/name/{name} iter8 patchIter8Experiments
		// ---
		// Endpoint to update new iter8 experiment (for abort purpose)
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200: iter8ExperimentGetDetailResponse
		{
			Name:          "Iter8ExperimentsUpdate",
			Method:        "PATCH",
			Pattern:       "/api/iter8/namespaces/{namespace}/experiments/{name}",
			HandlerFunc:   handlers.Iter8ExperimentUpdate,
			Authenticated: true,
		},
		// swagger:route DELETE /iter8/experiments/namespaces/{namespace}/name/{name} iter8 deleteIter8Experiments
		// ---
		// Endpoint to delete   iter8 experiments
		//
		// 		Produces:
		//		- application/json
		//
		//		Schemes: http, https
		//
		// responses:
		//		500: internalError
		//		200
		{
			Name:          "Iter8ExperimentDelete",
			Method:        "DELETE",
			Pattern:       "/api/iter8/namespaces/{namespace}/experiments/{name}",
			HandlerFunc:   handlers.Iter8ExperimentDelete,
			Authenticated: true,
		},
	}

	return
}
