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
	Severity SeverityLevel `json:"severity"`

	// String that describes where in the yaml file is the check located
	// example: spec/http[0]/route
	Path string `json:"path"`
}

type SeverityLevel string

const (
	ErrorSeverity   SeverityLevel = "error"
	WarningSeverity SeverityLevel = "warning"
	Unknown         SeverityLevel = "unknown"
)

var ObjectTypeSingular = map[string]string{
	"gateways":            "gateway",
	"virtualservices":     "virtualservice",
	"destinationrules":    "destinationrule",
	"serviceentries":      "serviceentry",
	"rules":               "rule",
	"quotaspecs":          "quotaspec",
	"quotaspecbindings":   "quotaspecbinding",
	"meshpolicies":        "meshpolicy",
	"policies":            "policy",
	"serviceroles":        "servicerole",
	"servicerolebindings": "servicerolebinding",
	"clusterrbacconfigs":  "clusterrbacconfig",
}

var checkDescriptors = map[string]IstioCheck{
	"destinationrules.multimatch": {
		Message:  "More than one DestinationRules for the same host subset combination",
		Severity: WarningSeverity,
	},
	"destinationrules.nodest.matchingregistry": {
		Message:  "This host has no matching entry in the service registry (service, workload or service entries)",
		Severity: ErrorSeverity,
	},
	"destinationrules.nodest.subsetlabels": {
		Message:  "This subset's labels are not found in any matching host",
		Severity: ErrorSeverity,
	},
	"destinationrules.trafficpolicy.notlssettings": {
		Message:  "mTLS settings of a non-local Destination Rule are overridden",
		Severity: WarningSeverity,
	},
	"destinationrules.mtls.meshpolicymissing": {
		Message:  "MeshPolicy enabling mTLS is missing",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.nspolicymissing": {
		Message:  "Policy enabling namespace-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.policymtlsenabled": {
		Message:  "Policy with TLS strict mode found, it should be permissive",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.meshpolicymtlsenabled": {
		Message:  "MeshPolicy enabling mTLS found, permissive policy is needed",
		Severity: ErrorSeverity,
	},
	"gateways.multimatch": {
		Message:  "More than one Gateway for the same host port combination",
		Severity: WarningSeverity,
	},
	"gateways.selector": {
		Message:  "No matching workload found for gateway selector in this namespace",
		Severity: WarningSeverity,
	},
	"port.name.mismatch": {
		Message:  "Port name must follow <protocol>[-suffix] form",
		Severity: ErrorSeverity,
	},
	"virtualservices.nogateway": {
		Message:  "VirtualService is pointing to a non-existent gateway",
		Severity: ErrorSeverity,
	},
	"virtualservices.nohost.hostnotfound": {
		Message:  "DestinationWeight on route doesn't have a valid service (host not found)",
		Severity: ErrorSeverity,
	},
	"virtualservices.nohost.invalidprotocol": {
		Message:  "VirtualService doesn't define any valid route protocol",
		Severity: ErrorSeverity,
	},
	"virtualservices.route.numericweight": {
		Message:  "Weight must be a number",
		Severity: ErrorSeverity,
	},
	"virtualservices.route.weightrange": {
		Message:  "Weight should be between 0 and 100",
		Severity: ErrorSeverity,
	},
	"virtualservices.route.weightsum": {
		Message:  "Weight sum should be 100",
		Severity: ErrorSeverity,
	},
	"virtualservices.route.allweightspresent": {
		Message:  "All routes should have weight",
		Severity: WarningSeverity,
	},
	"virtualservices.singlehost": {
		Message:  "More than one Virtual Service for same host",
		Severity: WarningSeverity,
	},
	"virtualservices.subsetpresent.destinationmandatory": {
		Message:  "Destination field is mandatory",
		Severity: ErrorSeverity,
	},
	"virtualservices.subsetpresent.subsetnotfound": {
		Message:  "Subset not found",
		Severity: WarningSeverity,
	},
	"meshpolicies.mtls.destinationrulemissing": {
		Message:  "Mesh-wide Destination Rule enabling mTLS is missing",
		Severity: ErrorSeverity,
	},
	"servicerole.invalid.services": {
		Message:  "Unable to find all the defined services",
		Severity: ErrorSeverity,
	},
	"servicerole.invalid.namespace": {
		Message:  "ServiceRole can only point to current namespace",
		Severity: ErrorSeverity,
	},
	"servicerolebinding.invalid.role": {
		Message:  "ServiceRole does not exists in this namespace",
		Severity: ErrorSeverity,
	},
	"policies.mtls.destinationrulemissing": {
		Message:  "Destination Rule enabling namespace-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"service.deployment.port.mismatch": {
		Message:  "Service port and deployment port do not match",
		Severity: ErrorSeverity,
	},
	"validation.unable.cross-namespace": {
		Message:  "Unable to verify the validity, cross-namespace validation is not supported for this field",
		Severity: Unknown,
	},
}

func Build(checkId string, path string) IstioCheck {
	check := checkDescriptors[checkId]
	check.Path = path
	return check
}

func BuildKey(objectType, name string) IstioValidationKey {
	return IstioValidationKey{ObjectType: objectType, Name: name}
}

func CheckMessage(checkId string) string {
	return checkDescriptors[checkId].Message
}

func (iv IstioValidations) FilterBySingleType(objectType, name string) IstioValidations {
	fiv := IstioValidations{}
	for k, v := range iv {
		// We don't want to filter other types
		if k.ObjectType != objectType {
			fiv[k] = v
		} else {
			// But for this exact type we're strict
			if k.Name == name {
				fiv[k] = v
			}
		}
	}

	return fiv
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

// FilterByTypes takes an input as ObjectTypes, transforms to singular types and filters the validations
func (iv IstioValidations) FilterByTypes(objectTypes []string) IstioValidations {
	types := make(map[string]bool, len(objectTypes))
	for _, objectType := range objectTypes {
		types[ObjectTypeSingular[objectType]] = true
	}
	fiv := IstioValidations{}
	for k, v := range iv {
		if _, found := types[k.ObjectType]; found {
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
		AddUnique:
			for _, toAdd := range validation.Checks {
				for _, existing := range v.Checks {
					if toAdd.Path == existing.Path &&
						toAdd.Severity == existing.Severity &&
						toAdd.Message == existing.Message {
						continue AddUnique
					}
				}
				v.Checks = append(v.Checks, toAdd)
			}
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
