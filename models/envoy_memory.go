package models

// EnvoyMemoryCause classifies the likely reason for elevated Envoy proxy memory.
type EnvoyMemoryCause string

const (
	EnvoyMemoryCauseOK            EnvoyMemoryCause = "ok"
	EnvoyMemoryCauseConfiguration EnvoyMemoryCause = "configuration"
	EnvoyMemoryCauseTraffic       EnvoyMemoryCause = "traffic"
	EnvoyMemoryCauseUnknown       EnvoyMemoryCause = "unknown"
)

// EnvoyMemoryMetric identifies the memory signal used for status.
type EnvoyMemoryMetric string

const (
	EnvoyMemoryMetricAllocated  EnvoyMemoryMetric = "allocated"
	EnvoyMemoryMetricWorkingSet EnvoyMemoryMetric = "working_set"
)

// EnvoyProxyType identifies the Envoy proxy role for threshold selection.
type EnvoyProxyType string

const (
	EnvoyProxyTypeSidecar  EnvoyProxyType = "sidecar"
	EnvoyProxyTypeWaypoint EnvoyProxyType = "waypoint"
	EnvoyProxyTypeGateway  EnvoyProxyType = "gateway"
)

// EnvoyMemorySummary is a point-in-time diagnostic for Envoy memory on a workload.
//
// swagger:model EnvoyMemorySummary
type EnvoyMemorySummary struct {
	ActiveClustersMax int64 `json:"activeClustersMax"`
	ActiveConnections int64 `json:"activeConnections"`
	// ActiveConnectionsObserved is false when istio_tcp_connections_* counters are absent (common on HTTP-only sidecars).
	ActiveConnectionsObserved bool `json:"activeConnectionsObserved"`
	// Busy-traffic cause thresholds so the UI can explain the criteria without
	// duplicating the backend constants in help strings.
	BusyActiveConnections        int64            `json:"busyActiveConnections"`
	BusyRequestRatePerSecond     float64          `json:"busyRequestRatePerSecond"`
	BusyTCPBytesPerSecond        float64          `json:"busyTCPBytesPerSecond"`
	Cause                        EnvoyMemoryCause `json:"cause"`
	ConfigCountsPod              string           `json:"configCountsPod"`
	LargeConfigClustersThreshold int64            `json:"largeConfigClustersThreshold"`
	// MemoryLimitBytes is the proxy memory limit of the pod selected for status;
	// MemoryThresholdBytes and MemoryUsedPercent are relative to it. It is 0 when
	// that pod has no limit.
	MemoryLimitBytes int64 `json:"memoryLimitBytes"`
	// MemoryMaxBytes is the peak of the metric used for status. MemoryMetric identifies
	// whether this is istio-proxy cgroup working set or Envoy allocated memory.
	MemoryMaxBytes         int64             `json:"memoryMaxBytes"`
	MemoryMetric           EnvoyMemoryMetric `json:"memoryMetric"`
	MemoryThresholdBytes   int64             `json:"memoryThresholdBytes"`
	MemoryUsedPercent      float64           `json:"memoryUsedPercent"`
	ProxyType              EnvoyProxyType    `json:"proxyType"`
	RequestRate            float64           `json:"requestRate"`
	RoughConfigMemoryBytes int64             `json:"roughConfigMemoryBytes"`
	TrafficIsByteRate      bool              `json:"trafficIsByteRate"`
}
