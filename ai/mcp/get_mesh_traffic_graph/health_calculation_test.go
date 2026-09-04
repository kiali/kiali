package get_mesh_traffic_graph

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
)

func TestModelsHealthStatusToSummary(t *testing.T) {
	tests := []struct {
		status   models.HealthStatus
		expected string
	}{
		{models.HealthStatusHealthy, "HEALTHY"},
		{models.HealthStatusDegraded, "DEGRADED"},
		{models.HealthStatusFailure, "UNHEALTHY"},
		{models.HealthStatusNotReady, "NOT_READY"},
		{models.HealthStatusNA, "UNKNOWN"},
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			assert.Equal(t, tt.expected, modelsHealthStatusToSummary(tt.status))
		})
	}
}

func TestEvaluateAppHealth_UsesCachedStatus(t *testing.T) {
	app := &models.AppHealth{
		Status: &models.CalculatedHealthStatus{
			ErrorRatio: 5,
			Status:     models.HealthStatusDegraded,
		},
	}

	status, issue := evaluateAppHealth(app)

	assert.Equal(t, "DEGRADED", status)
	assert.Contains(t, issue, "error rate: 5.00%")
}

func TestEvaluateAppHealth_UsesCachedStatusNotLocalThresholds(t *testing.T) {
	app := &models.AppHealth{
		Status: &models.CalculatedHealthStatus{
			ErrorRatio: 5,
			Status:     models.HealthStatusFailure,
		},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"500": 5, "200": 95},
			},
		},
	}

	status, _ := evaluateAppHealth(app)

	assert.Equal(t, "UNHEALTHY", status)
}

func TestEvaluateServiceHealth_UsesCachedStatus(t *testing.T) {
	svc := &models.ServiceHealth{
		Status: &models.CalculatedHealthStatus{
			ErrorRatio: 12,
			Status:     models.HealthStatusFailure,
		},
	}

	status, issue := evaluateServiceHealth(svc)

	assert.Equal(t, "UNHEALTHY", status)
	assert.Contains(t, issue, "error rate: 12.00%")
}

func TestStatusFromCachedHealth_MissingStatus(t *testing.T) {
	status, issue := statusFromCachedHealth(nil, nil)

	assert.Equal(t, "UNKNOWN", status)
	assert.Empty(t, issue)
}

func TestEvaluateWorkloadHealth_UsesCachedStatus(t *testing.T) {
	wl := &models.WorkloadHealth{
		Status: &models.CalculatedHealthStatus{
			Status: models.HealthStatusNotReady,
		},
		WorkloadStatus: &models.WorkloadStatus{
			AvailableReplicas: 0,
			DesiredReplicas:   0,
		},
	}

	status, issue := evaluateWorkloadHealth(wl)

	assert.Equal(t, "NOT_READY", status)
	assert.Contains(t, issue, "scaled to 0 replicas")
}

func TestIssueFromCachedStatus_PrefersWorkloadIssueOverErrorRate(t *testing.T) {
	cached := &models.CalculatedHealthStatus{
		ErrorRatio: 12,
		Status:     models.HealthStatusFailure,
	}
	workloadStatuses := []*models.WorkloadStatus{
		{
			AvailableReplicas: 1,
			DesiredReplicas:   3,
		},
	}

	issue := issueFromCachedStatus(cached, workloadStatuses)

	assert.Equal(t, "1/3 replicas available", issue)
}

func TestEvaluateWorkloadHealth_NilWorkload(t *testing.T) {
	status, issue := evaluateWorkloadHealth(nil)

	assert.Equal(t, "UNKNOWN", status)
	assert.Empty(t, issue)
}

func TestEntityErrorRate_UsesCachedStatus(t *testing.T) {
	status := &models.CalculatedHealthStatus{ErrorRatio: 25}

	assert.InDelta(t, 0.25, entityErrorRate(status), 0.001)
}
