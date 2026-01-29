package business

import (
	"regexp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

// CalculatedHealth is an alias for models.CalculatedHealthStatus
// to maintain backward compatibility with existing code
type CalculatedHealth = models.CalculatedHealthStatus

// HealthCalculator calculates health status from raw health data using configuration
type HealthCalculator struct {
	conf    *config.Config
	matcher *HealthRateMatcher
}

// NewHealthCalculator creates a new HealthCalculator
func NewHealthCalculator(conf *config.Config) *HealthCalculator {
	return &HealthCalculator{
		conf:    conf,
		matcher: NewHealthRateMatcher(conf),
	}
}

// CalculateAppHealth calculates the overall health status for an app
func (c *HealthCalculator) CalculateAppHealth(
	namespace, name string,
	health *models.AppHealth,
	annotations map[string]string,
) CalculatedHealth {
	if health == nil {
		return CalculatedHealth{Status: models.HealthStatusNA}
	}

	// Get pre-compiled tolerances for this entity (with annotation override)
	tolerances := c.matcher.GetCompiledTolerances(namespace, name, "app", annotations)

	// Calculate request health status
	reqStatus, errorRatio := c.calculateRequestStatus(health.Requests, tolerances)

	// Merge with workload statuses (take the worst)
	status := reqStatus
	for _, ws := range health.WorkloadStatuses {
		wsStatus := models.WorkloadStatusHealth(ws)
		status = models.MergeHealthStatus(status, wsStatus)
	}

	return CalculatedHealth{
		Status:     status,
		ErrorRatio: errorRatio,
	}
}

// CalculateServiceHealth calculates the overall health status for a service
func (c *HealthCalculator) CalculateServiceHealth(
	namespace, name string,
	health *models.ServiceHealth,
	annotations map[string]string,
) CalculatedHealth {
	if health == nil {
		return CalculatedHealth{Status: models.HealthStatusNA}
	}

	// Get pre-compiled tolerances for this entity (with annotation override)
	tolerances := c.matcher.GetCompiledTolerances(namespace, name, "service", annotations)

	// Calculate request health status
	status, errorRatio := c.calculateRequestStatus(health.Requests, tolerances)

	return CalculatedHealth{
		Status:     status,
		ErrorRatio: errorRatio,
	}
}

// CalculateWorkloadHealth calculates the overall health status for a workload
func (c *HealthCalculator) CalculateWorkloadHealth(
	namespace, name string,
	health *models.WorkloadHealth,
	annotations map[string]string,
) CalculatedHealth {
	if health == nil {
		return CalculatedHealth{Status: models.HealthStatusNA}
	}

	// Get pre-compiled tolerances for this entity (with annotation override)
	tolerances := c.matcher.GetCompiledTolerances(namespace, name, "workload", annotations)

	// Calculate request health status
	reqStatus, errorRatio := c.calculateRequestStatus(health.Requests, tolerances)

	// Get workload status health
	wsStatus := models.WorkloadStatusHealth(health.WorkloadStatus)

	// Return the worse of the two
	return CalculatedHealth{
		Status:     models.MergeHealthStatus(wsStatus, reqStatus),
		ErrorRatio: errorRatio,
	}
}

// calculateRequestStatus calculates health status from request data using pre-compiled tolerances.
// Returns the worst status across all matching tolerances and the error ratio that caused it.
func (c *HealthCalculator) calculateRequestStatus(
	requests models.RequestHealth,
	tolerances []CompiledTolerance,
) (models.HealthStatus, float64) {
	if len(tolerances) == 0 {
		// No tolerances configured, use simple error detection
		return c.calculateSimpleRequestStatus(requests)
	}

	worstStatus := models.HealthStatusNA
	worstErrorRatio := float64(-1)
	hasTraffic := false

	// Process inbound traffic
	inboundStatus, inboundRatio, inboundHasTraffic := c.processDirectionalTraffic(requests.Inbound, tolerances, "inbound")
	if inboundHasTraffic {
		hasTraffic = true
		if models.HealthStatusPriority(inboundStatus) > models.HealthStatusPriority(worstStatus) {
			worstStatus = inboundStatus
			worstErrorRatio = inboundRatio
		}
	}

	// Process outbound traffic
	outboundStatus, outboundRatio, outboundHasTraffic := c.processDirectionalTraffic(requests.Outbound, tolerances, "outbound")
	if outboundHasTraffic {
		hasTraffic = true
		if models.HealthStatusPriority(outboundStatus) > models.HealthStatusPriority(worstStatus) {
			worstStatus = outboundStatus
			worstErrorRatio = outboundRatio
		}
	}

	// If we have traffic but no errors matched any tolerance, we're healthy
	if worstStatus == models.HealthStatusNA && hasTraffic {
		worstStatus = models.HealthStatusHealthy
		worstErrorRatio = 0
	}

	return worstStatus, worstErrorRatio
}

// processDirectionalTraffic processes traffic for a specific direction (inbound/outbound)
func (c *HealthCalculator) processDirectionalTraffic(
	traffic map[string]map[string]float64,
	tolerances []CompiledTolerance,
	direction string,
) (models.HealthStatus, float64, bool) {
	worstStatus := models.HealthStatusNA
	worstErrorRatio := float64(-1)
	hasTraffic := false

	// For each protocol in traffic
	for protocol, codes := range traffic {
		if len(codes) == 0 {
			continue
		}

		// For each tolerance, check if it matches this direction and protocol
		for _, tol := range tolerances {
			// Use pre-compiled regex for direction and protocol matching
			if !tol.Direction.MatchString(direction) {
				continue
			}
			if !tol.Protocol.MatchString(protocol) {
				continue
			}

			// Use pre-compiled regex for code matching
			errorCount, totalCount := c.aggregateMatchingCodes(codes, tol.Code)
			if totalCount == 0 {
				continue
			}

			hasTraffic = true
			errorRatio := (errorCount / totalCount) * 100

			status := c.applyThresholds(errorRatio, float64(tol.Degraded), float64(tol.Failure))

			if models.HealthStatusPriority(status) > models.HealthStatusPriority(worstStatus) {
				worstStatus = status
				worstErrorRatio = errorRatio
			}
		}
	}

	return worstStatus, worstErrorRatio, hasTraffic
}

// aggregateMatchingCodes sums up request counts, identifying which match the code pattern as errors.
// Uses pre-compiled regex for efficient matching.
func (c *HealthCalculator) aggregateMatchingCodes(codes map[string]float64, codeRegex *regexp.Regexp) (errorCount, totalCount float64) {
	for code, count := range codes {
		totalCount += count
		if codeRegex.MatchString(code) {
			errorCount += count
		}
	}
	return errorCount, totalCount
}

// applyThresholds determines the health status based on error ratio and thresholds
// This matches frontend behavior where:
// - Only check thresholds if there are errors (errorRatio > 0)
// - When degraded=0 (not set), any error > 0% triggers degraded
// - When failure=0 (not set), skip failure check
func (c *HealthCalculator) applyThresholds(errorRatio, degraded, failure float64) models.HealthStatus {
	if errorRatio <= 0 {
		// No errors, healthy
		return models.HealthStatusHealthy
	}

	// There are errors, check thresholds
	if failure > 0 && errorRatio >= failure {
		return models.HealthStatusFailure
	}
	if errorRatio >= degraded {
		// When degraded=0, any errorRatio > 0 will satisfy this (since we already
		// checked errorRatio > 0 above)
		return models.HealthStatusDegraded
	}
	return models.HealthStatusHealthy
}

// calculateSimpleRequestStatus calculates a simple status when no tolerances are configured
func (c *HealthCalculator) calculateSimpleRequestStatus(requests models.RequestHealth) (models.HealthStatus, float64) {
	errorRatio := requests.GetErrorRatio()

	if errorRatio < 0 {
		return models.HealthStatusNA, -1
	}

	// Use default thresholds (matching AddHealthDefault in config.go)
	errorPct := errorRatio * 100
	if errorPct >= 10 {
		return models.HealthStatusFailure, errorPct
	}
	if errorPct >= 0.1 {
		return models.HealthStatusDegraded, errorPct
	}
	return models.HealthStatusHealthy, errorPct
}

// CalculateNamespaceAppHealth calculates health status for all apps in a namespace
func (c *HealthCalculator) CalculateNamespaceAppHealth(
	namespace string,
	health models.NamespaceAppHealth,
	annotationsMap map[string]map[string]string, // key: app name
) map[string]CalculatedHealth {
	result := make(map[string]CalculatedHealth, len(health))
	for name, appHealth := range health {
		annotations := annotationsMap[name]
		result[name] = c.CalculateAppHealth(namespace, name, appHealth, annotations)
	}
	return result
}

// CalculateNamespaceServiceHealth calculates health status for all services in a namespace
func (c *HealthCalculator) CalculateNamespaceServiceHealth(
	namespace string,
	health models.NamespaceServiceHealth,
	annotationsMap map[string]map[string]string, // key: service name
) map[string]CalculatedHealth {
	result := make(map[string]CalculatedHealth, len(health))
	for name, svcHealth := range health {
		annotations := annotationsMap[name]
		result[name] = c.CalculateServiceHealth(namespace, name, svcHealth, annotations)
	}
	return result
}

// CalculateNamespaceWorkloadHealth calculates health status for all workloads in a namespace
func (c *HealthCalculator) CalculateNamespaceWorkloadHealth(
	namespace string,
	health models.NamespaceWorkloadHealth,
	annotationsMap map[string]map[string]string, // key: workload name
) map[string]CalculatedHealth {
	result := make(map[string]CalculatedHealth, len(health))
	for name, wkHealth := range health {
		annotations := annotationsMap[name]
		result[name] = c.CalculateWorkloadHealth(namespace, name, wkHealth, annotations)
	}
	return result
}

// GetCompiledTolerancesForDirection returns pre-compiled tolerances for an entity filtered by direction.
// This is used for edge health calculation where we need outbound tolerances for
// the source node and inbound tolerances for the destination node.
func (c *HealthCalculator) GetCompiledTolerancesForDirection(
	namespace, name, kind, direction string,
	annotations map[string]string,
) []CompiledTolerance {
	// Get pre-compiled tolerances (with annotation override if present)
	tolerances := c.matcher.GetCompiledTolerances(namespace, name, kind, annotations)

	// Filter by direction using pre-compiled regex
	var filtered []CompiledTolerance
	for _, tol := range tolerances {
		if tol.Direction.MatchString(direction) {
			filtered = append(filtered, tol)
		}
	}
	return filtered
}
