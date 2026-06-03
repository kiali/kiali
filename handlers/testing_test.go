package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
