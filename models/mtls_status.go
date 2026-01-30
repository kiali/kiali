package models

// MTLSStatus describes the current mTLS status of a mesh entity
type MTLSStatus struct {
	AutoMTLSEnabled bool   `json:"autoMTLSEnabled"`
	Cluster         string `json:"cluster,omitempty"`
	MinTLS          string `json:"minTLS"`
	Namespace       string `json:"namespace,omitempty"`
	// mTLS status: MTLS_ENABLED, MTLS_PARTIALLY_ENABLED, MTLS_NOT_ENABLED, MTLS_DISABLED, UNSET, MTLS_VALIDATION_ERROR
	// required: true
	// example: MTLS_ENABLED
	Status string `json:"status"`
}
