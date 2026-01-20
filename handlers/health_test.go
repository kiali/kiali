package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

func fakeService(namespace, name string) *core_v1.Service {
	return &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app": name,
			},
		},
		Spec: core_v1.ServiceSpec{
			ClusterIP: "fromservice",
			Type:      "ClusterIP",
			Selector:  map[string]string{"app": name},
			Ports: []core_v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001,
				},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000,
				},
			},
		},
	}
}

// TestClustersHealthCacheHit tests that cached health data is returned with X-Kiali-Health-Cached: true
func TestClustersHealthCacheHit(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), fakeService("ns", "httpbin"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	url := ts.URL + "/api/clusters/health"
	mockClock()

	conf := config.NewConfig()

	// Pre-populate cache with health data (simulating what HealthMonitor does)
	cachedHealth := &models.CachedHealthData{
		AppHealth:  models.NamespaceAppHealth{},
		Cluster:    conf.KubernetesConfig.ClusterName,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Verify the X-Kiali-Health-Cached header indicates cache hit
	assert.Equal(t, "true", resp.Header.Get(HealthCachedHeader))
}

// TestClustersHealthCacheMiss tests that cache miss returns X-Kiali-Health-Cached: false
func TestClustersHealthCacheMiss(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, _ := setupClustersHealthEndpoint(t, k8s)

	// Don't populate cache - this simulates a cache miss
	url := ts.URL + "/api/clusters/health"
	mockClock()

	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Verify the X-Kiali-Health-Cached header indicates cache miss
	assert.Equal(t, "false", resp.Header.Get(HealthCachedHeader))
}

// TestClustersHealthWithNamespacesParam tests health endpoint with specific namespaces parameter
func TestClustersHealthWithNamespacesParam(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), fakeService("ns2", "httpbin"), setupMockData(), setupMockNamespace("ns2")}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	mockClock()
	conf := config.NewConfig()

	// Pre-populate cache for ns only
	cachedHealth := &models.CachedHealthData{
		AppHealth:  models.NamespaceAppHealth{},
		Cluster:    conf.KubernetesConfig.ClusterName,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	// Request only ns namespace (which is cached)
	url := ts.URL + "/api/clusters/health?namespaces=ns"
	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 200, resp.StatusCode, string(actual))
	assert.Equal(t, "true", resp.Header.Get(HealthCachedHeader))
}

// TestClustersHealthTypeApp tests the type=app query parameter
func TestClustersHealthTypeApp(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	mockClock()
	conf := config.NewConfig()

	// Pre-populate cache with app health data
	appHealth := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		AppHealth:  models.NamespaceAppHealth{"reviews": appHealth},
		Cluster:    conf.KubernetesConfig.ClusterName,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	url := ts.URL + "/api/clusters/health?type=app&namespaces=ns"
	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 200, resp.StatusCode, string(actual))

	// Parse response and verify app health is returned
	var result models.ClustersNamespaceHealth
	err = json.Unmarshal(actual, &result)
	require.NoError(t, err)
	assert.NotNil(t, result.AppHealth)
	assert.Contains(t, result.AppHealth, "ns")
}

// TestClustersHealthTypeService tests the type=service query parameter
func TestClustersHealthTypeService(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	mockClock()
	conf := config.NewConfig()

	// Pre-populate cache with service health data
	svcHealth := &models.ServiceHealth{
		Requests: models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		ServiceHealth: models.NamespaceServiceHealth{"reviews": svcHealth},
		Cluster:       conf.KubernetesConfig.ClusterName,
		ComputedAt:    util.Clock.Now(),
		Duration:      "2m",
		Namespace:     "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	url := ts.URL + "/api/clusters/health?type=service&namespaces=ns"
	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 200, resp.StatusCode, string(actual))

	// Parse response and verify service health is returned
	var result models.ClustersNamespaceHealth
	err = json.Unmarshal(actual, &result)
	require.NoError(t, err)
	assert.NotNil(t, result.ServiceHealth)
	assert.Contains(t, result.ServiceHealth, "ns")
}

// TestClustersHealthTypeWorkload tests the type=workload query parameter
func TestClustersHealthTypeWorkload(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	mockClock()
	conf := config.NewConfig()

	// Pre-populate cache with workload health data
	wkdHealth := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{},
		Requests:       models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		WorkloadHealth: models.NamespaceWorkloadHealth{"reviews-v1": wkdHealth},
		Cluster:        conf.KubernetesConfig.ClusterName,
		ComputedAt:     util.Clock.Now(),
		Duration:       "2m",
		Namespace:      "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	url := ts.URL + "/api/clusters/health?type=workload&namespaces=ns"
	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 200, resp.StatusCode, string(actual))

	// Parse response and verify workload health is returned
	var result models.ClustersNamespaceHealth
	err = json.Unmarshal(actual, &result)
	require.NoError(t, err)
	assert.NotNil(t, result.WorkloadHealth)
	assert.Contains(t, result.WorkloadHealth, "ns")
}

// TestClustersHealthInvalidType tests that invalid type parameter returns error
func TestClustersHealthInvalidType(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData()}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, _ := setupClustersHealthEndpoint(t, k8s)

	url := ts.URL + "/api/clusters/health?type=invalid"
	resp, err := http.Get(url)
	require.NoError(t, err)

	assert.Equal(t, 400, resp.StatusCode)
}

// TestClustersHealthPartialCacheMiss tests scenario where some namespaces are cached and some are not
func TestClustersHealthPartialCacheMiss(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), fakeService("ns2", "httpbin"), setupMockData(), setupMockNamespace("ns2")}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, kialiCache := setupClustersHealthEndpoint(t, k8s)

	mockClock()
	conf := config.NewConfig()

	// Only cache ns, not ns2
	cachedHealth := &models.CachedHealthData{
		AppHealth:  models.NamespaceAppHealth{},
		Cluster:    conf.KubernetesConfig.ClusterName,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  "ns",
	}
	kialiCache.SetHealth(conf.KubernetesConfig.ClusterName, "ns", cachedHealth)

	// Request both namespaces - one cached, one not
	url := ts.URL + "/api/clusters/health?namespaces=ns,ns2"
	resp, err := http.Get(url)
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Partial cache miss should result in X-Kiali-Health-Cached: false
	assert.Equal(t, "false", resp.Header.Get(HealthCachedHeader))
}

func setupClustersHealthEndpoint(t *testing.T, k8s *kubetest.FakeK8sClient) (*httptest.Server, cache.KialiCache) {
	conf := config.NewConfig()
	prom := new(prometheustest.PromClientMock)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	cpm := &business.FakeControlPlaneMonitor{}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), kialiCache, conf)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaService := grafana.NewService(conf, cf.GetSAHomeClusterClient())

	handler := ClusterHealth(conf, kialiCache, cf, prom, traceLoader, discovery, cpm, grafanaService)
	mr := mux.NewRouter()
	mr.HandleFunc("/api/clusters/health", WithFakeAuthInfo(conf, handler))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, kialiCache
}

func setupMockData() *core_v1.Namespace {
	mockClock()
	return &core_v1.Namespace{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "ns",
			CreationTimestamp: meta_v1.NewTime(util.Clock.Now().Add(-17 * time.Second)),
		},
	}
}

func setupMockNamespace(name string) *core_v1.Namespace {
	return &core_v1.Namespace{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              name,
			CreationTimestamp: meta_v1.NewTime(util.Clock.Now().Add(-17 * time.Second)),
		},
	}
}

// TestCacheUpdateWorkloadHealth tests that UpdateWorkloadHealth updates only the specific workload
func TestCacheUpdateWorkloadHealth(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	mockClock()
	cluster := conf.KubernetesConfig.ClusterName
	namespace := "ns"

	// Pre-populate cache with two workloads
	wkdHealth1 := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload1"},
		Requests:       models.RequestHealth{},
	}
	wkdHealth2 := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload2"},
		Requests:       models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		WorkloadHealth: models.NamespaceWorkloadHealth{
			"workload1": wkdHealth1,
			"workload2": wkdHealth2,
		},
		Cluster:    cluster,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  namespace,
	}
	kialiCache.SetHealth(cluster, namespace, cachedHealth)

	// Update only workload1 with new health
	updatedHealth := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload1", DesiredReplicas: 3, AvailableReplicas: 3},
		Requests:       models.RequestHealth{},
	}
	kialiCache.UpdateWorkloadHealth(cluster, namespace, "workload1", updatedHealth)

	// Verify workload1 was updated
	retrieved, found := kialiCache.GetHealth(cluster, namespace)
	require.True(t, found)
	require.NotNil(t, retrieved.WorkloadHealth["workload1"])
	assert.Equal(t, int32(3), retrieved.WorkloadHealth["workload1"].WorkloadStatus.DesiredReplicas)

	// Verify workload2 was NOT changed
	require.NotNil(t, retrieved.WorkloadHealth["workload2"])
	assert.Equal(t, "workload2", retrieved.WorkloadHealth["workload2"].WorkloadStatus.Name)
}

// TestCacheUpdateAppHealth tests that UpdateAppHealth updates only the specific app
func TestCacheUpdateAppHealth(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	mockClock()
	cluster := conf.KubernetesConfig.ClusterName
	namespace := "ns"

	// Pre-populate cache with two apps
	appHealth1 := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{{Name: "app1-v1"}},
		Requests:         models.RequestHealth{},
	}
	appHealth2 := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{{Name: "app2-v1"}},
		Requests:         models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		AppHealth: models.NamespaceAppHealth{
			"app1": appHealth1,
			"app2": appHealth2,
		},
		Cluster:    cluster,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  namespace,
	}
	kialiCache.SetHealth(cluster, namespace, cachedHealth)

	// Update only app1 with new health
	updatedHealth := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{{Name: "app1-v1", DesiredReplicas: 5}},
		Requests:         models.RequestHealth{},
	}
	kialiCache.UpdateAppHealth(cluster, namespace, "app1", updatedHealth)

	// Verify app1 was updated
	retrieved, found := kialiCache.GetHealth(cluster, namespace)
	require.True(t, found)
	require.NotNil(t, retrieved.AppHealth["app1"])
	assert.Equal(t, int32(5), retrieved.AppHealth["app1"].WorkloadStatuses[0].DesiredReplicas)

	// Verify app2 was NOT changed
	require.NotNil(t, retrieved.AppHealth["app2"])
	assert.Equal(t, "app2-v1", retrieved.AppHealth["app2"].WorkloadStatuses[0].Name)
}

// TestCacheUpdateServiceHealth tests that UpdateServiceHealth updates only the specific service
func TestCacheUpdateServiceHealth(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	mockClock()
	cluster := conf.KubernetesConfig.ClusterName
	namespace := "ns"

	// Pre-populate cache with two services
	svcHealth1 := &models.ServiceHealth{
		Requests: models.RequestHealth{HealthAnnotations: map[string]string{"key1": "value1"}},
	}
	svcHealth2 := &models.ServiceHealth{
		Requests: models.RequestHealth{HealthAnnotations: map[string]string{"key2": "value2"}},
	}
	cachedHealth := &models.CachedHealthData{
		ServiceHealth: models.NamespaceServiceHealth{
			"service1": svcHealth1,
			"service2": svcHealth2,
		},
		Cluster:    cluster,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  namespace,
	}
	kialiCache.SetHealth(cluster, namespace, cachedHealth)

	// Update only service1 with new health
	updatedHealth := &models.ServiceHealth{
		Requests: models.RequestHealth{HealthAnnotations: map[string]string{"updated": "true"}},
	}
	kialiCache.UpdateServiceHealth(cluster, namespace, "service1", updatedHealth)

	// Verify service1 was updated
	retrieved, found := kialiCache.GetHealth(cluster, namespace)
	require.True(t, found)
	require.NotNil(t, retrieved.ServiceHealth["service1"])
	assert.Equal(t, "true", retrieved.ServiceHealth["service1"].Requests.HealthAnnotations["updated"])

	// Verify service2 was NOT changed
	require.NotNil(t, retrieved.ServiceHealth["service2"])
	assert.Equal(t, "value2", retrieved.ServiceHealth["service2"].Requests.HealthAnnotations["key2"])
}

// TestCacheUpdateWhenNamespaceNotCached tests that individual updates are no-op when namespace not in cache
func TestCacheUpdateWhenNamespaceNotCached(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	cluster := conf.KubernetesConfig.ClusterName
	namespace := "uncached-ns"

	// Try to update a workload in an uncached namespace
	health := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload1"},
		Requests:       models.RequestHealth{},
	}
	// This should not panic or error - just be a no-op
	kialiCache.UpdateWorkloadHealth(cluster, namespace, "workload1", health)

	// Verify namespace is still not in cache
	_, found := kialiCache.GetHealth(cluster, namespace)
	assert.False(t, found)
}

// TestCacheUpdateAddsNewEntry tests that individual updates can add new entries to existing cached namespace
func TestCacheUpdateAddsNewEntry(t *testing.T) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	mockClock()
	cluster := conf.KubernetesConfig.ClusterName
	namespace := "ns"

	// Pre-populate cache with one workload
	wkdHealth1 := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload1"},
		Requests:       models.RequestHealth{},
	}
	cachedHealth := &models.CachedHealthData{
		WorkloadHealth: models.NamespaceWorkloadHealth{
			"workload1": wkdHealth1,
		},
		Cluster:    cluster,
		ComputedAt: util.Clock.Now(),
		Duration:   "2m",
		Namespace:  namespace,
	}
	kialiCache.SetHealth(cluster, namespace, cachedHealth)

	// Add a NEW workload (workload2) via individual update
	newHealth := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "workload2", DesiredReplicas: 2},
		Requests:       models.RequestHealth{},
	}
	kialiCache.UpdateWorkloadHealth(cluster, namespace, "workload2", newHealth)

	// Verify both workloads are now in cache
	retrieved, found := kialiCache.GetHealth(cluster, namespace)
	require.True(t, found)
	assert.Len(t, retrieved.WorkloadHealth, 2)
	require.NotNil(t, retrieved.WorkloadHealth["workload1"])
	require.NotNil(t, retrieved.WorkloadHealth["workload2"])
	assert.Equal(t, int32(2), retrieved.WorkloadHealth["workload2"].WorkloadStatus.DesiredReplicas)
}
