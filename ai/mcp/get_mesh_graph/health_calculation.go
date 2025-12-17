package get_mesh_graph

import (
	"fmt"
	"strings"
	"time"

	"github.com/kiali/kiali/models"
)

const DefaultRateInterval = "10m"

// computeMeshHealthSummary processes the health JSON and creates an aggregated summary.
// The health data corresponds to the type specified in queryParams (app, workload, or service).
func computeMeshHealthSummary(healthData models.ClustersNamespaceHealth, toolArgs MeshGraphArgs) *MeshHealthSummary {
	// Determine the health type from queryParams (defaults to "app")
	healthType := "app"
	if strings.EqualFold(toolArgs.GraphType, "versionedApp") {
		healthType = "app"
	} else if toolArgs.GraphType == "workload" || toolArgs.GraphType == "service" {
		healthType = toolArgs.GraphType
	}

	rateInterval := toolArgs.RateInterval
	if rateInterval == "" {
		rateInterval = DefaultRateInterval
	}

	// Create empty health structures for types we don't have
	emptyHealth := models.ClustersNamespaceHealth{
		AppHealth:      make(map[string]*models.NamespaceAppHealth),
		ServiceHealth:  make(map[string]*models.NamespaceServiceHealth),
		WorkloadHealth: make(map[string]*models.NamespaceWorkloadHealth),
	}

	// Use the appropriate health data based on type
	var appHealth, svcHealth, wlHealth models.ClustersNamespaceHealth
	switch healthType {
	case "app":
		appHealth = healthData
		svcHealth = emptyHealth
		wlHealth = emptyHealth
	case "service":
		appHealth = emptyHealth
		svcHealth = healthData
		wlHealth = emptyHealth
	case "workload":
		appHealth = emptyHealth
		svcHealth = emptyHealth
		wlHealth = healthData
	default:
		appHealth = healthData
		svcHealth = emptyHealth
		wlHealth = emptyHealth
	}

	// Compute summary using the same logic as the old branch
	summary := computeHealthSummary(appHealth, svcHealth, wlHealth, rateInterval)

	return &summary
}

// computeHealthSummary aggregates health data (same logic as old branch)
func computeHealthSummary(
	appHealth models.ClustersNamespaceHealth,
	svcHealth models.ClustersNamespaceHealth,
	wlHealth models.ClustersNamespaceHealth,
	rateInterval string,
) MeshHealthSummary {
	summary := MeshHealthSummary{
		EntityCounts:     EntityHealthCounts{},
		NamespaceSummary: make(map[string]NamespaceSummary),
		TopUnhealthy:     []UnhealthyEntity{},
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
		RateInterval:     rateInterval,
	}

	// Collect all namespace names
	nsSet := make(map[string]bool)
	for ns := range appHealth.AppHealth {
		nsSet[ns] = true
	}
	for ns := range svcHealth.ServiceHealth {
		nsSet[ns] = true
	}
	for ns := range wlHealth.WorkloadHealth {
		nsSet[ns] = true
	}
	summary.NamespaceCount = len(nsSet)

	// Aggregate per namespace
	for ns := range nsSet {
		nsSummary := NamespaceSummary{}

		// Process apps
		if nsApps, ok := appHealth.AppHealth[ns]; ok && nsApps != nil {
			for appName, app := range *nsApps {
				if app == nil {
					continue
				}
				summary.EntityCounts.Apps.Total++
				nsSummary.Apps.Total++

				status, issue := evaluateAppHealth(app)
				switch status {
				case "HEALTHY":
					summary.EntityCounts.Apps.Healthy++
					nsSummary.Apps.Healthy++
				case "NOT_READY":
					summary.EntityCounts.Apps.NotReady++
					nsSummary.Apps.NotReady++
				case "DEGRADED":
					summary.EntityCounts.Apps.Degraded++
					nsSummary.Apps.Degraded++
				case "UNHEALTHY":
					summary.EntityCounts.Apps.Unhealthy++
					nsSummary.Apps.Unhealthy++
					summary.TopUnhealthy = append(summary.TopUnhealthy, UnhealthyEntity{
						Type:      "app",
						Namespace: ns,
						Name:      appName,
						Status:    status,
						Issue:     issue,
						ErrorRate: calculateErrorRate(app.Requests),
					})
				}

				nsSummary.ErrorRate += calculateErrorRate(app.Requests)
			}
		}

		// Process services
		if nsSvcs, ok := svcHealth.ServiceHealth[ns]; ok && nsSvcs != nil {
			for svcName, svc := range *nsSvcs {
				if svc == nil {
					continue
				}
				summary.EntityCounts.Services.Total++
				nsSummary.Services.Total++

				status, issue := evaluateServiceHealth(svc)
				switch status {
				case "HEALTHY":
					summary.EntityCounts.Services.Healthy++
					nsSummary.Services.Healthy++
				case "NOT_READY":
					summary.EntityCounts.Services.NotReady++
					nsSummary.Services.NotReady++
				case "DEGRADED":
					summary.EntityCounts.Services.Degraded++
					nsSummary.Services.Degraded++
				case "UNHEALTHY":
					summary.EntityCounts.Services.Unhealthy++
					nsSummary.Services.Unhealthy++
					summary.TopUnhealthy = append(summary.TopUnhealthy, UnhealthyEntity{
						Type:      "service",
						Namespace: ns,
						Name:      svcName,
						Status:    status,
						Issue:     issue,
						ErrorRate: calculateErrorRate(svc.Requests),
					})
				}

				nsSummary.ErrorRate += calculateErrorRate(svc.Requests)
			}
		}

		// Process workloads
		if nsWls, ok := wlHealth.WorkloadHealth[ns]; ok && nsWls != nil {
			for wlName, wl := range *nsWls {
				if wl == nil {
					continue
				}
				summary.EntityCounts.Workloads.Total++
				nsSummary.Workloads.Total++

				status, issue := evaluateWorkloadHealth(wl)
				switch status {
				case "HEALTHY":
					summary.EntityCounts.Workloads.Healthy++
					nsSummary.Workloads.Healthy++
				case "NOT_READY":
					summary.EntityCounts.Workloads.NotReady++
					nsSummary.Workloads.NotReady++
				case "DEGRADED":
					summary.EntityCounts.Workloads.Degraded++
					nsSummary.Workloads.Degraded++
				case "UNHEALTHY":
					summary.EntityCounts.Workloads.Unhealthy++
					nsSummary.Workloads.Unhealthy++
					summary.TopUnhealthy = append(summary.TopUnhealthy, UnhealthyEntity{
						Type:      "workload",
						Namespace: ns,
						Name:      wlName,
						Status:    status,
						Issue:     issue,
						ErrorRate: calculateErrorRate(wl.Requests),
					})
				}

				nsSummary.ErrorRate += calculateErrorRate(wl.Requests)
			}
		}

		// Compute namespace status and availability
		nsSummary.Status = computeNamespaceStatus(nsSummary)
		nsSummary.Availability = computeAvailability(nsSummary)
		summary.NamespaceSummary[ns] = nsSummary
	}

	// Compute overall stats
	summary.OverallStatus = computeOverallStatus(summary.EntityCounts)
	summary.Availability = computeOverallAvailability(summary.EntityCounts)
	summary.TotalErrorRate = computeTotalErrorRate(summary.NamespaceSummary)

	// Sort and limit top unhealthy
	sortUnhealthyByImpact(summary.TopUnhealthy)
	if len(summary.TopUnhealthy) > 10 {
		summary.TopUnhealthy = summary.TopUnhealthy[:10]
	}

	return summary
}

// evaluateAppHealth determines app health status
func evaluateAppHealth(app *models.AppHealth) (status string, issue string) {
	// Check workload statuses
	totalWorkloads := len(app.WorkloadStatuses)
	if totalWorkloads == 0 {
		return "UNKNOWN", "no workloads found"
	}

	workloadStatus := "HEALTHY"
	unhealthyCount := 0
	for _, ws := range app.WorkloadStatuses {
		// User has scaled down a workload, then desired replicas will be 0 and it's not an error condition
		// This matches Kiali frontend logic: return NOT_READY when desiredReplicas === 0
		if ws.DesiredReplicas == 0 {
			workloadStatus = "NOT_READY"
			issue = "scaled to 0 replicas"
			continue
		}

		if ws.AvailableReplicas < ws.DesiredReplicas {
			unhealthyCount++
			issue = fmt.Sprintf("%d/%d replicas available", ws.AvailableReplicas, ws.DesiredReplicas)
			if ws.AvailableReplicas == 0 {
				workloadStatus = "UNHEALTHY"
			} else if workloadStatus != "UNHEALTHY" {
				workloadStatus = "DEGRADED"
			}
		}
		if ws.SyncedProxies >= 0 && ws.SyncedProxies < ws.AvailableReplicas {
			if issue == "" {
				issue = fmt.Sprintf("%d/%d proxies synced", ws.SyncedProxies, ws.AvailableReplicas)
			}
			if workloadStatus == "HEALTHY" {
				workloadStatus = "DEGRADED"
			}
		}
	}

	// Evaluate request health using tolerance-based logic (Kiali tolerances)
	requestStatus, errorRate := evaluateRequestHealth(app.Requests)
	if errorRate > 0 && issue == "" {
		issue = fmt.Sprintf("error rate: %.2f%%", errorRate*100)
	}

	// Merge workload and request statuses (worst wins)
	finalStatus := mergeHealthStatus(workloadStatus, requestStatus)
	return finalStatus, issue
}

// evaluateServiceHealth determines service health status
func evaluateServiceHealth(svc *models.ServiceHealth) (status string, issue string) {
	// If there is no inbound or outbound traffic data, service health is UNKNOWN
	if !hasAnyRequests(svc.Requests) {
		return "UNKNOWN", ""
	}

	// Evaluate request health using tolerance-based logic (Kiali tolerances)
	status, errorRate := evaluateRequestHealth(svc.Requests)

	if errorRate > 0 && issue == "" {
		issue = fmt.Sprintf("error rate: %.2f%%", errorRate*100)
	}
	return status, issue
}

// hasAnyRequests returns true if there is any non-zero request count in inbound or outbound
func hasAnyRequests(req models.RequestHealth) bool {
	// Check inbound
	for _, codes := range req.Inbound {
		for _, count := range codes {
			if count > 0 {
				return true
			}
		}
	}
	// Check outbound
	for _, codes := range req.Outbound {
		for _, count := range codes {
			if count > 0 {
				return true
			}
		}
	}
	return false
}

// evaluateWorkloadHealth determines workload health status
func evaluateWorkloadHealth(wl *models.WorkloadHealth) (status string, issue string) {
	workloadStatus := "HEALTHY"

	if wl.WorkloadStatus != nil {
		ws := wl.WorkloadStatus
		// User has scaled down a workload, then desired replicas will be 0 and it's not an error condition
		// This matches Kiali frontend logic: return NOT_READY when desiredReplicas === 0
		if ws.DesiredReplicas == 0 {
			workloadStatus = "NOT_READY"
			issue = "scaled to 0 replicas"
		} else if ws.AvailableReplicas < ws.DesiredReplicas {
			issue = fmt.Sprintf("%d/%d replicas available", ws.AvailableReplicas, ws.DesiredReplicas)
			if ws.AvailableReplicas == 0 {
				workloadStatus = "UNHEALTHY"
			} else {
				workloadStatus = "DEGRADED"
			}
		}
		if ws.SyncedProxies >= 0 && ws.SyncedProxies < ws.AvailableReplicas {
			if issue == "" {
				issue = fmt.Sprintf("%d/%d proxies synced", ws.SyncedProxies, ws.AvailableReplicas)
			}
			if workloadStatus == "HEALTHY" {
				workloadStatus = "DEGRADED"
			}
		}
	}

	// Evaluate request health using tolerance-based logic (Kiali tolerances)
	requestStatus, errorRate := evaluateRequestHealth(wl.Requests)

	// If there is no inbound or outbound traffic data and no workload status info, mark UNKNOWN
	if !hasAnyRequests(wl.Requests) && wl.WorkloadStatus == nil {
		return "UNKNOWN", ""
	}
	if errorRate > 0 && issue == "" {
		issue = fmt.Sprintf("error rate: %.2f%%", errorRate*100)
	}

	// Merge workload and request statuses (worst wins)
	finalStatus := mergeHealthStatus(workloadStatus, requestStatus)
	return finalStatus, issue
}

// mergeHealthStatus returns the worst of two health statuses
// Priority matches Kiali frontend: UNHEALTHY(4) > DEGRADED(3) > NOT_READY(2) > HEALTHY(1) > UNKNOWN(0)
func mergeHealthStatus(s1, s2 string) string {
	priority := map[string]int{
		"UNHEALTHY": 4,
		"DEGRADED":  3,
		"NOT_READY": 2,
		"HEALTHY":   1,
		"UNKNOWN":   0,
	}

	if priority[s1] > priority[s2] {
		return s1
	}
	return s2
}

// calculateErrorRate computes error percentage from request health
// This uses a simplified approach - for each protocol/code combination,
// it checks against tolerance thresholds to determine if it's an error
func calculateErrorRate(req models.RequestHealth) float64 {
	totalRequests := 0.0
	errorRequests := 0.0

	// Count inbound
	for protocol, codes := range req.Inbound {
		for code, count := range codes {
			totalRequests += count
			if isErrorCode(protocol, code) {
				errorRequests += count
			}
		}
	}

	// Count outbound
	for protocol, codes := range req.Outbound {
		for code, count := range codes {
			totalRequests += count
			if isErrorCode(protocol, code) {
				errorRequests += count
			}
		}
	}

	if totalRequests == 0 {
		return 0.0
	}
	return errorRequests / totalRequests
}

// isErrorCode checks if a status code represents an error
// Based on Kiali's default tolerance configuration
func isErrorCode(protocol, code string) bool {
	switch protocol {
	case "http":
		// "-" represents aborted/fault-injected requests (always an error)
		if code == "-" {
			return true
		}
		// 4xx client errors
		if len(code) == 3 && code[0] == '4' {
			return true
		}
		// 5xx server errors
		if len(code) == 3 && code[0] == '5' {
			return true
		}
	case "grpc":
		// "-" represents aborted requests
		if code == "-" {
			return true
		}
		// gRPC error codes (1-16, non-zero)
		if code != "0" {
			return true
		}
	}
	return false
}

// evaluateRequestHealth evaluates health status based on request metrics
// Returns status and worst error ratio found
func evaluateRequestHealth(req models.RequestHealth) (status string, worstRatio float64) {
	status = "HEALTHY"
	worstRatio = 0.0

	// Helper to process requests (inbound or outbound)
	processRequests := func(requests map[string]map[string]float64) {
		for protocol, codes := range requests {
			totalForProtocol := 0.0

			// Calculate totals
			for _, count := range codes {
				totalForProtocol += count
			}

			if totalForProtocol == 0 {
				continue
			}

			// Calculate error ratios for each code
			for code, count := range codes {
				if isErrorCode(protocol, code) {
					ratio := count / totalForProtocol

					// Track worst ratio
					if ratio > worstRatio {
						worstRatio = ratio
					}

					// Evaluate against tolerance thresholds
					// Based on Kiali defaults:
					// - Code "-": degraded=0%, failure=10%
					// - 5xx: degraded=0%, failure=10%
					// - 4xx: degraded=10%, failure=20%
					// - grpc errors: degraded=0%, failure=10%

					codeStatus := getStatusForCodeRatio(protocol, code, ratio)
					if codeStatus == "UNHEALTHY" {
						status = "UNHEALTHY"
					} else if codeStatus == "DEGRADED" && status == "HEALTHY" {
						status = "DEGRADED"
					}
				}
			}
		}
	}

	processRequests(req.Inbound)
	processRequests(req.Outbound)

	return status, worstRatio
}

// getStatusForCodeRatio determines health status based on error code and ratio
// Implements Kiali's default tolerance configuration
func getStatusForCodeRatio(protocol, code string, ratio float64) string {
	percentage := ratio * 100

	switch protocol {
	case "http":
		if code == "-" {
			// Aborted/fault-injected: degraded=0%, failure=10%
			if percentage >= 10 {
				return "UNHEALTHY"
			} else if percentage > 0 {
				return "DEGRADED"
			}
		} else if len(code) == 3 && code[0] == '5' {
			// 5xx errors: degraded=0%, failure=10%
			if percentage >= 10 {
				return "UNHEALTHY"
			} else if percentage > 0 {
				return "DEGRADED"
			}
		} else if len(code) == 3 && code[0] == '4' {
			// 4xx errors: degraded=10%, failure=20%
			if percentage >= 20 {
				return "UNHEALTHY"
			} else if percentage >= 10 {
				return "DEGRADED"
			}
		}
	case "grpc":
		// gRPC errors (including "-"): degraded=0%, failure=10%
		if code != "0" {
			if percentage >= 10 {
				return "UNHEALTHY"
			} else if percentage > 0 {
				return "DEGRADED"
			}
		}
	}

	return "HEALTHY"
}

// computeNamespaceStatus determines namespace overall status
func computeNamespaceStatus(ns NamespaceSummary) string {
	totalUnhealthy := ns.Apps.Unhealthy + ns.Services.Unhealthy + ns.Workloads.Unhealthy
	totalEntities := ns.Apps.Total + ns.Services.Total + ns.Workloads.Total

	if totalEntities == 0 {
		return "UNKNOWN"
	}

	if totalUnhealthy == 0 && ns.ErrorRate < 0.01 {
		return "HEALTHY"
	} else if totalUnhealthy > totalEntities/2 || ns.ErrorRate > 0.05 {
		return "UNHEALTHY"
	}
	return "DEGRADED"
}

// computeAvailability computes availability percentage for a namespace
func computeAvailability(ns NamespaceSummary) float64 {
	total := ns.Apps.Total + ns.Services.Total + ns.Workloads.Total
	if total == 0 {
		return 100.0
	}

	healthy := ns.Apps.Healthy + ns.Services.Healthy + ns.Workloads.Healthy
	degraded := ns.Apps.Degraded + ns.Services.Degraded + ns.Workloads.Degraded

	return (float64(healthy) + float64(degraded)*0.5) / float64(total) * 100.0
}

// computeOverallStatus determines overall mesh status
func computeOverallStatus(counts EntityHealthCounts) string {
	total := counts.Apps.Total + counts.Services.Total + counts.Workloads.Total
	unhealthy := counts.Apps.Unhealthy + counts.Services.Unhealthy + counts.Workloads.Unhealthy
	degraded := counts.Apps.Degraded + counts.Services.Degraded + counts.Workloads.Degraded

	if total == 0 {
		return "UNKNOWN"
	}

	// If there are any unhealthy entities
	if unhealthy > 0 {
		if unhealthy > total/2 {
			return "UNHEALTHY"
		}
		return "DEGRADED"
	}

	// If there are degraded entities but no unhealthy
	if degraded > 0 {
		return "DEGRADED"
	}

	return "HEALTHY"
}

// computeOverallAvailability computes overall mesh availability
func computeOverallAvailability(counts EntityHealthCounts) float64 {
	total := counts.Apps.Total + counts.Services.Total + counts.Workloads.Total
	if total == 0 {
		return 100.0
	}

	healthy := counts.Apps.Healthy + counts.Services.Healthy + counts.Workloads.Healthy
	degraded := counts.Apps.Degraded + counts.Services.Degraded + counts.Workloads.Degraded

	return (float64(healthy) + float64(degraded)*0.5) / float64(total) * 100.0
}

// computeTotalErrorRate sums error rates across namespaces
func computeTotalErrorRate(nsSummaries map[string]NamespaceSummary) float64 {
	total := 0.0
	for _, ns := range nsSummaries {
		total += ns.ErrorRate
	}
	return total
}

// sortUnhealthyByImpact sorts unhealthy entities by error rate
func sortUnhealthyByImpact(unhealthy []UnhealthyEntity) {
	// Simple bubble sort by error rate descending
	for i := 0; i < len(unhealthy); i++ {
		for j := i + 1; j < len(unhealthy); j++ {
			if unhealthy[j].ErrorRate > unhealthy[i].ErrorRate {
				unhealthy[i], unhealthy[j] = unhealthy[j], unhealthy[i]
			}
		}
	}
}
