package main

import (
	config_common "github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

/////////////////////
// SWAGGER PARAMETERS - GENERAL
// - keep this alphabetized
/////////////////////

// swagger:parameters aggregateMetrics graphAggregate graphAggregateByService
type AggregateParam struct {
	// The aggregate name (label).
	//
	// in: path
	// required: true
	Name string `json:"aggregate"`
}

// swagger:parameters aggregateMetrics graphAggregate graphAggregateByService
type AggregateValueParam struct {
	// The aggregate value (label value).
	//
	// in: path
	// required: true
	Name string `json:"aggregateValue"`
}

// swagger:parameters appMetrics appDetails graphApp graphAppVersion appDashboard appSpans appTraces errorTraces usageMetrics
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

// swagger:parameters graphAggregate graphAggregateByService graphApp graphAppVersion graphService graphWorkload
type ClusterParam struct {
	// The cluster name. If not supplied queries/results will not be constrained by cluster.
	//
	// in: query
	// required: false
	Name string `json:"container"`
}

// swagger:parameters podLogs
type ContainerParam struct {
	// The pod container name. Optional for single-container pod. Otherwise required.
	//
	// in: query
	// required: false
	Name string `json:"container"`
}

// swagger:parameters controlPlaneMetrics
type ControlPlaneParam struct {
	// The control plane for metric collection, etc.
	//
	// in: path
	// required: true
	Name string `json:"controlplane"`
}

// swagger:parameters customDashboard
type DashboardParam struct {
	// The dashboard resource name.
	//
	// in: path
	// required: true
	Name string `json:"dashboard"`
}

// swagger:parameters podLogs
type DurationLogParam struct {
	// Query time-range duration (Golang string duration). Duration starts on
	// `sinceTime` if set, or the time for the first log message if not set.
	//
	// in: query
	// required: false
	Name string `json:"duration"`
}

// swagger:parameters istioConfigCreate istioConfigDetails istioConfigDelete istioConfigUpdate
type GVKGroupParam struct {
	// The GVK group in a group/value/kind specification.
	//
	// in: path
	// required: true
	Name string `json:"group"`
}

// swagger:parameters istioConfigCreate istioConfigDetails istioConfigDelete istioConfigUpdate
type GVKKindParam struct {
	// The GVK kind in a group/value/kind specification.
	//
	// in: path
	// required: true
	Name string `json:"kind"`
}

// swagger:parameters istioConfigCreate istioConfigDetails istioConfigDelete istioConfigUpdate
type GVKVersionParam struct {
	// The GVK version in a group/value/kind specification.
	//
	// in: path
	// required: true
	Name string `json:"version"`
}

// swagger:parameters podProxyLogging
type LoggingParam struct {
	// The log level for the pod's proxy.
	//
	// in: query
	// required: true
	Level ProxyLogLevel `json:"level"`
}

// swagger:parameters istioConfigList workloadDetails workloadUpdate serviceDetails serviceUpdate appSpans serviceSpans workloadSpans appTraces serviceTraces workloadTraces errorTraces workloadValidations serviceMetrics aggregateMetrics appMetrics workloadMetrics istioConfigDetails istioConfigDetailsSubtype istioConfigDelete istioConfigDeleteSubtype istioConfigUpdate istioConfigUpdateSubtype appDetails graphAggregate graphAggregateByService graphApp graphAppVersion graphNamespace graphService graphWorkload namespaceMetrics customDashboard appDashboard serviceDashboard workloadDashboard istioConfigCreate istioConfigCreateSubtype namespaceUpdate namespaceTls podDetails podLogs namespaceValidations podProxyDump podProxyResource podProxyLogging namespaceInfo controlPlaneMetrics ztunnelDashboard ztunnelConfigDump usageMetrics
type NamespacePathParam struct {
	// The namespace name.
	//
	// in: path
	// required: true
	Name string `json:"namespace"`
}

// swagger:parameters serviceList appList workloadList
type NamespaceQueryParam struct {
	// The namespace name.
	//
	// in: query
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

// swagger:parameters istioConfigList istioConfigDetails serviceDetails serviceUpdate
type ValidateParam struct {
	// Enable validation or not
	//
	// in: query
	// required: false
	Name string `json:"validate"`
}

// swagger:parameters podDetails podLogs podProxyDump podProxyResource podProxyLogging ztunnelConfigDump
type PodParam struct {
	// The pod name.
	//
	// in: path
	// required: true
	Name string `json:"pod"`
}

// swagger:parameters podProxyResource
type ResourceParam struct {
	// The discovery service resource
	//
	// in: path
	// required: true
	Name string `json:"resource"`
}

// swagger:parameters serviceDetails serviceUpdate serviceMetrics graphService graphAggregateByService serviceDashboard serviceSpans serviceTraces
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

// swagger:parameters traceDetails
type TraceIDParam struct {
	// The trace ID.
	//
	// in: path
	// required: true
	Name string `json:"traceID"`
}

// swagger:parameters workloadDetails workloadUpdate workloadValidations workloadMetrics graphWorkload workloadDashboard workloadSpans workloadTraces ztunnelDashboard
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
	// Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput].
	//
	// in: query
	// required: false
	// default: aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput
	Name string `json:"appenders"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type BoxByParam struct {
	// Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace].
	//
	// in: query
	// required: false
	Name string `json:"boxBy"`
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

// swagger:parameters graphNamespaces graphService graphWorkload
type GraphTypeParam struct {
	// Graph type. Available graph types: [app, service, versionedApp, workload].
	//
	// in: query
	// required: false
	// default: workload
	Name string `json:"graphType"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphWorkload
type IncludeIdleEdges struct {
	// Flag for including edges that have no request traffic for the time period.
	//
	// in: query
	// required: false
	// default: false
	Name string `json:"includeIdleEdges"`
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

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type RateGrpcParam struct {
	// How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received).
	//
	// in: query
	// required: false
	// default: requests
	Name string `json:"rateGrpc"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type RateHttpParam struct {
	// How to calculate HTTP traffic rate. One of: none | requests.
	//
	// in: query
	// required: false
	// default: requests
	Name string `json:"rateHttp"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type RateTcpParam struct {
	// How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received).
	//
	// in: query
	// required: false
	// default: sent
	Name string `json:"rateTcp"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type ResponseTimeParam struct {
	// Used only with responseTime appender. One of: avg | 50 | 95 | 99.
	//
	// in: query
	// required: false
	// default: 95
	Name string `json:"responseTime"`
}

// swagger:parameters graphApp graphAppVersion graphNamespaces graphService graphWorkload
type ThroughputParam struct {
	// Used only with throughput appender. One of: request | response.
	//
	// in: query
	// required: false
	// default: request
	Name string `json:"throughput"`
}

/////////////////////
// SWAGGER PARAMETERS - METRICS
// - keep this alphabetized
/////////////////////

// swagger:parameters customDashboard
type AdditionalLabelsParam struct {
	// In custom dashboards, additional labels that are made available for grouping in the UI, regardless which aggregations are defined in the MonitoringDashboard CR
	//
	// in: query
	// required: false
	Name string `json:"additionalLabels"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type AvgParam struct {
	// Flag for fetching histogram average. Default is true.
	//
	// in: query
	// required: false
	// default: true
	Name bool `json:"avg"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type ByLabelsParam struct {
	// List of labels to use for grouping metrics (via Prometheus 'by' clause).
	//
	// in: query
	// required: false
	// default: []
	Name []string `json:"byLabels[]"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type DirectionParam struct {
	// Traffic direction: 'inbound' or 'outbound'.
	//
	// in: query
	// required: false
	// default: outbound
	Name string `json:"direction"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type DurationParam struct {
	// Duration of the query period, in seconds.
	//
	// in: query
	// required: false
	// default: 1800
	Name int `json:"duration"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics
type FiltersParam struct {
	// List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names.
	//
	// in: query
	// required: false
	// default: []
	Name []string `json:"filters[]"`
}

// swagger:parameters customDashboard
type LabelsFiltersParam struct {
	// In custom dashboards, labels filters to use when fetching metrics, formatted as key:value pairs. Ex: "app:foo,version:bar".
	//
	// in: query
	// required: false
	//
	Name string `json:"labelsFilters"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type QuantilesParam struct {
	// List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99].
	//
	// in: query
	// required: false
	// default: []
	Name []string `json:"quantiles[]"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type RateFuncParam struct {
	// Prometheus function used to calculate rate: 'rate' or 'irate'.
	//
	// in: query
	// required: false
	// default: rate
	Name string `json:"rateFunc"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type RateIntervalParam struct {
	// Interval used for rate and histogram calculation.
	//
	// in: query
	// required: false
	// default: 1m
	Name string `json:"rateInterval"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type RequestProtocolParam struct {
	// Desired request protocol for the telemetry: For example, 'http' or 'grpc'.
	//
	// in: query
	// required: false
	// default: all protocols
	Name string `json:"requestProtocol"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics appDashboard serviceDashboard workloadDashboard
type ReporterParam struct {
	// Istio telemetry reporter: 'source' or 'destination'.
	//
	// in: query
	// required: false
	// default: source
	Name string `json:"reporter"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics customDashboard appDashboard serviceDashboard workloadDashboard
type StepParam struct {
	// Step between [graph] datapoints, in seconds.
	//
	// in: query
	// required: false
	// default: 15
	Name int `json:"step"`
}

// swagger:parameters serviceMetrics aggregateMetrics appMetrics workloadMetrics
type VersionParam struct {
	// Filters metrics by the specified version
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
type ServiceUnavailableError struct {
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
type SwaggStatusInfoResp struct {
	// in:body
	Body status.StatusInfo
}

// HTTP status code 200 and userGenerated model in data
// swagger:response userSessionData
type SwaggTokenGeneratedResp struct {
	// in:body
	Body authentication.UserSessionData
}

// HTTP status code 200 and graph Config in data
// swagger:response graphResponse
type GraphResponse struct {
	// in:body
	Body config_common.Config
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

// namespaceAppHealthResponse is a map of app name x health
// swagger:response namespaceAppHealthResponse
type NamespaceAppHealthResponse struct {
	// in:body
	Body models.NamespaceAppHealth
}

// namespaceResponse is a basic namespace
// swagger:response namespaceResponse
type NamespaceResponse struct {
	// in:body
	Body models.Namespace
}

// Listing all the information related to a workload
// swagger:response serviceDetailsResponse
type ServiceDetailsResponse struct {
	// in:body
	Body models.ServiceDetails
}

// Listing all the information related to a Trace
// swagger:response traceDetailsResponse
type TraceDetailsResponse struct {
	// in:body
	Body []jaegerModels.Trace
}

// Number of traces in error
// swagger:response errorTracesResponse
type ErrorTracesResponse struct {
	// in:body
	Body int
}

// Listing all the information related to a Span
// swagger:response spansResponse
type SpansResponse struct {
	// in:body
	Body []model.TracingSpan
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
	Body models.MetricsMap
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

// Return all the descriptor data related to Tracing
// swagger:response jaegerInfoResponse
type JaegerInfoResponse struct {
	// in: body
	Body models.TracingInfo
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

// Return the validation status of a specific Namespace
// swagger:response namespaceValidationSummaryResponse
type NamespaceValidationSummaryResponse struct {
	// in:body
	Body models.IstioValidationSummary
}

// Return a dump of the configuration of a given envoy proxy
// swagger:response configDump
type ConfigDumpResponse struct {
	// in:body
	Body models.EnvoyProxyDump
}

// Return a dump of the configuration of a given envoy proxy
// swagger:response configDumpResource
type ConfigDumpResourceResponse struct {
	// in:body
	Body map[string]interface{}
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

// Return caller permissions per namespace and Istio Config type
// swagger:response istioConfigPermissions
type SwaggIstioConfigPermissions struct {
	// in:body
	Body models.IstioConfigPermissions
}

// Return a list of Istio components along its status
// swagger:response istioStatusResponse
type IstioStatusResponse struct {
	// in: body
	Body kubernetes.IstioComponentStatus
}

// Return a list of certificates information
// swagger:response certsInfoResponse
type CertsInfoResponse struct {
	// in: body
	Body []models.CertInfo
}

// Posted parameters for a metrics stats query
// swagger:parameters metricsStats
type MetricsStatsQueryBody struct {
	// in: body
	Body models.MetricsStatsQueries
}

// Response of the metrics stats query
// swagger:response metricsStatsResponse
type MetricsStatsResponse struct {
	// in: body
	Body models.MetricsStats
}

// Response of the tracing info query
// swagger:response tracingInfoResponse
type TracingInfoResponse struct {
	// in: body
	Body models.TracingInfo
}

// Response of the cluster namespace health query
// swagger:response clustersNamespaceHealthResponse
type ClustersNamespaceHealthResponse struct {
	// in: body
	Body models.ClustersNamespaceHealth
}

// Response of the mesh query
// swagger:response meshResponse
type MeshResponse struct {
	// in: body
	Body models.Mesh
}

// Response of the cluster TLS query
// swagger:response clusterTlsResponse
type ClusterTlsResponse struct {
	// in: body
	Body models.MTLSStatus
}

// swagger:enum ProxyLogLevel
type ProxyLogLevel string

const (
	ProxyLogLevelOff      ProxyLogLevel = "off"
	ProxyLogLevelTrace    ProxyLogLevel = "trace"
	ProxyLogLevelDebug    ProxyLogLevel = "debug"
	ProxyLogLevelInfo     ProxyLogLevel = "info"
	ProxyLogLevelWarning  ProxyLogLevel = "warning"
	ProxyLogLevelError    ProxyLogLevel = "error"
	ProxyLogLevelCritical ProxyLogLevel = "critical"
)
