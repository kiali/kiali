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

func TestCalculateNamespaceAppHealth(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := models.NamespaceAppHealth{
		"app1": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{DesiredReplicas: 1, CurrentReplicas: 1, AvailableReplicas: 1, SyncedProxies: 1},
			},
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{"http": {"200": 100}},
			},
		},
		"app2": &models.AppHealth{
			WorkloadStatuses: []*models.WorkloadStatus{
				{DesiredReplicas: 1, CurrentReplicas: 1, AvailableReplicas: 0}, // Failure
			},
			Requests: models.RequestHealth{},
		},
	}

	result := calc.CalculateNamespaceAppHealth("test", health, nil)
	assert.Len(t, result, 2)
	assert.Equal(t, models.HealthStatusHealthy, result["app1"].Status)
	assert.Equal(t, models.HealthStatusFailure, result["app2"].Status)
}

func TestCalculateNamespaceServiceHealth(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := models.NamespaceServiceHealth{
		"svc1": &models.ServiceHealth{
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{"http": {"200": 100}},
			},
		},
		"svc2": &models.ServiceHealth{
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{"http": {"200": 100, "500": 30}}, // ~23% errors
			},
		},
	}

	result := calc.CalculateNamespaceServiceHealth("test", health, nil)
	assert.Len(t, result, 2)
	assert.Equal(t, models.HealthStatusHealthy, result["svc1"].Status)
	assert.Equal(t, models.HealthStatusFailure, result["svc2"].Status)
}

func TestCalculateNamespaceWorkloadHealth(t *testing.T) {
	conf := setupTestConfig()
	calc := NewHealthCalculator(conf)

	health := models.NamespaceWorkloadHealth{
		"wk1": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 2,
				SyncedProxies:     2, // Must set to avoid "not synced" degraded status
			},
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{"http": {"200": 100}},
			},
		},
		"wk2": &models.WorkloadHealth{
			WorkloadStatus: &models.WorkloadStatus{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 1, // Degraded
			},
			Requests: models.RequestHealth{},
		},
	}

	result := calc.CalculateNamespaceWorkloadHealth("test", health, nil)
	assert.Len(t, result, 2)
	assert.Equal(t, models.HealthStatusHealthy, result["wk1"].Status)
	assert.Equal(t, models.HealthStatusDegraded, result["wk2"].Status)
}
