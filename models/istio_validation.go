package models

import (
	"encoding/json"
)

// NamespaceValidations represents a set of IstioValidations grouped by namespace
type NamespaceValidations map[string]IstioValidations

// IstioValidationKey is the key value composed of an Istio ObjectType and Name.
type IstioValidationKey struct {
	ObjectType string
	Name       string
}

// IstioValidations represents a set of IstioValidation grouped by IstioValidationKey.
type IstioValidations map[IstioValidationKey]*IstioValidation

// IstioValidation represents a list of checks associated to an Istio object.
// swagger:model
type IstioValidation struct {
	// Name of the object itself
	// required: true
	// example: reviews
	Name string `json:"name"`

	// Type of the object
	// required: true
	// example: virtualservice
	ObjectType string `json:"objectType"`

	// Represents validity of the object: in case of warning, validity remains as true
	// required: true
	// example: false
	Valid bool `json:"valid"`

	// Array of checks. It might be empty.
	Checks []*IstioCheck `json:"checks"`
}

// IstioCheck represents an individual check.
// swagger:model
type IstioCheck struct {
	// Description of the check
	// required: true
	// example: Weight sum should be 100
	Message string `json:"message"`

	// Indicates the level of importance: error or warning
	// required: true
	// example: error
	Severity string `json:"severity"`

	// String that describes where in the yaml file is the check located
	// example: spec/http[0]/route
	Path string `json:"path"`
}

var ObjectTypeSingular = map[string]string{
	"gateways":          "gateway",
	"virtualservices":   "virtualservice",
	"destinationrules":  "destinationrule",
	"serviceentries":    "serviceentry",
	"rules":             "rule",
	"quotaspecs":        "quotaspec",
	"quotaspecbindings": "quotaspecbinding",
}

func BuildCheck(message, severity, path string) IstioCheck {
	return IstioCheck{Message: message, Severity: severity, Path: path}
}

func (iv IstioValidations) FilterByKey(objectType, name string) IstioValidations {
	fiv := IstioValidations{}
	for k, v := range iv {
		if k.Name == name && k.ObjectType == objectType {
			fiv[k] = v
		}
	}

	return fiv
}

func (iv IstioValidations) MergeValidations(validations IstioValidations) IstioValidations {
	for key, validation := range validations {
		v, ok := iv[key]
		if !ok {
			iv[key] = validation
		} else {
			v.Checks = append(v.Checks, validation.Checks...)
			v.Valid = v.Valid && validation.Valid
		}
	}
	return iv
}

// MarshalJSON implements the json.Marshaler interface.
func (iv IstioValidations) MarshalJSON() ([]byte, error) {
	out := make(map[string]map[string]*IstioValidation)
	for k, v := range iv {
		_, ok := out[k.ObjectType]
		if !ok {
			out[k.ObjectType] = make(map[string]*IstioValidation)
		}
		out[k.ObjectType][k.Name] = v
	}
	return json.Marshal(out)
}
