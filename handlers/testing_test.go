package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func TestGraphCacheMetricsHandler(t *testing.T) {
	// Create a test HTTP request
	req := httptest.NewRequest("GET", "/api/test/metrics/graph/cache", nil)
	w := httptest.NewRecorder()

	// Call the handler
	handler := GraphCacheMetricsHandler()
	handler.ServeHTTP(w, req)

	// Check response
	assert.Equal(t, http.StatusOK, w.Code)

	var metrics GraphCacheMetrics
	err := json.Unmarshal(w.Body.Bytes(), &metrics)
	require.NoError(t, err)

	// Verify the response structure (values should be >= 0)
	assert.GreaterOrEqual(t, metrics.GraphCacheEvictions, float64(0))
	assert.GreaterOrEqual(t, metrics.GraphCacheHits, float64(0))
	assert.GreaterOrEqual(t, metrics.GraphCacheMisses, float64(0))
}

func TestHealthCacheMetricsHandler(t *testing.T) {
	// Create a test HTTP request
	req := httptest.NewRequest("GET", "/api/test/metrics/health/cache", nil)
	w := httptest.NewRecorder()

	// Call the handler
	handler := HealthCacheMetricsHandler()
	handler.ServeHTTP(w, req)

	// Check response
	assert.Equal(t, http.StatusOK, w.Code)

	var metrics HealthCacheMetrics
	err := json.Unmarshal(w.Body.Bytes(), &metrics)
	require.NoError(t, err)

	// Verify the response structure (values should be >= 0)
	assert.GreaterOrEqual(t, metrics.HealthCacheHits, float64(0))
	assert.GreaterOrEqual(t, metrics.HealthCacheMisses, float64(0))
}

func TestHealthStatusMetricsHandler(t *testing.T) {
	// Create a test HTTP request
	req := httptest.NewRequest("GET", "/api/test/metrics/health/status", nil)
	w := httptest.NewRecorder()

	// Call the handler
	handler := HealthStatusMetricsHandler()
	handler.ServeHTTP(w, req)

	// Check response
	assert.Equal(t, http.StatusOK, w.Code)

	var response HealthStatusMetrics
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify the response structure
	// Metrics array can be empty if no health data has been cached yet, but should not be nil
	assert.GreaterOrEqual(t, len(response.Metrics), 0)
}

func TestHealthStatusMetricsHandlerWithData(t *testing.T) {
	// Setup: Add some test health status metrics
	gaugeVec := internalmetrics.GetHealthStatusMetric()

	// Clean up any existing test data first
	gaugeVec.Reset()

	// Add test data
	gaugeVec.WithLabelValues("test-cluster", "test-namespace", "app", "test-app").Set(0) // Healthy
	gaugeVec.WithLabelValues("test-cluster", "test-namespace", "app", "failing-app").Set(3) // Failure

	// Create a test HTTP request
	req := httptest.NewRequest("GET", "/api/test/metrics/health/status", nil)
	w := httptest.NewRecorder()

	// Call the handler
	handler := HealthStatusMetricsHandler()
	handler.ServeHTTP(w, req)

	// Check response
	assert.Equal(t, http.StatusOK, w.Code)

	var response HealthStatusMetrics
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify we have at least 2 metrics
	assert.GreaterOrEqual(t, len(response.Metrics), 2)

	// Find our test metrics
	var healthyApp, failingApp *HealthStatusMetricItem
	for i := range response.Metrics {
		metric := &response.Metrics[i]
		if metric.Name == "test-app" {
			healthyApp = metric
		}
		if metric.Name == "failing-app" {
			failingApp = metric
		}
	}

	// Verify the healthy app metric
	require.NotNil(t, healthyApp, "test-app metric should exist")
	assert.Equal(t, "test-cluster", healthyApp.Cluster)
	assert.Equal(t, "test-namespace", healthyApp.Namespace)
	assert.Equal(t, "app", healthyApp.HealthType)
	assert.Equal(t, "test-app", healthyApp.Name)
	assert.Equal(t, float64(0), healthyApp.Value)

	// Verify the failing app metric
	require.NotNil(t, failingApp, "failing-app metric should exist")
	assert.Equal(t, "test-cluster", failingApp.Cluster)
	assert.Equal(t, "test-namespace", failingApp.Namespace)
	assert.Equal(t, "app", failingApp.HealthType)
	assert.Equal(t, "failing-app", failingApp.Name)
	assert.Equal(t, float64(3), failingApp.Value)

	// Cleanup
	gaugeVec.Reset()
}

func TestGetGaugeVecValues(t *testing.T) {
	// Create a new gauge vec for testing
	testGaugeVec := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "test_health_status",
			Help: "Test health status gauge",
		},
		[]string{"cluster", "namespace", "health_type", "name"},
	)

	// Add some test data
	testGaugeVec.WithLabelValues("cluster1", "ns1", "app", "app1").Set(0)
	testGaugeVec.WithLabelValues("cluster1", "ns2", "service", "svc1").Set(2)
	testGaugeVec.WithLabelValues("cluster2", "ns1", "workload", "wl1").Set(3)

	// Call the function
	items := getGaugeVecValues(testGaugeVec)

	// Verify results
	assert.Len(t, items, 3)

	// Check that we have all expected values
	clusters := make(map[string]bool)
	namespaces := make(map[string]bool)
	healthTypes := make(map[string]bool)
	names := make(map[string]bool)

	for _, item := range items {
		clusters[item.Cluster] = true
		namespaces[item.Namespace] = true
		healthTypes[item.HealthType] = true
		names[item.Name] = true

		// Verify all fields are populated
		assert.NotEmpty(t, item.Cluster)
		assert.NotEmpty(t, item.Namespace)
		assert.NotEmpty(t, item.HealthType)
		assert.NotEmpty(t, item.Name)
		assert.GreaterOrEqual(t, item.Value, float64(0))
		assert.LessOrEqual(t, item.Value, float64(3))
	}

	assert.True(t, clusters["cluster1"])
	assert.True(t, clusters["cluster2"])
	assert.True(t, namespaces["ns1"])
	assert.True(t, namespaces["ns2"])
	assert.True(t, healthTypes["app"])
	assert.True(t, healthTypes["service"])
	assert.True(t, healthTypes["workload"])
	assert.True(t, names["app1"])
	assert.True(t, names["svc1"])
	assert.True(t, names["wl1"])
}

func TestGetCounterValue(t *testing.T) {
	// Create a test counter
	counter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "test_counter",
		Help: "Test counter",
	})

	// Initially should be 0
	assert.Equal(t, float64(0), getCounterValue(counter))

	// Increment and check
	counter.Inc()
	assert.Equal(t, float64(1), getCounterValue(counter))

	counter.Add(5)
	assert.Equal(t, float64(6), getCounterValue(counter))
}

func TestGetCounterVecTotal(t *testing.T) {
	// Create a test counter vec
	counterVec := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_counter_vec",
			Help: "Test counter vec",
		},
		[]string{"label1", "label2"},
	)

	// Initially should be 0
	assert.Equal(t, float64(0), getCounterVecTotal(counterVec))

	// Add some values with different labels
	counterVec.WithLabelValues("a", "1").Add(10)
	counterVec.WithLabelValues("a", "2").Add(20)
	counterVec.WithLabelValues("b", "1").Add(15)

	// Total should be sum of all counters
	assert.Equal(t, float64(45), getCounterVecTotal(counterVec))
}
