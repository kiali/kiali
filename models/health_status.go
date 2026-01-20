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

// RequestHealthStatus calculates health status from request error rates
// Uses default thresholds: degraded >= 0.1%, failure >= 20%
func RequestHealthStatus(requests RequestHealth, degradedThreshold, failureThreshold float64) HealthStatus {
	// Calculate combined error ratio from inbound and outbound
	errorRatio := requests.GetErrorRatio()

	if errorRatio < 0 {
		// No data available
		return HealthStatusNA
	}

	// Convert to percentage
	errorPct := errorRatio * 100

	if errorPct >= failureThreshold {
		return HealthStatusFailure
	}
	if errorPct >= degradedThreshold {
		return HealthStatusDegraded
	}
	return HealthStatusHealthy
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

// AppHealthStatus calculates the overall health status for an app
func AppHealthStatus(health *AppHealth, degradedThreshold, failureThreshold float64) HealthStatus {
	if health == nil {
		return HealthStatusNA
	}

	// Start with request health status
	status := RequestHealthStatus(health.Requests, degradedThreshold, failureThreshold)

	// Merge with workload statuses (take the worst)
	for _, ws := range health.WorkloadStatuses {
		wsStatus := WorkloadStatusHealth(ws)
		status = MergeHealthStatus(status, wsStatus)
	}

	return status
}

// ServiceHealthStatus calculates the overall health status for a service
func ServiceHealthStatus(health *ServiceHealth, degradedThreshold, failureThreshold float64) HealthStatus {
	if health == nil {
		return HealthStatusNA
	}

	return RequestHealthStatus(health.Requests, degradedThreshold, failureThreshold)
}

// WorkloadHealthStatus calculates the overall health status for a workload
func WorkloadHealthStatus(health *WorkloadHealth, degradedThreshold, failureThreshold float64) HealthStatus {
	if health == nil {
		return HealthStatusNA
	}

	// Get workload status health
	wsStatus := WorkloadStatusHealth(health.WorkloadStatus)

	// Get request health status
	reqStatus := RequestHealthStatus(health.Requests, degradedThreshold, failureThreshold)

	// Return the worse of the two
	return MergeHealthStatus(wsStatus, reqStatus)
}

// NamespaceHealthCounts contains counts of entities by health status
type NamespaceHealthCounts struct {
	Failure  int
	Degraded int
	Healthy  int
	NotReady int
	NA       int
}

// CountNamespaceAppHealth counts apps by health status
func CountNamespaceAppHealth(health NamespaceAppHealth, degradedThreshold, failureThreshold float64) NamespaceHealthCounts {
	counts := NamespaceHealthCounts{}
	for _, appHealth := range health {
		status := AppHealthStatus(appHealth, degradedThreshold, failureThreshold)
		incrementCount(&counts, status)
	}
	return counts
}

// CountNamespaceServiceHealth counts services by health status
func CountNamespaceServiceHealth(health NamespaceServiceHealth, degradedThreshold, failureThreshold float64) NamespaceHealthCounts {
	counts := NamespaceHealthCounts{}
	for _, svcHealth := range health {
		status := ServiceHealthStatus(svcHealth, degradedThreshold, failureThreshold)
		incrementCount(&counts, status)
	}
	return counts
}

// CountNamespaceWorkloadHealth counts workloads by health status
func CountNamespaceWorkloadHealth(health NamespaceWorkloadHealth, degradedThreshold, failureThreshold float64) NamespaceHealthCounts {
	counts := NamespaceHealthCounts{}
	for _, wkHealth := range health {
		status := WorkloadHealthStatus(wkHealth, degradedThreshold, failureThreshold)
		incrementCount(&counts, status)
	}
	return counts
}

func incrementCount(counts *NamespaceHealthCounts, status HealthStatus) {
	switch status {
	case HealthStatusFailure:
		counts.Failure++
	case HealthStatusDegraded:
		counts.Degraded++
	case HealthStatusHealthy:
		counts.Healthy++
	case HealthStatusNotReady:
		counts.NotReady++
	default:
		counts.NA++
	}
}
