package business

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func setupTestConfig() *config.Config {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Namespace: "production",
			Kind:      "workload",
			Name:      "critical-.*",
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: "inbound", Degraded: 1, Failure: 5},
			},
		},
		{
			// Default - matches everything
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 10, Failure: 20},
				{Code: "4XX", Protocol: "http", Direction: ".*", Degraded: 10, Failure: 20},
				{Code: "^[1-9]$|^1[0-6]$", Protocol: "grpc", Direction: ".*", Degraded: 10, Failure: 20},
			},
		},
	}
	return conf
}

func TestCalculateServiceHealthHealthy(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 2, // 2% errors, below 10% degraded threshold
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateServiceHealthDegraded(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 15, // ~13% errors, above 10% degraded but below 20% failure
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateServiceHealthFailure(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 30, // ~23% errors, above 20% failure threshold
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateServiceHealthNoTraffic(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusNA, result.Status)
}

func TestCalculateServiceHealthNil(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	result := calc.CalculateServiceHealth("test", "my-service", nil, nil)
	assert.Equal(t, models.HealthStatusNA, result.Status)
}

func TestCalculateWorkloadHealthWithReplicaStatus(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	// Healthy requests but unhealthy replicas
	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{
			DesiredReplicas:   3,
			CurrentReplicas:   3,
			AvailableReplicas: 1, // Only 1 of 3 available - degraded
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
				},
			},
		},
	}

	result := calc.CalculateWorkloadHealth("test", "my-workload", health, nil)
	// Should be degraded due to replica status, even though requests are healthy
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateWorkloadHealthReplicaFailure(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{
			DesiredReplicas:   3,
			CurrentReplicas:   3,
			AvailableReplicas: 0, // No replicas available - failure
		},
		Requests: models.RequestHealth{},
	}

	result := calc.CalculateWorkloadHealth("test", "my-workload", health, nil)
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateAppHealthMergesWorkloads(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 2, // Healthy
			},
			{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 1, // Degraded
			},
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100},
			},
		},
	}

	result := calc.CalculateAppHealth("test", "my-app", health, nil)
	// Should be degraded due to one unhealthy workload
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateWithAnnotationOverride(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 3, // 3% errors
				},
			},
		},
	}

	// Without annotation: 3% is below 10% degraded threshold -> Healthy
	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusHealthy, result.Status)

	// With stricter annotation: 3% is above 2% degraded threshold -> Degraded
	annotations := map[string]string{
		HealthAnnotationKey: "5xx,2,5,http,inbound",
	}
	result = calc.CalculateServiceHealth("test", "my-service", health, annotations)
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateCriticalWorkloadWithStricterConfig(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{
			DesiredReplicas:   2,
			CurrentReplicas:   2,
			AvailableReplicas: 2,
			SyncedProxies:     2, // Must set to avoid "not synced" degraded status
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 2, // 2% errors
				},
			},
		},
	}

	// Non-critical workload: 2% is below 10% degraded threshold -> Healthy
	result := calc.CalculateWorkloadHealth("test", "regular-workload", health, nil)
	assert.Equal(t, models.HealthStatusHealthy, result.Status)

	// Critical workload in production: 2% is above 1% degraded threshold -> Degraded
	result = calc.CalculateWorkloadHealth("production", "critical-api", health, nil)
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateOutboundTraffic(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100}, // Healthy inbound
			},
			Outbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 25, // ~20% errors in outbound
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// Should be failure due to outbound errors
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateGrpcTraffic(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"grpc": {
					"0":  100, // OK
					"14": 15,  // UNAVAILABLE - ~13% errors
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// 13% is above 10% degraded but below 20% failure
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculate4xxErrors(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"404": 25, // 4xx errors ~20%
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// 20% 4xx errors should hit failure threshold
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

// ===== Edge Case Tests =====

func TestCalculateWithNoTolerancesConfigured(t *testing.T) {
	// Test with empty health config - should use simple error detection
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{} // No tolerances configured
	calc := NewHealthCalculator(conf)

	// Test with errors above default simple threshold
	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {
					"200": 100,
					"500": 15, // 15% errors - should trigger failure with default 10% threshold
				},
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// Default simple thresholds: 0.1% degraded, 10% failure
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateWithNoTolerancesHealthy(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{} // No tolerances
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 999, "500": 1}, // 0.1% errors - exactly at degraded threshold
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// 0.1% exactly equals the degraded threshold (1/1000 = 0.1%), triggers degraded
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateMixedProtocolTraffic(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	// Both HTTP and gRPC traffic
	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100, "500": 5}, // 5% HTTP errors
				"grpc": {"0": 100, "14": 15},   // 15% gRPC errors (UNAVAILABLE)
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// gRPC 15% errors is above 10% degraded threshold
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateEmptyInboundPopulatedOutbound(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{}, // No inbound traffic
			Outbound: map[string]map[string]float64{
				"http": {"200": 80, "500": 20}, // 20% errors in outbound
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// Should be failure due to outbound errors even with no inbound
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateOnlyOutboundTraffic(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{},
			Outbound: map[string]map[string]float64{
				"http": {"200": 100}, // Only healthy outbound
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateWorkloadWithNilWorkloadStatus(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.WorkloadHealth{
		WorkloadStatus: nil, // No workload status
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100, "500": 5}, // 5% errors
			},
		},
	}

	result := calc.CalculateWorkloadHealth("test", "my-workload", health, nil)
	// Should be healthy based on request health only (5% < 10% threshold)
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateAppWithNoWorkloads(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{}, // Empty workload list
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100},
			},
		},
	}

	result := calc.CalculateAppHealth("test", "my-app", health, nil)
	// Should be healthy based on request health only
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateAppWithNilWorkloadInList(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{
			nil, // Nil workload in list
			{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 2,
				SyncedProxies:     2,
			},
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100},
			},
		},
	}

	result := calc.CalculateAppHealth("test", "my-app", health, nil)
	// Nil workload returns NA, healthy workload returns Healthy
	// Healthy > NA, so overall should be Healthy
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateWithZeroDegradedThreshold(t *testing.T) {
	// Test behavior when degraded threshold is 0 (any error triggers degraded)
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 0, Failure: 10},
			},
		},
	}
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 999, "500": 1}, // 0.1% errors
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// With degraded=0, any error should trigger degraded
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateWithZeroFailureThreshold(t *testing.T) {
	// Test behavior when failure threshold is 0 (should skip failure check)
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 0},
			},
		},
	}
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 50, "500": 50}, // 50% errors
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// With failure=0, should only trigger degraded (not failure)
	assert.Equal(t, models.HealthStatusDegraded, result.Status)
}

func TestCalculateReturnsErrorRatio(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 85, "500": 15}, // 15% errors
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// Check that error ratio is correctly calculated
	assert.InDelta(t, 15.0, result.ErrorRatio, 0.1) // ~15%
}

func TestCalculateWithProtocolMismatch(t *testing.T) {
	// Test that tolerances for one protocol don't affect another
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "grpc", Direction: ".*", Degraded: 1, Failure: 5},
			},
		},
	}
	calc := NewHealthCalculator(conf)

	// HTTP traffic with high errors, but only gRPC tolerance configured
	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 50, "500": 50}, // 50% HTTP errors
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// No matching tolerance for HTTP protocol - traffic exists but no tolerance applies
	// When no tolerance matches the protocol, the traffic is not evaluated, returns NA
	assert.Equal(t, models.HealthStatusNA, result.Status)
}

func TestCalculateWithDirectionMismatch(t *testing.T) {
	// Test that inbound tolerances don't affect outbound and vice versa
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: "inbound", Degraded: 1, Failure: 5},
			},
		},
	}
	calc := NewHealthCalculator(conf)

	// High outbound errors, but only inbound tolerance configured
	health := &models.ServiceHealth{
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 100}, // Healthy inbound
			},
			Outbound: map[string]map[string]float64{
				"http": {"200": 50, "500": 50}, // 50% outbound errors
			},
		},
	}

	result := calc.CalculateServiceHealth("test", "my-service", health, nil)
	// Inbound is healthy, outbound has no matching tolerance
	assert.Equal(t, models.HealthStatusHealthy, result.Status)
}

func TestCalculateWorkloadFailureTakesPrecedenceOverDegradedRequest(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	// Workload failure + degraded request health
	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{
			DesiredReplicas:   3,
			CurrentReplicas:   3,
			AvailableReplicas: 0, // Failure
			SyncedProxies:     -1,
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 90, "500": 10}, // 10% errors - degraded
			},
		},
	}

	result := calc.CalculateWorkloadHealth("test", "my-workload", health, nil)
	// Workload failure should take precedence
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}

func TestCalculateRequestFailureTakesPrecedenceOverDegradedWorkload(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	// Degraded workload + failure request health
	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{
			DesiredReplicas:   3,
			CurrentReplicas:   3,
			AvailableReplicas: 2, // Degraded
			SyncedProxies:     -1,
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 70, "500": 30}, // 30% errors - failure
			},
		},
	}

	result := calc.CalculateWorkloadHealth("test", "my-workload", health, nil)
	// Request failure should take precedence over workload degraded
	assert.Equal(t, models.HealthStatusFailure, result.Status)
}
