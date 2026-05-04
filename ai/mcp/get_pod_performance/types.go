package get_pod_performance

import "time"

const (
	defaultTimeRange = "10m"
)

type ScalarValue struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

type UsageVsRequestsLimits struct {
	Usage   *ScalarValue `json:"usage,omitempty"`
	Request *ScalarValue `json:"request,omitempty"`
	Limit   *ScalarValue `json:"limit,omitempty"`

	UsageRequestRatio *float64 `json:"usage_request_ratio,omitempty"`
	UsageLimitRatio   *float64 `json:"usage_limit_ratio,omitempty"`
}

type ContainerPerformance struct {
	Container string `json:"container"`

	CPU    UsageVsRequestsLimits `json:"cpu"`
	Memory UsageVsRequestsLimits `json:"memory"`
}

type PodPerformanceResponse struct {
	Cluster   string    `json:"cluster"`
	Namespace string    `json:"namespace"`
	Workload  string    `json:"workload_name,omitempty"`
	PodName   string    `json:"pod_name"`
	Resolved  string    `json:"resolved_from,omitempty"` // "workload" | "pod"
	TimeRange string    `json:"time_range"`
	QueryTime time.Time `json:"query_time"`

	CPU    UsageVsRequestsLimits `json:"cpu"`
	Memory UsageVsRequestsLimits `json:"memory"`

	Containers []ContainerPerformance `json:"containers,omitempty"`

	Errors map[string]string `json:"errors,omitempty"`
}
