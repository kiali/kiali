package models

// MTLSStatus describes the current mTLS status of a mesh entity
type MTLSStatus struct {
	// mTLS status: MTLS_ENABLED, MTLS_PARTIALLY_ENABLED, MTLS_NOT_ENABLED
	// required: true
	// example: MTLS_ENABLED
	Status          string `json:"status"`
	AutoMTLSEnabled bool   `json:"autoMTLSEnabled"`
	MinTLS          string `json:"minTLS"`
}
