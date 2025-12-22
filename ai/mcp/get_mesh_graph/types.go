package get_mesh_graph

// MeshHealthSummary represents aggregated health across the mesh
type MeshHealthSummary struct {
	OverallStatus    string                      `json:"overallStatus"` // HEALTHY, DEGRADED, UNHEALTHY
	Availability     float64                     `json:"availability"`  // Percentage 0-100
	TotalErrorRate   float64                     `json:"totalErrorRate"`
	NamespaceCount   int                         `json:"namespaceCount"`
	EntityCounts     EntityHealthCounts          `json:"entityCounts"`
	NamespaceSummary map[string]NamespaceSummary `json:"namespaceSummary"`
	TopUnhealthy     []UnhealthyEntity           `json:"topUnhealthy,omitempty"`
	Timestamp        string                      `json:"timestamp"`
	RateInterval     string                      `json:"rateInterval"`
}

// EntityHealthCounts contains health counts for all entity types
type EntityHealthCounts struct {
	Apps      HealthCounts `json:"apps"`
	Services  HealthCounts `json:"services"`
	Workloads HealthCounts `json:"workloads"`
}

// HealthCounts represents health status counts
type HealthCounts struct {
	Total     int `json:"total"`
	Healthy   int `json:"healthy"`
	Degraded  int `json:"degraded"`
	Unhealthy int `json:"unhealthy"`
	NotReady  int `json:"notReady"`
}

// NamespaceSummary contains health summary for a namespace
type NamespaceSummary struct {
	Status       string       `json:"status"`
	Availability float64      `json:"availability"`
	ErrorRate    float64      `json:"errorRate"`
	Apps         HealthCounts `json:"apps"`
	Services     HealthCounts `json:"services"`
	Workloads    HealthCounts `json:"workloads"`
}

// UnhealthyEntity represents an unhealthy entity
type UnhealthyEntity struct {
	Type      string  `json:"type"` // app, service, workload
	Namespace string  `json:"namespace"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Issue     string  `json:"issue"`
	ErrorRate float64 `json:"errorRate,omitempty"`
}
