package models

import (
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/log"
)

// ClustersNamespaceHealth is a map NamespaceHealth for namespaces of given clusters
type ClustersNamespaceHealth struct {
	AppHealth      map[string]*NamespaceAppHealth      `json:"namespaceAppHealth,omitempty"`
	ServiceHealth  map[string]*NamespaceServiceHealth  `json:"namespaceServiceHealth,omitempty"`
	WorkloadHealth map[string]*NamespaceWorkloadHealth `json:"namespaceWorkloadHealth,omitempty"`
}

// NamespaceAppsHealth is a list of app name x health for a given namespace
type NamespaceAppHealth map[string]*AppHealth

// NamespaceServicesHealth is a list of service name x health for a given namespace
type NamespaceServiceHealth map[string]*ServiceHealth

// NamespaceWorkloadsHealth is a list of workload name x health for a given namespace
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
	return RequestHealth{
		Inbound:            make(map[string]map[string]float64),
		Outbound:           make(map[string]map[string]float64),
		HealthAnnotations:  make(map[string]string),
		inboundSource:      make(map[string]map[string]float64),
		inboundDestination: make(map[string]map[string]float64),
	}
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
		Requests:       NewEmptyRequestHealth(),
		WorkloadStatus: nil,
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
// - desired = 1, current = 10, available = 0 would means that a user scaled down a workload from 10 to 1
// - but in the operaton 10 pods showed problems, so no pod is available/ready but user will see 10 pods under a workload
type WorkloadStatus struct {
	Name              string `json:"name"`
	DesiredReplicas   int32  `json:"desiredReplicas"`
	CurrentReplicas   int32  `json:"currentReplicas"`
	AvailableReplicas int32  `json:"availableReplicas"`
	SyncedProxies     int32  `json:"syncedProxies"`
}

// ProxyStatus gives the sync status of the sidecar proxy.
// In healthy scenarios all variables should be true.
// If at least one variable is false, then the proxy isn't fully sync'ed with pilot.
type ProxyStatus struct {
	CDS string `json:"CDS"`
	EDS string `json:"EDS"`
	LDS string `json:"LDS"`
	RDS string `json:"RDS"`
}

// RequestHealth holds several stats about recent request errors
// - Inbound//Outbound are the rates of requests by protocol and status_code.
// Example:   Inbound: { "http": {"200": 1.5, "400": 2.3}, "grpc": {"1": 1.2} }
type RequestHealth struct {
	Inbound            map[string]map[string]float64 `json:"inbound"`
	Outbound           map[string]map[string]float64 `json:"outbound"`
	HealthAnnotations  map[string]string             `json:"healthAnnotations"`
	inboundSource      map[string]map[string]float64
	inboundDestination map[string]map[string]float64
}

// AggregateInbound adds the provided metric sample to internal inbound counters and updates error ratios
func (in *RequestHealth) AggregateInbound(sample *model.Sample) {
	// Samples need to be aggregated by source or destination reporter, but not accumulated both
	reporter := string(sample.Metric[model.LabelName("reporter")])
	switch reporter {
	case "source":
		aggregate(sample, in.inboundSource)
	case "destination":
		aggregate(sample, in.inboundDestination)
	default:
		log.Tracef("Inbound metric without reporter %v ", sample)
		aggregate(sample, in.Inbound)
	}
}

// AggregateOutbound adds the provided metric sample to internal outbound counters and updates error ratios
func (in *RequestHealth) AggregateOutbound(sample *model.Sample) {
	// Outbound traffic will be aggregated per source reporter
	reporter := string(sample.Metric[model.LabelName("reporter")])
	if reporter == "source" {
		aggregate(sample, in.Outbound)
	}
}

// RequestHealth internally stores Inbound rate separated by reporter
// There were duplicated values that should exist in both reports
// but there may exist values that only are present in one or another reporter,
// those should be consolidated into a single result
func (in *RequestHealth) CombineReporters() {
	// Inbound
	// Init Inbound with data from source reporter
	for isProtocol, isCodes := range in.inboundSource {
		if _, ok := in.Inbound[isProtocol]; !ok {
			in.Inbound[isProtocol] = make(map[string]float64)
		}
		for isCode, isValue := range isCodes {
			in.Inbound[isProtocol][isCode] = isValue
		}
	}
	// Combine data from destination and source reporters for Inbound rate
	for idProtocol, idCodes := range in.inboundDestination {
		if _, ok := in.Inbound[idProtocol]; !ok {
			in.Inbound[idProtocol] = make(map[string]float64)
		}
		for idCode, idValue := range idCodes {
			// If an Inbound -> protocol -> value is reported by destination but not by source reporter, we add it
			if _, ok := in.Inbound[idProtocol][idCode]; !ok {
				in.Inbound[idProtocol][idCode] = idValue
			} else {
				// If the value provided by destination is higher than the source we replace it
				// i.e. destination reports errors but not from source
				if idValue > in.Inbound[idProtocol][idCode] {
					in.Inbound[idProtocol][idCode] = idValue
				}
			}
		}
	}
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

	requests[protocol][code] += float64(sample.Value)
}

// CastWorkloadStatus returns a WorkloadStatus out of a given Workload
func (w Workload) CastWorkloadStatus() *WorkloadStatus {
	syncedProxies := int32(-1)
	if w.HasIstioSidecar() && !w.IsGateway() {
		syncedProxies = w.Pods.SyncedPodProxiesCount()
	}

	return &WorkloadStatus{
		Name:              w.Name,
		DesiredReplicas:   w.DesiredReplicas,
		CurrentReplicas:   w.CurrentReplicas,
		AvailableReplicas: w.AvailableReplicas,
		SyncedProxies:     syncedProxies,
	}
}

// CastWorkloadStatuses returns a WorkloadStatus array out of a given set of Workloads
func (ws Workloads) CastWorkloadStatuses() []*WorkloadStatus {
	statuses := make([]*WorkloadStatus, 0)
	for _, w := range ws {
		statuses = append(statuses, w.CastWorkloadStatus())
	}
	return statuses
}

// IsSynced returns true when all the components are with SYNCED status
func (ps ProxyStatus) IsSynced() bool {
	return isComponentStatusSynced(ps.CDS) && isComponentStatusSynced(ps.EDS) &&
		isComponentStatusSynced(ps.LDS) && isComponentStatusSynced(ps.RDS)
}

// isComponentStatusSynced returns true when componentStatus is Synced
func isComponentStatusSynced(componentStatus string) bool {
	return componentStatus == "Synced"
}
