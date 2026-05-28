package internalmetrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetHealthStatusMetric(t *testing.T) {
	// Call the getter function
	metric := GetHealthStatusMetric()

	// Verify it returns a non-nil GaugeVec
	require.NotNil(t, metric)
	assert.IsType(t, &prometheus.GaugeVec{}, metric)

	// Verify it's the same instance as the global Metrics.HealthStatus
	assert.Equal(t, Metrics.HealthStatus, metric)
}

func TestGetHealthStatusMetricCanBeUsed(t *testing.T) {
	// Get the metric
	metric := GetHealthStatusMetric()

	// Reset any existing values
	metric.Reset()

	// Set some test values
	metric.WithLabelValues("test-cluster", "test-ns", "app", "test-app").Set(0)
	metric.WithLabelValues("test-cluster", "test-ns", "service", "test-svc").Set(2)

	// Collect metrics to verify they were set
	ch := make(chan prometheus.Metric, 10)
	go func() {
		metric.Collect(ch)
		close(ch)
	}()

	// Count the metrics
	count := 0
	for range ch {
		count++
	}

	// Should have at least 2 metrics
	assert.GreaterOrEqual(t, count, 2)

	// Cleanup
	metric.Reset()
}
