package get_mesh_traffic_graph

import (
	"fmt"
	"strings"
	"time"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/models"
)

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
		rateInterval = mcputil.DefaultRateInterval
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
						ErrorRate: entityErrorRate(app.Status),
					})
				}

				nsSummary.ErrorRate += entityErrorRate(app.Status)
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
						ErrorRate: entityErrorRate(svc.Status),
					})
				}

				nsSummary.ErrorRate += entityErrorRate(svc.Status)
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
						ErrorRate: entityErrorRate(wl.Status),
					})
				}

				nsSummary.ErrorRate += entityErrorRate(wl.Status)
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

// evaluateAppHealth uses the backend-calculated status, same as Kiali list pages.
func evaluateAppHealth(app *models.AppHealth) (status string, issue string) {
	return statusFromCachedHealth(app.Status, app.WorkloadStatuses)
}

// evaluateServiceHealth uses the backend-calculated status, same as Kiali list pages.
func evaluateServiceHealth(svc *models.ServiceHealth) (status string, issue string) {
	return statusFromCachedHealth(svc.Status, nil)
}

// evaluateWorkloadHealth uses the backend-calculated status, same as Kiali list pages.
func evaluateWorkloadHealth(wl *models.WorkloadHealth) (status string, issue string) {
	if wl == nil {
		return "UNKNOWN", ""
	}

	var workloadStatuses []*models.WorkloadStatus
	if wl.WorkloadStatus != nil {
		workloadStatuses = []*models.WorkloadStatus{wl.WorkloadStatus}
	}
	return statusFromCachedHealth(wl.Status, workloadStatuses)
}

// statusFromCachedHealth maps backend CalculatedHealthStatus to mesh summary strings.
// Health is computed once in business.HealthCalculator; this only aggregates for AI output.
func statusFromCachedHealth(cached *models.CalculatedHealthStatus, workloadStatuses []*models.WorkloadStatus) (status string, issue string) {
	if cached == nil {
		return "UNKNOWN", ""
	}

	return modelsHealthStatusToSummary(cached.Status), issueFromCachedStatus(cached, workloadStatuses)
}

// modelsHealthStatusToSummary maps backend health status to mesh summary strings.
func modelsHealthStatusToSummary(status models.HealthStatus) string {
	switch status {
	case models.HealthStatusHealthy:
		return "HEALTHY"
	case models.HealthStatusDegraded:
		return "DEGRADED"
	case models.HealthStatusFailure:
		return "UNHEALTHY"
	case models.HealthStatusNotReady:
		return "NOT_READY"
	default:
		return "UNKNOWN"
	}
}

func issueFromCachedStatus(cached *models.CalculatedHealthStatus, workloadStatuses []*models.WorkloadStatus) string {
	for _, ws := range workloadStatuses {
		if ws == nil {
			continue
		}
		if ws.DesiredReplicas == 0 {
			return "scaled to 0 replicas"
		}
		if ws.AvailableReplicas < ws.DesiredReplicas {
			return fmt.Sprintf("%d/%d replicas available", ws.AvailableReplicas, ws.DesiredReplicas)
		}
		if ws.SyncedProxies >= 0 && ws.SyncedProxies < ws.AvailableReplicas {
			return fmt.Sprintf("%d/%d proxies synced", ws.SyncedProxies, ws.AvailableReplicas)
		}
	}

	if cached != nil && cached.ErrorRatio > 0 {
		return fmt.Sprintf("error rate: %.2f%%", cached.ErrorRatio)
	}
	return ""
}

// entityErrorRate returns the error ratio (0-1) from backend-calculated status.
func entityErrorRate(cached *models.CalculatedHealthStatus) float64 {
	if cached == nil || cached.ErrorRatio < 0 {
		return 0.0
	}
	return cached.ErrorRatio / 100.0
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
