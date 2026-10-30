package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/kubernetes/kubetest"
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
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("test-namespace"))
	deps := setupEndpointDepsWithClient(t, k8s)
	ts := serveGatedHandler(t, deps, "/api/test/metrics/health/status", HealthStatusMetricsHandler(deps.conf, deps.kialiCache, deps.discovery, deps.cfm))

	// No health data has been cached, so the metrics array is empty.
	internalmetrics.GetHealthStatusMetric().Reset()

	resp, err := http.Get(ts.URL + "/api/test/metrics/health/status")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response HealthStatusMetrics
	err = json.NewDecoder(resp.Body).Decode(&response)
	require.NoError(t, err)
	assert.Empty(t, response.Metrics)
}

func TestHealthStatusMetricsHandlerWithData(t *testing.T) {
	// The SA sees both namespaces; the user can only access test-namespace, so
	// the gauge entries for victim-ns must be filtered out of the response.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("test-namespace"), kubetest.FakeNamespace("victim-ns"))
	deps := setupEndpointDepsWithSAs(t,
		newRestrictedNamespaceClient(k8s, "victim-ns", []string{"test-namespace", "victim-ns"}),
		kubetest.FakeNamespace("test-namespace"), kubetest.FakeNamespace("victim-ns"))
	ts := serveGatedHandler(t, deps, "/api/test/metrics/health/status", HealthStatusMetricsHandler(deps.conf, deps.kialiCache, deps.discovery, deps.cfm))

	// Setup: Add test health status metrics. The cluster must be the user's
	// home cluster for the (cluster, namespace) pair to be accessible.
	gaugeVec := internalmetrics.GetHealthStatusMetric()

	// Clean up any existing test data first
	gaugeVec.Reset()

	// Add test data
	cluster := deps.conf.KubernetesConfig.ClusterName
	gaugeVec.WithLabelValues(cluster, "test-namespace", "app", "test-app").Set(0)    // Healthy
	gaugeVec.WithLabelValues(cluster, "test-namespace", "app", "failing-app").Set(3) // Failure
	gaugeVec.WithLabelValues(cluster, "victim-ns", "app", "secret-app").Set(3)       // Denied namespace

	resp, err := http.Get(ts.URL + "/api/test/metrics/health/status")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response HealthStatusMetrics
	err = json.NewDecoder(resp.Body).Decode(&response)
	require.NoError(t, err)

	// Only the two accessible-namespace entries are returned.
	require.Len(t, response.Metrics, 2)

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
	assert.Equal(t, cluster, healthyApp.Cluster)
	assert.Equal(t, "test-namespace", healthyApp.Namespace)
	assert.Equal(t, "app", healthyApp.HealthType)
	assert.Equal(t, "test-app", healthyApp.Name)
	assert.Equal(t, float64(0), healthyApp.Value)

	// Verify the failing app metric
	require.NotNil(t, failingApp, "failing-app metric should exist")
	assert.Equal(t, cluster, failingApp.Cluster)
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
