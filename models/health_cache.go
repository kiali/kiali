package models

import (
	"time"
)

// CachedHealthData stores pre-computed health data for a namespace with metadata
type CachedHealthData struct {
	// AppHealth stores health for all apps in a namespace
	// Key is app name
	AppHealth NamespaceAppHealth `json:"appHealth,omitempty"`

	// Cluster is the cluster this health data is for
	Cluster string `json:"cluster"`

	// ComputedAt is when this health data was computed
	ComputedAt time.Time `json:"computedAt"`

	// Namespace is the namespace this health data is for
	Namespace string `json:"namespace"`

	// Duration is the time period over which health was calculated
	Duration string `json:"duration"`

	// ServiceHealth stores health for all services in a namespace
	// Key is service name
	ServiceHealth NamespaceServiceHealth `json:"serviceHealth,omitempty"`

	// WorkloadHealth stores health for all workloads in a namespace
	// Key is workload name
	WorkloadHealth NamespaceWorkloadHealth `json:"workloadHealth,omitempty"`
}

// HealthCacheKey generates the cache key for health data
func HealthCacheKey(cluster, namespace string) string {
	return "health:" + cluster + ":" + namespace
}
