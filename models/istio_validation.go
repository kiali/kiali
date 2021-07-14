package models

import (
	"encoding/json"
)

// NamespaceValidations represents a set of IstioValidations grouped by namespace
type NamespaceValidations map[string]IstioValidations

// IstioValidationKey is the key value composed of an Istio ObjectType and Name.
type IstioValidationKey struct {
	ObjectType string `json:"objectType"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
}

// IstioValidationSummary represents the number of errors/warnings of a set of Istio Validations.
type IstioValidationSummary struct {
	// Number of validations with error severity
	// required: true
	// example: 2
	Errors int `json:"errors"`
	// Number of Istio Objects analyzed
	// required: true
	// example: 6
	ObjectCount int `json:"objectCount"`
	// Number of validations with warning severity
	// required: true
	// example: 4
	Warnings int `json:"warnings"`
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

	// Related objects (only validation errors)
	References []IstioValidationKey `json:"references"`
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
	"gateways":               "gateway",
	"virtualservices":        "virtualservice",
	"destinationrules":       "destinationrule",
	"serviceentries":         "serviceentry",
	"rules":                  "rule",
	"quotaspecs":             "quotaspec",
	"quotaspecbindings":      "quotaspecbinding",
	"policies":               "policy",
	"serviceroles":           "servicerole",
	"servicerolebindings":    "servicerolebinding",
	"clusterrbacconfigs":     "clusterrbacconfig",
	"authorizationpolicies":  "authorizationpolicy",
	"sidecars":               "sidecar",
	"peerauthentications":    "peerauthentication",
	"requestauthentications": "requestauthentication",
}

var checkDescriptors = map[string]IstioCheck{
	"authorizationpolicy.source.namespacenotfound": {
		Message:  "KIA0101 Namespace not found for this rule",
		Severity: WarningSeverity,
	},
	"authorizationpolicy.to.wrongmethod": {
		Message:  "KIA0102 Only HTTP methods and fully-qualified gRPC names are allowed",
		Severity: WarningSeverity,
	},
	"authorizationpolicy.nodest.matchingregistry": {
		Message:  "KIA0104 This host has no matching entry in the service registry",
		Severity: ErrorSeverity,
	},
	"authorizationpolicy.mtls.needstobeenabled": {
		Message:  "KIA0105 This field requires mTLS to be enabled",
		Severity: ErrorSeverity,
	},
	"destinationrules.multimatch": {
		Message:  "KIA0201 More than one DestinationRules for the same host subset combination",
		Severity: WarningSeverity,
	},
	"destinationrules.nodest.matchingregistry": {
		Message:  "KIA0202 This host has no matching entry in the service registry (service, workload or service entries)",
		Severity: ErrorSeverity,
	},
	"destinationrules.nodest.subsetlabels": {
		Message:  "KIA0203 This subset's labels are not found in any matching host",
		Severity: ErrorSeverity,
	},
	"destinationrules.trafficpolicy.notlssettings": {
		Message:  "KIA0204 mTLS settings of a non-local Destination Rule are overridden",
		Severity: WarningSeverity,
	},
	"destinationrules.mtls.meshpolicymissing": {
		Message:  "KIA0205 PeerAuthentication enabling mTLS at mesh level is missing",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.nspolicymissing": {
		Message:  "KIA0206 PeerAuthentication enabling namespace-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.policymtlsenabled": {
		Message:  "KIA0207 PeerAuthentication with TLS strict mode found, it should be permissive",
		Severity: ErrorSeverity,
	},
	"destinationrules.mtls.meshpolicymtlsenabled": {
		Message:  "KIA0208 PeerAuthentication enabling mTLS found, permissive mode needed",
		Severity: ErrorSeverity,
	},
	"destinationrules.nodest.subsetnolabels": {
		Message:  "KIA0209 This subset has not labels",
		Severity: WarningSeverity,
	},
	"gateways.multimatch": {
		Message:  "KIA0301 More than one Gateway for the same host port combination",
		Severity: WarningSeverity,
	},
	"gateways.selector": {
		Message:  "KIA0302 No matching workload found for gateway selector in this namespace",
		Severity: WarningSeverity,
	},
	"generic.multimatch.selectorless": {
		Message:  "KIA0002 More than one selector-less object in the same namespace",
		Severity: ErrorSeverity,
	},
	"generic.multimatch.selector": {
		Message:  "KIA0003 More than one object applied to the same workload",
		Severity: ErrorSeverity,
	},
	"generic.selector.workloadnotfound": {
		Message:  "KIA0004 No matching workload found for the selector in this namespace",
		Severity: WarningSeverity,
	},
	"peerauthentication.mtls.destinationrulemissing": {
		Message:  "KIA0401 Mesh-wide Destination Rule enabling mTLS is missing",
		Severity: ErrorSeverity,
	},
	"peerauthentications.mtls.destinationrulemissing": {
		Message:  "KIA0501 Destination Rule enabling namespace-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"peerauthentications.mtls.disabledestinationrulemissing": {
		Message:  "KIA0505 Destination Rule disabling namespace-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"peerauthentications.mtls.disablemeshdestinationrulemissing": {
		Message:  "KIA0506 Destination Rule disabling mesh-wide mTLS is missing",
		Severity: ErrorSeverity,
	},
	"port.name.mismatch": {
		Message:  "KIA0601 Port name must follow <protocol>[-suffix] form",
		Severity: ErrorSeverity,
	},
	"service.deployment.port.mismatch": {
		Message:  "KIA0701 Deployment exposing same port as Service not found",
		Severity: WarningSeverity,
	},
	"servicerole.invalid.services": {
		Message:  "KIA0901 Unable to find all the defined services",
		Severity: ErrorSeverity,
	},
	"servicerole.invalid.namespace": {
		Message:  "KIA0902 ServiceRole can only point to current namespace",
		Severity: ErrorSeverity,
	},
	"servicerolebinding.invalid.role": {
		Message:  "KIA0903 ServiceRole does not exists in this namespace",
		Severity: ErrorSeverity,
	},
	"sidecar.egress.invalidhostformat": {
		Message:  "KIA1003 Invalid host format. 'namespace/dnsName' format expected",
		Severity: ErrorSeverity,
	},
	"sidecar.egress.servicenotfound": {
		Message:  "KIA1004 This host has no matching entry in the service registry",
		Severity: WarningSeverity,
	},
	"sidecar.global.selector": {
		Message:  "KIA1006 Global default sidecar should not have workloadSelector",
		Severity: WarningSeverity,
	},
	"virtualservices.gateway.oldnomenclature": {
		Message:  "KIA1108 Preferred nomenclature: <gateway namespace>/<gateway name>",
		Severity: Unknown,
	},
	"virtualservices.nohost.hostnotfound": {
		Message:  "KIA1101 DestinationWeight on route doesn't have a valid service (host not found)",
		Severity: ErrorSeverity,
	},
	"virtualservices.nogateway": {
		Message:  "KIA1102 VirtualService is pointing to a non-existent gateway",
		Severity: ErrorSeverity,
	},
	"virtualservices.nohost.invalidprotocol": {
		Message:  "KIA1103 VirtualService doesn't define any valid route protocol",
		Severity: ErrorSeverity,
	},
	"virtualservices.route.singleweight": {
		Message:  "KIA1104 The weight is assumed to be 100 because there is only one route destination",
		Severity: WarningSeverity,
	},
	"virtualservices.route.repeatedsubset": {
		Message:  "KIA1105 This subset is already referenced in another route destination",
		Severity: WarningSeverity,
	},
	"virtualservices.singlehost": {
		Message:  "KIA1106 More than one Virtual Service for same host",
		Severity: WarningSeverity,
	},
	"virtualservices.subsetpresent.subsetnotfound": {
		Message:  "KIA1107 Subset not found",
		Severity: WarningSeverity,
	},
	"validation.unable.cross-namespace": {
		Message:  "KIA0001 Unable to verify the validity, cross-namespace validation is not supported for this field",
		Severity: Unknown,
	},
}

func Build(checkId string, path string) IstioCheck {
	check := checkDescriptors[checkId]
	check.Path = path
	return check
}

func BuildKey(objectType, name, namespace string) IstioValidationKey {
	return IstioValidationKey{ObjectType: objectType, Namespace: namespace, Name: name}
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
		AddUniqueReference:
			for _, toAdd := range validation.References {
				for _, existing := range v.References {
					if toAdd == existing {
						continue AddUniqueReference
					}
				}
				v.References = append(v.References, toAdd)
			}
		}
	}
	return iv
}

func (iv IstioValidations) MergeReferences(validations IstioValidations) IstioValidations {
	for _, currentValidations := range iv {
		if currentValidations.References == nil {
			currentValidations.References = make([]IstioValidationKey, 0, len(validations))
		}
		for k := range validations {
			currentValidations.References = append(currentValidations.References, k)
		}
	}

	return iv
}

func (iv IstioValidations) SummarizeValidation(ns string) IstioValidationSummary {
	ivs := IstioValidationSummary{}
	for k, v := range iv {
		if k.Namespace == ns {
			ivs.mergeSummaries(v.Checks)
		}
	}
	return ivs
}

func (summary *IstioValidationSummary) mergeSummaries(cs []*IstioCheck) {
	for _, c := range cs {
		if c.Severity == ErrorSeverity {
			summary.Errors += 1
		} else if c.Severity == WarningSeverity {
			summary.Warnings += 1
		}
	}
	summary.ObjectCount += 1
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
