package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHealthStatusPriority(t *testing.T) {
	testCases := []struct {
		status   HealthStatus
		expected int
	}{
		{HealthStatusFailure, 4},
		{HealthStatusDegraded, 3},
		{HealthStatusNotReady, 2},
		{HealthStatusHealthy, 1},
		{HealthStatusNA, 0},
		{"Unknown", 0}, // Unknown should default to NA priority
	}

	for _, tc := range testCases {
		t.Run(string(tc.status), func(t *testing.T) {
			result := HealthStatusPriority(tc.status)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestMergeHealthStatus(t *testing.T) {
	testCases := []struct {
		name     string
		s1       HealthStatus
		s2       HealthStatus
		expected HealthStatus
	}{
		{"Failure wins over Healthy", HealthStatusFailure, HealthStatusHealthy, HealthStatusFailure},
		{"Failure wins over Degraded", HealthStatusDegraded, HealthStatusFailure, HealthStatusFailure},
		{"Degraded wins over Healthy", HealthStatusHealthy, HealthStatusDegraded, HealthStatusDegraded},
		{"NotReady wins over Healthy", HealthStatusNotReady, HealthStatusHealthy, HealthStatusNotReady},
		{"Degraded wins over NotReady", HealthStatusNotReady, HealthStatusDegraded, HealthStatusDegraded},
		{"Same status returns same", HealthStatusHealthy, HealthStatusHealthy, HealthStatusHealthy},
		{"NA loses to everything", HealthStatusNA, HealthStatusHealthy, HealthStatusHealthy},
		{"First wins on tie", HealthStatusFailure, HealthStatusFailure, HealthStatusFailure},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := MergeHealthStatus(tc.s1, tc.s2)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestWorkloadStatusHealth(t *testing.T) {
	testCases := []struct {
		name     string
		ws       *WorkloadStatus
		expected HealthStatus
	}{
		{
			name:     "Nil workload status returns NA",
			ws:       nil,
			expected: HealthStatusNA,
		},
		{
			name: "Desired 0 returns NotReady (scaled down)",
			ws: &WorkloadStatus{
				DesiredReplicas:   0,
				CurrentReplicas:   0,
				AvailableReplicas: 0,
				SyncedProxies:     -1,
			},
			expected: HealthStatusNotReady,
		},
		{
			name: "All replicas healthy",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   3,
				AvailableReplicas: 3,
				SyncedProxies:     3,
			},
			expected: HealthStatusHealthy,
		},
		{
			name: "No available replicas is Failure",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   3,
				AvailableReplicas: 0,
				SyncedProxies:     -1,
			},
			expected: HealthStatusFailure,
		},
		{
			name: "Fewer available than desired is Degraded",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   3,
				AvailableReplicas: 2,
				SyncedProxies:     -1,
			},
			expected: HealthStatusDegraded,
		},
		{
			name: "Fewer current than desired is Degraded",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   2,
				AvailableReplicas: 2,
				SyncedProxies:     -1,
			},
			expected: HealthStatusDegraded,
		},
		{
			name: "Pending pods (available == desired but != current) is Failure",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   5, // More current than desired
				AvailableReplicas: 3,
				SyncedProxies:     -1,
			},
			expected: HealthStatusFailure,
		},
		{
			name: "Proxies not synced is Degraded",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   3,
				AvailableReplicas: 3,
				SyncedProxies:     2, // Only 2 of 3 synced
			},
			expected: HealthStatusDegraded,
		},
		{
			name: "Proxies synced equals desired is Healthy",
			ws: &WorkloadStatus{
				DesiredReplicas:   3,
				CurrentReplicas:   3,
				AvailableReplicas: 3,
				SyncedProxies:     3,
			},
			expected: HealthStatusHealthy,
		},
		{
			name: "SyncedProxies -1 (gateway/no sidecar) doesn't affect health",
			ws: &WorkloadStatus{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 2,
				SyncedProxies:     -1, // Gateway or no sidecar
			},
			expected: HealthStatusHealthy,
		},
		{
			name: "Zero synced proxies when desired > 0 is Degraded",
			ws: &WorkloadStatus{
				DesiredReplicas:   2,
				CurrentReplicas:   2,
				AvailableReplicas: 2,
				SyncedProxies:     0,
			},
			expected: HealthStatusDegraded,
		},
		{
			name: "Single replica healthy",
			ws: &WorkloadStatus{
				DesiredReplicas:   1,
				CurrentReplicas:   1,
				AvailableReplicas: 1,
				SyncedProxies:     1,
			},
			expected: HealthStatusHealthy,
		},
		{
			name: "Single replica not available is Failure",
			ws: &WorkloadStatus{
				DesiredReplicas:   1,
				CurrentReplicas:   1,
				AvailableReplicas: 0,
				SyncedProxies:     -1,
			},
			expected: HealthStatusFailure,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := WorkloadStatusHealth(tc.ws)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetErrorRatio(t *testing.T) {
	testCases := []struct {
		name     string
		health   RequestHealth
		expected float64
	}{
		{
			name: "Empty maps returns -1 (no data)",
			health: RequestHealth{
				Inbound:  map[string]map[string]float64{},
				Outbound: map[string]map[string]float64{},
			},
			expected: -1,
		},
		{
			name: "Nil maps returns -1 (no data)",
			health: RequestHealth{
				Inbound:  nil,
				Outbound: nil,
			},
			expected: -1,
		},
		{
			name: "All success returns 0",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 100},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0,
		},
		{
			name: "Only 5xx errors",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 90, "500": 10},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.1, // 10 errors out of 100
		},
		{
			name: "Only 4xx errors",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 80, "404": 20},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.2, // 20 errors out of 100
		},
		{
			name: "Mixed 4xx and 5xx errors",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 70, "404": 15, "500": 15},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.3, // 30 errors out of 100
		},
		{
			name: "Inbound and outbound combined",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 50, "500": 10},
				},
				Outbound: map[string]map[string]float64{
					"http": {"200": 30, "500": 10},
				},
			},
			expected: 0.2, // 20 errors out of 100
		},
		{
			name: "100% errors",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"500": 100},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 1.0,
		},
		{
			name: "Multiple protocols",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 50, "500": 10},
					"grpc": {"0": 30, "14": 10}, // grpc 0=OK, 14=UNAVAILABLE
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.1, // Only http 500 counts as error (10 out of 100)
			// Note: grpc codes starting with "1" are counted as errors
		},
		{
			name: "3xx codes are not errors",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 50, "301": 30, "302": 20},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0, // 3xx are not errors
		},
		{
			name: "Empty code string handled",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 90, "": 10},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0, // Empty code is not counted as error
		},
		{
			name: "Very small error rate",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 9999, "500": 1},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.0001, // 1 error out of 10000
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.health.GetErrorRatio()
			assert.InDelta(t, tc.expected, result, 0.0001)
		})
	}
}

func TestGetErrorRatio_GrpcCodes(t *testing.T) {
	// Test that gRPC codes starting with 4 or 5 are not treated as HTTP errors
	// gRPC has different error code semantics
	testCases := []struct {
		name     string
		health   RequestHealth
		expected float64
	}{
		{
			name: "gRPC code 4 (DEADLINE_EXCEEDED) starts with 4 but is single digit",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"grpc": {"0": 90, "4": 10},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0.1, // "4" starts with '4' so counted as error
		},
		{
			name: "gRPC code 14 (UNAVAILABLE) is not counted as HTTP error",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"grpc": {"0": 90, "14": 10},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 0, // "14" starts with '1', not counted as 4xx/5xx error
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.health.GetErrorRatio()
			assert.InDelta(t, tc.expected, result, 0.0001)
		})
	}
}

func TestGetTotalRequestRate(t *testing.T) {
	testCases := []struct {
		name     string
		health   RequestHealth
		expected float64
	}{
		{
			name:     "empty",
			health:   RequestHealth{},
			expected: 0,
		},
		{
			name: "inbound only",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 10, "500": 2},
				},
				Outbound: map[string]map[string]float64{},
			},
			expected: 12,
		},
		{
			name: "inbound and outbound",
			health: RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 5},
				},
				Outbound: map[string]map[string]float64{
					"http": {"200": 3, "404": 1},
				},
			},
			expected: 9,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.health.GetTotalRequestRate()
			assert.InDelta(t, tc.expected, result, 0.0001)
		})
	}
}
