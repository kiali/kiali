package models

// A MTLSStatus describes the current mTLS status of a mesh entity
// As an entity we have: the mesh itself, a namespace or a service
type MTLSStatus struct {
	// Status only can have the following values:
	// ENABLED, PARTIALLY_ENABLED, DISABLED
	Status string `json:"name"`
}
