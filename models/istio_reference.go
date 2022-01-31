package models

import (
	"encoding/json"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// IstioReferences represents a sets of different references
type IstioReferences struct {
	// Related Istio objects
	ObjectReferences []IstioReference `json:"objectReferences"`

	// Related Istio objects
	ServiceReferences []ServiceReference `json:"serviceReferences"`

	// Related Istio objects
	WorkloadReferences []WorkloadReference `json:"workloadReferences"`
}

// IstioReference is the key value composed of an Istio ObjectType and Name.
type IstioReference struct {
	ObjectType string `json:"objectType"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
}

// ServiceReference is the key value composed of a Name and Namespace.
type ServiceReference struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
}

// WorkloadReference is the key value composed of a Name and Namespace.
type WorkloadReference struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
}
