package config

import (
	promv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// OfflineManifest represents metadata about the gathered offline data.
type OfflineManifest struct {
	// Cluster is the name of the cluster.
	// TODO: This structure may change with multiple clusters.
	Cluster string `json:"cluster"`
	// Timestamp is the time when the data was gathered.
	// Represented as an RFC3339 string.
	Timestamp string `json:"timestamp,omitempty"`
	// PrometheusBuildInfo is the build info of the Prometheus server.
	PrometheusBuildInfo *promv1.BuildinfoResult `json:"prometheusBuildInfo,omitempty"`
}
