package config

import promv1 "github.com/prometheus/client_golang/api/prometheus/v1"

// OfflineManifest represents metadata about the gathered offline data
type OfflineManifest struct {
	Cluster             string                 `json:"cluster"`
	PrometheusBuildInfo promv1.BuildinfoResult `json:"prometheusBuildInfo,omitempty"`
}
