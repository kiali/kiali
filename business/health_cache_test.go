package business

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
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

	// Remove the cluster's SA client from the WorkloadService so GetAllWorkloads
	// fails with "Cluster [...] is not found", while the NamespaceService (which
	// has its own copy of the SA clients) still succeeds for GetClusterNamespaces.
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
