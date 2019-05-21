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
	WorkloadStatuses []WorkloadStatus `json:"workloadStatuses"`
	Requests         RequestHealth    `json:"requests"`
}

func NewEmptyRequestHealth() RequestHealth {
	return RequestHealth{ErrorRatio: -1, InboundErrorRatio: -1, OutboundErrorRatio: -1}
}

// EmptyAppHealth create an empty AppHealth
func EmptyAppHealth() AppHealth {
	return AppHealth{
		WorkloadStatuses: []WorkloadStatus{},
		Requests:         NewEmptyRequestHealth(),
	}
}

// EmptyServiceHealth create an empty ServiceHealth
func EmptyServiceHealth() ServiceHealth {
	return ServiceHealth{
		Requests: NewEmptyRequestHealth(),
	}
}

// WorkloadHealth contains aggregated health from various sources, for a given workload
type WorkloadHealth struct {
	WorkloadStatus WorkloadStatus `json:"workloadStatus"`
	Requests       RequestHealth  `json:"requests"`
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
}

// RequestHealth holds several stats about recent request errors
type RequestHealth struct {
	inboundErrorRate    float64
	outboundErrorRate   float64
	inboundRequestRate  float64
	outboundRequestRate float64

	ErrorRatio         float64 `json:"errorRatio"`
	InboundErrorRatio  float64 `json:"inboundErrorRatio"`
	OutboundErrorRatio float64 `json:"outboundErrorRatio"`
}

// AggregateInbound adds the provided metric sample to internal inbound counters and updates error ratios
func (in *RequestHealth) AggregateInbound(sample *model.Sample) {
	aggregate(sample, &in.inboundRequestRate, &in.inboundErrorRate, &in.InboundErrorRatio)
	in.updateGlobalErrorRatio()
}

// AggregateOutbound adds the provided metric sample to internal outbound counters and updates error ratios
func (in *RequestHealth) AggregateOutbound(sample *model.Sample) {
	aggregate(sample, &in.outboundRequestRate, &in.outboundErrorRate, &in.OutboundErrorRatio)
	in.updateGlobalErrorRatio()
}

func (in *RequestHealth) updateGlobalErrorRatio() {
	globalRequestRate := in.inboundRequestRate + in.outboundRequestRate
	globalErrorRate := in.inboundErrorRate + in.outboundErrorRate

	if globalRequestRate == 0 {
		in.ErrorRatio = -1
	} else {
		in.ErrorRatio = globalErrorRate / globalRequestRate
	}
}

func aggregate(sample *model.Sample, requestRate, errorRate, errorRatio *float64) {
	*requestRate += float64(sample.Value)
	responseCode := sample.Metric["response_code"][0]
	if responseCode == '5' || responseCode == '4' {
		*errorRate += float64(sample.Value)
	}
	if *requestRate == 0 {
		*errorRatio = -1
	} else {
		*errorRatio = *errorRate / *requestRate
	}
}
