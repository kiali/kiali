package models

// Health contains aggregated health from various sources, for a given service
type Health struct {
	Envoy              EnvoyHealth        `json:"envoy"`
	DeploymentStatuses []DeploymentStatus `json:"deploymentStatuses"`
}

// EnvoyHealth is the number of healthy versus total membership (ie. replicas) inside envoy cluster (ie. service)
type EnvoyHealth struct {
	Healthy int `json:"healthy"`
	Total   int `json:"total"`
}

// DeploymentStatus gives the available / total replicas in a deployment of a pod
type DeploymentStatus struct {
	Name              string `json:"name"`
	Replicas          int32  `json:"replicas"`
	AvailableReplicas int32  `json:"available"`
}
