package main

import (
	"github.com/kiali/kiali/graph/config/cytoscape"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/status"
)

/////////////////////
// SWAGGER PARAMETERS - GENERAL
// - keep this alphabetized
/////////////////////

// swagger:parameters appMetrics appDetails graphApp graphAppVersion appDashboard customDashboard
type AppParam struct {
	// The app name (label value).
	//
	// in: path
	// required: true
	Name string `json:"app"`
}

// swagger:parameters graphAppVersion
type AppVersionParam struct {
	// The app version (label value).
	//
	// in: path
	// required: false
	Name string `json:"version"`
}

// swagger:parameters podLogs
type ContainerParam struct {
	// The pod container name. Optional for single-container pod. Otherwise required.
	//
	// in: query
	// required: false
	Name string `json:"container"`
}

// swagger:parameters istioConfigList workloadList workloadDetails serviceDetails workloadValidations appList serviceMetrics appMetrics workloadMetrics istioConfigDetails istioConfigDetailsSubtype istioConfigDelete istioConfigDeleteSubtype istioConfigUpdate istioConfigUpdateSubtype serviceList appDetails graphApp graphAppVersion graphNamespace graphService graphWorkload namespaceMetrics customDashboard appDashboard serviceDashboard workloadDashboard istioConfigCreate istioConfigCreateSubtype namespaceTls podDetails podLogs getThreeScaleService postThreeScaleService patchThreeScaleService deleteThreeScaleService
type NamespaceParam struct {
	// The namespace name.
	//
	// in: path
	// required: true
	Name string `json:"namespace"`
}

// swagger:parameters istioConfigDetails istioConfigDetailsSubtype istioConfigDelete istioConfigDeleteSubtype istioConfigUpdate istioConfigUpdateSubtype
type ObjectNameParam struct {
	// The Istio object name.
	//
	// in: path
	// required: true
	Name string `json:"object"`
}

// swagger:parameters istioConfigDetails istioConfigDetailsSubtype istioConfigDelete istioConfigDeleteSubtype istioConfigUpdate istioConfigUpdateSubtype istioConfigCreate istioConfigCreateSubtype
type ObjectTypeParam struct {
	// The Istio object type.
	//
	// in: path
	// required: true
	// pattern: ^(gateways|virtualservices|destinationrules|serviceentries|rules|quotaspecs|quotaspecbindings)$
	Name string `json:"object_type"`
}

// swagger:parameters istioConfigDetailsSubtype istioConfigDeleteSubtype istioConfigUpdateSubtype istioConfigCreateSubtype
type ObjectSubtypeParam struct {
	// The Istio object subtype.
	//
	// in: path
	// required: true
	Name string `json:"object_subtype"`
}

// swagger:parameters podDetails podLogs
type PodParam struct {
	// The pod name.
	//
	// in: path
	// required: true
	Name string `json:"pod"`
}

// swagger:parameters serviceDetails serviceMetrics graphService serviceDashboard getThreeScaleService patchThreeScaleService deleteThreeScaleService
type ServiceParam struct {
	// The service name.
	//
	// in: path
	// required: true
	Name string `json:"service"`
}

// swagger:parameters podLogs
type SinceTimeParam struct {
	// The start time for fetching logs. UNIX time in seconds. Default is all logs.
	//
	// in: query
	// required: false
	Name string `json:"sinceTime"`
}

// swagger:parameters customDashboard
type TemplateParam struct {
	// The dashboard template name.
	//
	// in: path
	// required: true
	Name string `json:"template"`
}

// swagger:parameters workloadDetails workloadValidations workloadMetrics graphWorkload workloadDashboard
type WorkloadParam struct {
	// The workload name.
	//
	// in: path
	// required: true
	Name string `json:"workload"`
}

/////////////////////
// SWAGGER PARAMETERS - GRAPH
// - keep this alphabetized
/////////////////////

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type AppendersParam struct {
	// Comma-separated list of Appenders to run. Available appenders: [deadNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, unusedNode].
	//
	// in: query
	// required: false
	// default: run all appenders
	Name string `json:"appenders"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type DurationGraphParam struct {
	// Query time-range duration (Golang string duration).
	//
	// in: query
	// required: false
	// default: 10m
	Name string `json:"duration"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type GraphTypeParam struct {
	// Graph type. Available graph types: [app, service, versionedApp, workload].
	//
	// in: query
	// required: false
	// default: workload
	Name string `json:"graphType"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type GroupByParam struct {
	// App box grouping characteristic. Available groupings: [app, none, version].
	//
	// in: query
	// required: false
	// default: none
	Name string `json:"groupBy"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type IncludeIstioParam struct {
	// Flag for including istio-system (infra) services. Ignored if namespace is istio-system.
	//
	// in: query
	// required: false
	// default: false
	Name string `json:"includeIstio"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphWorkload
type InjectServiceNodes struct {
	// Flag for injecting the requested service node between source and destination nodes.
	//
	// in: query
	// required: false
	// default: false
	Name string `json:"injectServiceNodes"`
}

// swagger:parameters graphNamespaces
type NamespacesParam struct {
	// Comma-separated list of namespaces to include in the graph. The namespaces must be accessible to the client.
	//
	// in: query
	// required: true
	Name string `json:"namespaces"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type QueryTimeParam struct {
	// Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now.
	//
	// in: query
	// required: false
	// default: now
	Name string `json:"queryTime"`
}

/////////////////////
// SWAGGER PARAMETERS - METRICS
// - keep this alphabetized
/////////////////////

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type AvgParam struct {
	// Flag for fetching histogram average. Default is true.
	//
	// in: query
	// required: false
	// default: true
	Name string `json:"avg"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type ByLabelsParam struct {
	// List of labels to use for grouping metrics (via Prometheus 'by' clause).
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"byLabels[]"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type DirectionParam struct {
	// Traffic direction: 'inbound' or 'outbound'.
	//
	// in: query
	// required: false
	// default: outbound
	Name string `json:"direction"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type DurationParam struct {
	// Duration of the query period, in seconds.
	//
	// in: query
	// required: false
	// default: 1800
	Name string `json:"duration"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics
type FiltersParam struct {
	// List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names.
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"filters[]"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type QuantilesParam struct {
	// List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99].
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"quantiles[]"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type RateFuncParam struct {
	// Prometheus function used to calculate rate: 'rate' or 'irate'.
	//
	// in: query
	// required: false
	// default: rate
	Name string `json:"rateFunc"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type RateIntervalParam struct {
	// Interval used for rate and histogram calculation.
	//
	// in: query
	// required: false
	// default: 1m
	Name string `json:"rateInterval"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type RequestProtocolParam struct {
	// Desired request protocol for the telemetry: For example, 'http' or 'grpc'.
	//
	// in: query
	// required: false
	// default: all protocols
	Name string `json:"requestProtocol"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type ReporterParam struct {
	// Istio telemetry reporter: 'source' or 'destination'.
	//
	// in: query
	// required: false
	// default: source
	Name string `json:"reporter"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type StepParam struct {
	// Step between [graph] datapoints, in seconds.
	//
	// in: query
	// required: false
	// default: 15
	Name string `json:"step"`
}

// swagger:parameters serviceMetrics appMetrics workloadMetrics customDashboard
type VersionParam struct {
	// Filters metrics by the specified version.
	//
	// in: query
	// required: false
	Name string `json:"version"`
}

/////////////////////
// SWAGGER RESPONSES
/////////////////////

// NoContent: the response is empty
// swagger:response noContent
type NoContent struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 204
		// default: 204
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// BadRequestError: the client request is incorrect
//
// swagger:response badRequestError
type BadRequestError struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 400
		// default: 400
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// A NotFoundError is the error message that is generated when server could not find what was requested.
//
// swagger:response notFoundError
type NotFoundError struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 404
		// default: 404
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// A NotAcceptable is the error message that means request can't be accepted
//
// swagger:response notAcceptableError
type NotAcceptableError struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 404
		// default: 404
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// A Internal is the error message that means something has gone wrong
//
// swagger:response internalError
type InternalError struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 500
		// default: 500
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// A Internal is the error message that means something has gone wrong
//
// swagger:response serviceUnavailableError
type serviceUnavailableError struct {
	// in: body
	Body struct {
		// HTTP status code
		// example: 503
		// default: 503
		Code    int32 `json:"code"`
		Message error `json:"message"`
	} `json:"body"`
}

// HTTP status code 200 and statusInfo model in data
// swagger:response statusInfo
type swaggStatusInfoResp struct {
	// in:body
	Body status.StatusInfo
}

// HTTP status code 200 and tokenGenerated model in data
// swagger:response tokenResponse
type swaggTokenGeneratedResp struct {
	// in:body
	Body handlers.TokenResponse
}

// HTTP status code 200 and cytoscapejs Config in data
// swagger:response graphResponse
type GraphResponse struct {
	// in:body
	Body cytoscape.Config
}

// HTTP status code 200 and IstioConfigList model in data
// swagger:response istioConfigList
type IstioConfigResponse struct {
	// in:body
	Body models.IstioConfigList
}

// Listing all services in the namespace
// swagger:response serviceListResponse
type ServiceListResponse struct {
	// in:body
	Body models.ServiceList
}

// Listing all workloads in the namespace
// swagger:response workloadListResponse
type WorkloadListResponse struct {
	// in:body
	Body models.WorkloadList
}

// Listing all apps in the namespace
// swagger:response appListResponse
type AppListResponse struct {
	// in:body
	Body models.AppList
}

// serviceHealthResponse contains aggregated health from various sources, for a given service
// swagger:response serviceHealthResponse
type serviceHealthResponse struct {
	// in:body
	Body models.ServiceHealth
}

// appHealthResponse contains aggregated health from various sources, for a given app
// swagger:response appHealthResponse
type appHealthResponse struct {
	// in:body
	Body models.AppHealth
}

// workloadHealthResponse contains aggregated health from various sources, for a given workload
// swagger:response workloadHealthResponse
type workloadHealthResponse struct {
	// in:body
	Body models.WorkloadHealth
}

// namespaceAppHealthResponse is a map of app name x health
// swagger:response namespaceAppHealthResponse
type namespaceAppHealthResponse struct {
	// in:body
	Body models.NamespaceAppHealth
}

// Listing all the information related to a workload
// swagger:response serviceDetailsResponse
type ServiceDetailsResponse struct {
	// in:body
	Body models.ServiceDetails
}

// Listing all the information related to a workload
// swagger:response workloadDetails
type WorkloadDetailsResponse struct {
	// in:body
	Body models.Workload
}

// Metrics response model
// swagger:response metricsResponse
type MetricsResponse struct {
	// in:body
	Body prometheus.Metrics
}

// Dashboard response model
// swagger:response dashboardResponse
type DashboardResponse struct {
	// in:body
	Body models.MonitoringDashboard
}

// IstioConfig details of an specific Istio Object
// swagger:response istioConfigDetailsResponse
type IstioConfigDetailsResponse struct {
	// in:body
	Body models.IstioConfigDetails
}

// Detailed information of an specific app
// swagger:response appDetails
type AppDetailsResponse struct {
	// in:body
	Body models.App
}

// List of Namespaces
// swagger:response namespaceList
type NamespaceListResponse struct {
	// in:body
	Body []models.Namespace
}

// Return all the descriptor data related to Grafana
// swagger:response grafanaInfoResponse
type GrafanaInfoResponse struct {
	// in: body
	Body models.GrafanaInfo
}

// Return all the descriptor data related to Grafana
// swagger:response jaegerInfoResponse
type JaegerInfoResponse struct {
	// in: body
	Body models.JaegerInfo
}

// Return the information necessary to handle login
// swagger:response authenticationInfo
type AuthenticationInfoResponse struct {
	Strategy              string
	AuthorizationEndpoint string
}

// Return the mTLS status of the whole Mesh
// swagger:response meshTlsResponse
type MeshTlsResponse struct {
	// in:body
	Body models.MTLSStatus
}

// Return the mTLS status of a specific Namespace
// swagger:response namespaceTlsResponse
type NamespaceTlsResponse struct {
	// in:body
	Body models.MTLSStatus
}

//////////////////
// SWAGGER MODELS
//////////////////

// List of validations grouped by object type
// swagger:model
type TypedIstioValidations map[string]NameIstioValidation

// List of validations grouped by object name
// swagger:model
type NameIstioValidation map[string]models.IstioValidation

// Return if ThreeScale adapter is enabled in Istio and if user has permissions to write adapter's configuration
// swagger:response threeScaleInfoResponse
type ThreeScaleInfoResponse struct {
	// in: body
	Body models.ThreeScaleInfo
}

// List of ThreeScale handlers created from Kiali to be used in the adapter's configuration
// swagger:response threeScaleHandlersResponse
type ThreeScaleGetHandlersResponse struct {
	// in: body
	Body models.ThreeScaleHandlers
}

// swagger:parameters patchThreeScaleHandler deleteThreeScaleHandler
type ThreScaleHandlerNameParam struct {
	// The ThreeScaleHandler name.
	//
	// in: path
	// required: true
	Name string `json:"threescaleHandlerName"`
}

// Return Threescale rule definition for a given service
// swagger:response threeScaleRuleResponse
type ThreeScaleGetRuleResponse struct {
	// in: body
	Body models.ThreeScaleServiceRule
}
