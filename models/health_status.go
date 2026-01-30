package models

// HealthStatus represents the calculated health status of an entity
type HealthStatus string

const (
	HealthStatusHealthy  HealthStatus = "Healthy"
	HealthStatusDegraded HealthStatus = "Degraded"
	HealthStatusFailure  HealthStatus = "Failure"
	HealthStatusNotReady HealthStatus = "Not Ready"
	HealthStatusNA       HealthStatus = "NA"
)

// HealthStatusPriority returns the priority of a health status (higher = worse)
func HealthStatusPriority(status HealthStatus) int {
	switch status {
	case HealthStatusFailure:
		return 4
	case HealthStatusDegraded:
		return 3
	case HealthStatusNotReady:
		return 2
	case HealthStatusHealthy:
		return 1
	default: // NA
		return 0
	}
}

// MergeHealthStatus returns the worse of two health statuses
func MergeHealthStatus(s1, s2 HealthStatus) HealthStatus {
	if HealthStatusPriority(s1) > HealthStatusPriority(s2) {
		return s1
	}
	return s2
}

// WorkloadStatusHealth calculates health status from workload replica information
// This mirrors the frontend ratioCheck function
func WorkloadStatusHealth(ws *WorkloadStatus) HealthStatus {
	if ws == nil {
		return HealthStatusNA
	}

	desired := ws.DesiredReplicas
	current := ws.CurrentReplicas
	available := ws.AvailableReplicas
	synced := ws.SyncedProxies

	// NOT READY: User has scaled down a workload
	if desired == 0 {
		return HealthStatusNotReady
	}

	// DEGRADED: Has available pods but less than desired
	if desired > 0 && current > 0 && available > 0 &&
		(current < desired || available < desired) {
		return HealthStatusDegraded
	}

	// FAILURE: No available replicas when desired > 0
	if desired > 0 && available == 0 {
		return HealthStatusFailure
	}

	// FAILURE: Pending pods (available == desired but != current)
	if desired == available && available != current {
		return HealthStatusFailure
	}

	// DEGRADED: Proxies not synced
	if synced >= 0 && synced < desired {
		return HealthStatusDegraded
	}

	// HEALTHY: All replicas match
	if desired == current && current == available {
		return HealthStatusHealthy
	}

	// Default to degraded for other combinations
	return HealthStatusDegraded
}

// GetErrorRatio returns the overall error ratio from request health
// Returns -1 if no data is available
func (r RequestHealth) GetErrorRatio() float64 {
	var totalRequests, totalErrors float64

	// Sum inbound requests and errors
	for _, codeMap := range r.Inbound {
		for code, count := range codeMap {
			totalRequests += count
			// 4xx and 5xx are errors
			if len(code) > 0 && (code[0] == '4' || code[0] == '5') {
				totalErrors += count
			}
		}
	}

	// Sum outbound requests and errors
	for _, codeMap := range r.Outbound {
		for code, count := range codeMap {
			totalRequests += count
			if len(code) > 0 && (code[0] == '4' || code[0] == '5') {
				totalErrors += count
			}
		}
	}

	if totalRequests == 0 {
		return -1 // No data
	}

	return totalErrors / totalRequests
}
