package main

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/models"
	"github.com/kiali/kiali/status"
)

/////////////////////
// SWAGGER PARAMETERS
/////////////////////

// A Namespace provide a scope for names.
// This type used to describe a set of objects.
//
// swagger:parameters istioConfigList serviceValidations namespaceValidations objectValidations workloadList workloadDetails serviceDetails workloadValidations appList serviceMetrics appMetrics workloadMetrics istioConfigDetails serviceList appDetails
type NamespaceParam struct {
	// The id of the namespace.
	//
	// in: path
	// required: true
	Name string `json:"namespace"`
}

// Service identify the a service object
//
// swagger:parameters serviceValidations serviceDetails serviceMetrics
type ServiceParam struct {
	// The name of the service
	//
	// in: path
	// required: true
	Name string `json:"service"`
}

// Istio Object Type:
//
// swagger:parameters objectValidations istioConfigDetails
type ObjectType struct {
	// The type of the istio object
	//
	// in: path
	// required: true
	// pattern: ^(gateways|virtualservices|destinationrules|serviceentries|rules|quotaspecs|quotaspecbindings)$
	Name string `json:"object_type"`
}

// Istio Object name
//
// swagger:parameters objectValidations istioConfigDetails
type ObjectName struct {
	// The name of the istio object
	//
	// in: path
	// required: true
	Name string `json:"object"`
}

// Workload name
//
// swagger:parameters workloadDetails workloadValidations workloadMetrics
type WorkloadParam struct {
	// The name of the workload
	//
	// in: path
	// required: true
	Name string `json:"workload"`
}

// App name
//
// swagger:parameters appMetrics appDetails
type AppParam struct {
	// The name of the app
	//
	// in: path
	// required: true
	Name string `json:"app"`
}

// Version name
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type VersionParam struct {
	// When provided, filters metrics for a specific version of this service
	//
	// in: query
	// required: false
	Name string `json:"version"`
}

// Step duration
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type StepParam struct {
	// Duration indicating desired step between two datapoints, in seconds
	//
	// in: query
	// required: false
	// default: 15
	Name string `json:"step"`
}

// Duration query period
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type DurationParam struct {
	// Duration indicating desired query period, in seconds
	//
	// in: query
	// required: false
	// default: 1800
	Name string `json:"duration"`
}

// RateInterval for rate and histogram
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type RateIntervalParam struct {
	// Interval used for rate and histogram calculation
	//
	// in: query
	// required: false
	// default: 1m
	Name string `json:"rateInterval"`
}

// RateFunc: rate function
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type RateFuncParam struct {
	// Rate: standard 'rate' or instant 'irate'
	//
	// in: query
	// required: false
	// default: rate
	Name string `json:"rateFunc"`
}

// Filters: list of metrics to fetch
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type FiltersParam struct {
	// List of metrics to fetch. When empty, all metrics are fetched. Expected name here is the Kiali internal metric name
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"filters[]"`
}

// Quantiles: list of quantiles to fetch for histograms
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type QuantilesParam struct {
	// List of quantiles to fetch. Ex: [0.5, 0.95, 0.99]. When empty, no quantile data is fetched.
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"quantiles[]"`
}

// Average: flag to indicate if histogram average should be fetched
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type AvgParam struct {
	// Flag to indicate if histogram average should be fetched. Default is true.
	//
	// in: query
	// required: false
	// default: true
	Name string `json:"avg"`
}

// ByLabelsIn: labels for grouping input metrics
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type ByLabelsInParam struct {
	// List of labels to use for grouping input metrics.
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"byLabelsIn[]"`
}

// ByLabelsOut: labels for grouping output metrics
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type ByLabelsOutParam struct {
	// List of labels to use for grouping output metrics
	//
	// in: query
	// required: false
	// default: []
	Name string `json:"byLabelsOut[]"`
}

// Reporter: source or destination metric reporter
//
// swagger:parameters serviceMetrics appMetrics workloadMetrics
type ReporterParam struct {
	// Reporter: source or destination
	//
	// in: query
	// required: false
	Name string `json:"reporter"`
}

/////////////////////
// SWAGGER RESPONSES
/////////////////////

// A GenericError is the default error message that is generated.
//
// swagger:response genericError
type GenericError struct {
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

// HTTP status code 200 and statusInfo model in data
// swagger:response statusInfo
type swaggStatusInfoResp struct {
	// in:body
	Body status.StatusInfo
}

// HTTP status code 200 and tokenGenerated model in data
// swagger:response tokenGenerated
type swaggTokenGeneratedResp struct {
	// in:body
	Body config.TokenGenerated
}

// HTTP status code 200 and IstioConfigList model in data
// swagger:response istioConfigList
type IstioConfigResponse struct {
	// in:body
	Body models.IstioConfigList
}

// Listing all istio validations for object in the namespace
// swagger:response namespaceValidationsResponse
type NamespaceValidationResponse struct {
	// in:body
	Body NamespaceValidations
}

// Listing all istio validations for object in the namespace
// swagger:response typeValidationsResponse
type ServiceValidationResponse struct {
	// in:body
	Body TypedIstioValidations
}

// Listing all istio validations for object in the namespace
// swagger:response WorkloadValidations
type WorkloadValidationResponse struct {
	// in:body
	Body TypedIstioValidations
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

// Listing all the information related to a service
// swagger:response metricsResponse
type MetricsResponse struct {
	// in:body
	Body prometheus.Metrics
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

//////////////////
// SWAGGER MODELS
//////////////////

// List of validations grouped by namespace
// swagger:model
type NamespaceValidations map[string]TypedIstioValidations

// List of validations grouped by object type
// swagger:model
type TypedIstioValidations map[string]NameIstioValidation

// List of validations grouped by object name
// swagger:model
type NameIstioValidation map[string]models.IstioValidation
