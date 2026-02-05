package models

// ServiceLatency represents a single service's latency measurement
type ServiceLatency struct {
	Cluster     string  `json:"cluster"`
	Namespace   string  `json:"namespace"`
	ServiceName string  `json:"serviceName"`
	Latency     float64 `json:"latency"` // in milliseconds
}

// ServiceLatencyResponse contains the sorted list of service latencies
type ServiceLatencyResponse struct {
	Services []ServiceLatency `json:"services"`
}
