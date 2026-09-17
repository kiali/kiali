package models

// EnvoyMemoryCause classifies the likely reason for elevated Envoy proxy memory.
type EnvoyMemoryCause string

const (
	EnvoyMemoryCauseOK            EnvoyMemoryCause = "ok"
	EnvoyMemoryCauseConfiguration EnvoyMemoryCause = "configuration"
	EnvoyMemoryCauseTraffic       EnvoyMemoryCause = "traffic"
	EnvoyMemoryCauseUnknown       EnvoyMemoryCause = "unknown"
)

// EnvoyProxyType identifies the Envoy proxy role for threshold selection.
type EnvoyProxyType string

const (
	EnvoyProxyTypeSidecar  EnvoyProxyType = "sidecar"
	EnvoyProxyTypeWaypoint EnvoyProxyType = "waypoint"
	EnvoyProxyTypeGateway  EnvoyProxyType = "gateway"
)

// EnvoyMemorySummary is a point-in-time diagnostic for Envoy memory on a workload.
type EnvoyMemorySummary struct {
	ActiveClustersMax    int64            `json:"activeClustersMax"`
	ActiveConnections    int64            `json:"activeConnections"`
	Cause                EnvoyMemoryCause `json:"cause"`
	MemoryLimitBytes     int64            `json:"memoryLimitBytes"`
	MemoryMaxBytes       int64            `json:"memoryMaxBytes"`
	MemoryThresholdBytes int64            `json:"memoryThresholdBytes"`
	MemoryUsedPercent    float64          `json:"memoryUsedPercent"`
	ProxyType            EnvoyProxyType   `json:"proxyType"`
	RequestRate          float64          `json:"requestRate"`
}
