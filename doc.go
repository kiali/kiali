package main

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/services/models"
	"github.com/kiali/kiali/status"
)

/////////////////////
// SWAGGER PARAMETERS
/////////////////////

// A Namespace provide a scope for names.
// This type used to describe a set of objects.
//
// swagger:parameters istioConfigList serviceValidations namespaceValidations objectValidations deploymentList
type NamespaceParam struct {
	// The id of the namespace.
	//
	// in: path
	// required: true
	Name string `json:"namespace"`
}

// Service identify the a service object
//
// swagger:parameters serviceValidations
type ServiceParam struct {
	// The name of the service
	//
	// in: path
	// required: true
	Name string `json:"service"`
}

// Istio Object Type:
//
// swagger:parameters objectValidations
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
// swagger:parameters objectValidations
type ObjectName struct {
	// The name of the istio object
	//
	// in: path
	// required: true
	Name string `json:"object"`
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

// Listing all deployments in the namespace
// swagger:response deploymentListResponse
type DeploymentListResponse struct {
	// in:body
	Body models.Deployments
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
