package models

import (
	"github.com/kiali/kiali/prometheus"
)

// NamespaceAppHealth is an alias of map of app name x health
type NamespaceAppHealth map[string]*AppHealth

// NamespaceServiceHealth is an alias of map of service name x health
type NamespaceServiceHealth map[string]*ServiceHealth

// NamespaceWorkloadHealth is an alias of map of workload name x health
type NamespaceWorkloadHealth map[string]*WorkloadHealth

// ServiceHealth contains aggregated health from various sources, for a given service
type ServiceHealth struct {
	Envoy    prometheus.EnvoyServiceHealth `json:"envoy"`
	Requests RequestHealth                 `json:"requests"`
}

// AppHealth contains aggregated health from various sources, for a given app
type AppHealth struct {
	Envoy            []EnvoyHealthWrapper `json:"envoy"`
	WorkloadStatuses []WorkloadStatus     `json:"workloadStatuses"`
	Requests         RequestHealth        `json:"requests"`
}

// EmptyAppHealth create an empty AppHealth
func EmptyAppHealth() AppHealth {
	return AppHealth{
		Envoy:            []EnvoyHealthWrapper{},
		WorkloadStatuses: []WorkloadStatus{},
		Requests:         RequestHealth{},
	}
}

// WorkloadHealth contains aggregated health from various sources, for a given workload
type WorkloadHealth struct {
	WorkloadStatus WorkloadStatus `json:"workloadStatus"`
	Requests       RequestHealth  `json:"requests"`
}

// EnvoyHealthWrapper wraps EnvoyServiceHealth with the service name
type EnvoyHealthWrapper struct {
	prometheus.EnvoyServiceHealth
	Service string `json:"service"`
}

// WorkloadStatus gives the available / total replicas in a deployment of a pod
type WorkloadStatus struct {
	Name              string `json:"name"`
	Replicas          int32  `json:"replicas"`
	AvailableReplicas int32  `json:"available"`
}

// RequestHealth holds several stats about recent request errors
type RequestHealth struct {
	RequestCount      float64 `json:"requestCount"`
	RequestErrorCount float64 `json:"requestErrorCount"`
}
