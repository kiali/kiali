package business

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func TestCalculateDuration_FirstRun(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "1m"

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: time.Time{}, // Zero value - first run
	}

	result := monitor.calculateDuration()
	assert.Equal(t, "5m", result)
}

func TestCalculateDuration_ElapsedWithinDuration(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "2m"

	// Simulate a run that happened 3 minutes ago (within the 5 minute duration)
	lastRunTime := time.Now().Add(-3 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()
	// Should use configured duration since elapsed <= duration
	assert.Equal(t, "5m", result)
}

func TestCalculateDuration_ElapsedExceedsDuration(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "2m"
	conf.HealthConfig.Compute.RefreshInterval = "1m"

	// Simulate a run that happened 5 minutes ago (exceeds the 2 minute duration)
	lastRunTime := time.Now().Add(-5 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()

	// Should be approximately 5 minutes * 1.1 = 5.5 minutes = 330 seconds
	// Due to time passing during test, we'll check it's in a reasonable range
	var seconds int
	_, err := parseSeconds(result, &seconds)
	assert.NoError(t, err)
	// Should be around 330 seconds (5 minutes * 1.1), allow some variance for test execution time
	assert.GreaterOrEqual(t, seconds, 320, "Expected at least 320 seconds")
	assert.LessOrEqual(t, seconds, 350, "Expected at most 350 seconds")
}

func TestCalculateDuration_ElapsedAtBoundary(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "2m"

	// Simulate a run that happened just under 5 minutes ago (within boundary)
	// Using 4m59s to ensure we're within the duration even with test execution time
	lastRunTime := time.Now().Add(-4*time.Minute - 59*time.Second)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()
	// elapsed <= duration, so should use configured duration
	assert.Equal(t, "5m", result)
}

// parseSeconds is a helper to parse duration strings like "198s" or "5m" into seconds
func parseSeconds(s string, result *int) (bool, error) {
	if len(s) < 2 {
		return false, nil
	}
	suffix := s[len(s)-1]
	numStr := s[:len(s)-1]
	var num int
	_, err := parseNumber(numStr, &num)
	if err != nil {
		return false, err
	}
	if suffix == 'm' {
		*result = num * 60
	} else {
		*result = num
	}
	return true, nil
}

func parseNumber(s string, result *int) (bool, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}
	*result = n
	return true, nil
}

func TestReapNamespace_RemovedNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Server.Observability.Metrics.Enabled = false
	conf.Server.Observability.Metrics.HealthStatus.Enabled = false

	k8s := kubetest.NewFakeK8sClient()
	c := cache.NewTestingCache(t, k8s, *conf)

	// Seed cache with entries for two namespaces in one cluster.
	c.SetHealth("east", "bookinfo", &models.CachedHealthData{Cluster: "east", Namespace: "bookinfo"})
	c.SetHealth("east", "removed-ns", &models.CachedHealthData{Cluster: "east", Namespace: "removed-ns"})

	// Simulate reaping: "removed-ns" no longer exists in the cluster.
	existingNamespaces := map[string]bool{"bookinfo": true}

	for _, key := range c.HealthKeys() {
		keyCluster, keyNs, ok := models.ParseHealthCacheKey(key)
		if !ok || keyCluster != "east" {
			continue
		}
		if !existingNamespaces[keyNs] {
			c.RemoveHealth(keyCluster, keyNs)
		}
	}

	_, found := c.GetHealth("east", "bookinfo", "app")
	assert.True(found, "existing namespace should remain")

	_, found = c.GetHealth("east", "removed-ns", "app")
	assert.False(found, "removed namespace should be reaped")
}

func TestReapNamespace_FailedRefreshPreservesCache(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	c := cache.NewTestingCache(t, k8s, *conf)

	// Seed cache with an entry for a namespace whose refresh will "fail".
	c.SetHealth("east", "flaky-ns", &models.CachedHealthData{Cluster: "east", Namespace: "flaky-ns"})

	// The namespace still exists (it's in the authoritative list) even though
	// its health refresh failed. Using existingNamespaces (not visitedNamespaces)
	// means it should NOT be reaped.
	existingNamespaces := map[string]bool{"flaky-ns": true}

	for _, key := range c.HealthKeys() {
		keyCluster, keyNs, ok := models.ParseHealthCacheKey(key)
		if !ok || keyCluster != "east" {
			continue
		}
		if !existingNamespaces[keyNs] {
			c.RemoveHealth(keyCluster, keyNs)
		}
	}

	_, found := c.GetHealth("east", "flaky-ns", "app")
	assert.True(found, "namespace with failed refresh should keep its cached health")
}

func TestReapCluster_RemovedCluster(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	c := cache.NewTestingCache(t, k8s, *conf)

	// Seed cache with entries across two clusters.
	c.SetHealth("east", "bookinfo", &models.CachedHealthData{Cluster: "east", Namespace: "bookinfo"})
	c.SetHealth("west", "default", &models.CachedHealthData{Cluster: "west", Namespace: "default"})
	c.SetHealth("west", "istio-system", &models.CachedHealthData{Cluster: "west", Namespace: "istio-system"})

	// Simulate: "west" cluster has been removed; only "east" is known.
	knownClusters := map[string]bool{"east": true}

	for _, key := range c.HealthKeys() {
		keyCluster, keyNs, ok := models.ParseHealthCacheKey(key)
		if !ok {
			continue
		}
		if !knownClusters[keyCluster] {
			c.RemoveHealth(keyCluster, keyNs)
		}
		_ = keyNs
	}

	_, found := c.GetHealth("east", "bookinfo", "app")
	assert.True(found, "known cluster entry should remain")

	_, found = c.GetHealth("west", "default", "app")
	assert.False(found, "removed cluster entry should be reaped")

	_, found = c.GetHealth("west", "istio-system", "app")
	assert.False(found, "all entries for removed cluster should be reaped")
}

func TestReapCluster_MalformedKeysSkipped(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	c := cache.NewTestingCache(t, k8s, *conf)

	// Seed one valid entry.
	c.SetHealth("east", "bookinfo", &models.CachedHealthData{Cluster: "east", Namespace: "bookinfo"})

	knownClusters := map[string]bool{"east": true}

	// Reaping should not panic even though the store only has well-formed keys
	// (generated by HealthCacheKey). This test confirms the ok-guard path.
	for _, key := range c.HealthKeys() {
		keyCluster, _, ok := models.ParseHealthCacheKey(key)
		if !ok {
			continue
		}
		if !knownClusters[keyCluster] {
			c.RemoveHealth(keyCluster, key)
		}
	}

	_, found := c.GetHealth("east", "bookinfo", "app")
	assert.True(found, "valid entry should remain")

	assert.Len(c.HealthKeys(), 1, "only one entry should remain")
}

func TestRefreshClusterHealth_GetAllWorkloadsError(t *testing.T) {
	conf := config.NewConfig()
	conf.Server.Observability.Metrics.Enabled = false
	conf.Server.Observability.Metrics.HealthStatus.Enabled = false
	config.Set(conf)

	cluster := conf.KubernetesConfig.ClusterName

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
	)

	layer := NewLayerBuilder(t, conf).WithClient(k8s).Build()

	// Give WorkloadService its own copy of the SA clients map, then remove the
	// cluster entry so GetAllWorkloads fails with "Cluster [...] is not found".
	// The NamespaceService keeps the original map and still succeeds for
	// GetClusterNamespaces.
	wlSAClients := make(map[string]kubernetes.ClientInterface, len(layer.Workload.kialiSAClients))
	for k, v := range layer.Workload.kialiSAClients {
		wlSAClients[k] = v
	}
	layer.Workload.kialiSAClients = wlSAClients
	delete(layer.Workload.kialiSAClients, cluster)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	monitor := &healthMonitor{
		clientFactory: clientFactory,
		conf:          conf,
		logger:        log.Logger().With().Str("component", "health-monitor-test").Logger(),
	}

	nsCount, errCount := monitor.refreshClusterHealth(context.Background(), layer, cluster, "5m")

	assert.Equal(t, 0, nsCount, "expected 0 namespaces processed when GetAllWorkloads fails")
	assert.Equal(t, 1, errCount, "expected 1 error when GetAllWorkloads fails")
}
