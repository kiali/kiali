package models

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
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// WorkloadReference is the key value composed of a Name and Namespace.
type WorkloadReference struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

func (ir IstioReferences) MergeReferences(references IstioReferences) IstioReferences {
	if ir.ServiceReferences == nil {
		ir.ServiceReferences = make([]ServiceReference, 0, len(references.ServiceReferences))
	}
	ir.ServiceReferences = append(ir.ServiceReferences, references.ServiceReferences...)

	if ir.WorkloadReferences == nil {
		ir.WorkloadReferences = make([]WorkloadReference, 0, len(references.WorkloadReferences))
	}
	ir.WorkloadReferences = append(ir.WorkloadReferences, references.WorkloadReferences...)

	if ir.ObjectReferences == nil {
		ir.ObjectReferences = make([]IstioReference, 0, len(references.ObjectReferences))
	}
	ir.ObjectReferences = append(ir.ObjectReferences, references.ObjectReferences...)

	return ir
}
