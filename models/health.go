package models

import (
	"github.com/prometheus/common/model"
)

// NamespaceAppHealth is an alias of map of app name x health
type NamespaceAppHealth map[string]*AppHealth

// NamespaceServiceHealth is an alias of map of service name x health
type NamespaceServiceHealth map[string]*ServiceHealth

// NamespaceWorkloadHealth is an alias of map of workload name x health
type NamespaceWorkloadHealth map[string]*WorkloadHealth

// ServiceHealth contains aggregated health from various sources, for a given service
type ServiceHealth struct {
	Requests RequestHealth `json:"requests"`
}

// AppHealth contains aggregated health from various sources, for a given app
type AppHealth struct {
	WorkloadStatuses []*WorkloadStatus `json:"workloadStatuses"`
	Requests         RequestHealth     `json:"requests"`
}

func NewEmptyRequestHealth() RequestHealth {
	return RequestHealth{Inbound: make(map[string]map[string]float64), Outbound: make(map[string]map[string]float64)}
}

// EmptyAppHealth create an empty AppHealth
func EmptyAppHealth() AppHealth {
	return AppHealth{
		WorkloadStatuses: []*WorkloadStatus{},
		Requests:         NewEmptyRequestHealth(),
	}
}

// EmptyServiceHealth create an empty ServiceHealth
func EmptyServiceHealth() ServiceHealth {
	return ServiceHealth{
		Requests: NewEmptyRequestHealth(),
	}
}

// EmptyWorkloadHealth create an empty WorkloadHealth
func EmptyWorkloadHealth() *WorkloadHealth {
	return &WorkloadHealth{
		Requests: NewEmptyRequestHealth(),
	}
}

// WorkloadHealth contains aggregated health from various sources, for a given workload
type WorkloadHealth struct {
	WorkloadStatus *WorkloadStatus `json:"workloadStatus"`
	Requests       RequestHealth   `json:"requests"`
}

// WorkloadStatus gives
// - number of desired replicas defined in the Spec of a controller
// - number of current replicas that matches selector of a controller
// - number of available replicas for a given workload
// In healthy scenarios all variables should point same value.
// When something wrong happens the different values can indicate an unhealthy situation.
// i.e.
// 	desired = 1, current = 10, available = 0 would means that a user scaled down a workload from 10 to 1
//  but in the operaton 10 pods showed problems, so no pod is available/ready but user will see 10 pods under a workload
type WorkloadStatus struct {
	Name              string `json:"name"`
	DesiredReplicas   int32  `json:"desiredReplicas"`
	CurrentReplicas   int32  `json:"currentReplicas"`
	AvailableReplicas int32  `json:"availableReplicas"`
	SyncedProxies     int32  `json:"syncedProxies"`
}

type ProxyStatuses string

const (
	Synced  ProxyStatuses = "Synced"
	NotSent ProxyStatuses = "NOT_SENT"
	Stale   ProxyStatuses = "Stale"
	StaleNa ProxyStatuses = "Stale (Never Acknowledged)"
)

// ProxyStatus gives the sync status of the sidecar proxy.
// In healthy scenarios all variables should be true.
// If at least one variable is false, then the proxy isn't fully sync'ed with pilot.
type ProxyStatus struct {
	Component string        `json:"component"`
	Status    ProxyStatuses `json:"status"`
}

// RequestHealth holds several stats about recent request errors
// - Inbound//Outbound are the rates of requests by protocol and status_code.
//   Example:   Inbound: { "http": {"200": 1.5, "400": 2.3}, "grpc": {"1": 1.2} }
type RequestHealth struct {
	Inbound  map[string]map[string]float64 `json:"inbound"`
	Outbound map[string]map[string]float64 `json:"outbound"`
}

// AggregateInbound adds the provided metric sample to internal inbound counters and updates error ratios
func (in *RequestHealth) AggregateInbound(sample *model.Sample) {
	aggregate(sample, in.Inbound)
}

// AggregateOutbound adds the provided metric sample to internal outbound counters and updates error ratios
func (in *RequestHealth) AggregateOutbound(sample *model.Sample) {
	aggregate(sample, in.Outbound)
}

func aggregate(sample *model.Sample, requests map[string]map[string]float64) {
	code := string(sample.Metric["response_code"])
	protocol := string(sample.Metric["request_protocol"])
	if code == "0" {
		code = "-" // no response regardless of protocol
	} else if protocol == "grpc" {
		// if grpc_response_status is unset, default to response_code
		if grpcStatus, ok := sample.Metric["grpc_response_status"]; ok {
			code = string(grpcStatus)
		}
	}
	if _, ok := requests[protocol]; !ok {
		requests[protocol] = make(map[string]float64)
	}
	if _, ok := requests[protocol][code]; ok {
		requests[protocol][code] += float64(sample.Value)
	} else {
		requests[protocol][code] = float64(sample.Value)
	}
}

func (ws Workloads) CastWorkloadStatuses() []*WorkloadStatus {
	statuses := make([]*WorkloadStatus, 0)
	for _, w := range ws {
		status := &WorkloadStatus{
			Name:              w.Name,
			DesiredReplicas:   w.DesiredReplicas,
			CurrentReplicas:   w.CurrentReplicas,
			AvailableReplicas: w.AvailableReplicas}
		statuses = append(statuses, status)

	}
	return statuses
}
