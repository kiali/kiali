package tests

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

func TestGraphCache(t *testing.T) {
	require := require.New(t)

	ctx := contextWithTestingDeadline(t)
	dynamicClient := kube.NewDynamicClient(t)
	kubeClient := kube.NewKubeClient(t)
	instance, err := kiali.NewInstance(ctx, kubeClient, dynamicClient)
	require.NoError(err)

	// Get the current config and save the original state.
	conf, err := instance.GetConfig(ctx)
	require.NoError(err)
	originalConf := *conf

	// Enable graph cache for testing.
	conf.KialiInternal.GraphCache.Enabled = true

	t.Cleanup(func() {
		log.Debugf("Updating kiali config to original state")
		require.NoError(instance.UpdateConfig(ctx, &originalConf))
		require.NoError(instance.Restart(ctx))
	})

	require.NoError(instance.UpdateConfig(ctx, conf))
	require.NoError(instance.Restart(ctx))

	// Wait for Prometheus to scrape the updated metrics from Kiali
	// Prometheus scrape interval is typically 15 seconds, so wait 20 seconds to be safe
	log.Debugf("Waiting 20 seconds for Prometheus to scrape updated metrics...")
	time.Sleep(20 * time.Second)

	// Get internal metrics before calling the graph
	metricsBefore, statusCode, err := kiali.InternalMetricsGraphCache()
	require.NoError(err)
	require.Equal(200, statusCode)

	log.Debugf("graph cache metrics before test - hits: %v, misses: %v", metricsBefore.GraphCacheHits, metricsBefore.GraphCacheMisses)

	// Call the graph 3 times to test caching behavior.
	params := map[string]string{
		"graphType":  "app",
		"edges":      "noEdgeLabels",
		"duration":   "60s",
		"namespaces": kiali.BOOKINFO,
	}

	for i := 0; i < 3; i++ {
		graph, statusCode, err := kiali.Graph(params)
		require.NoError(err)
		require.Equal(200, statusCode)
		require.NotNil(graph.Elements)
		require.NotEmpty(graph.Elements.Nodes)
		require.NotEmpty(graph.Elements.Edges)
	}

	// Get internal metrics after calling the graph
	// No need to wait for Prometheus scraping since we're querying Kiali directly
	metricsAfter, statusCode, err := kiali.InternalMetricsGraphCache()
	require.NoError(err)
	require.Equal(200, statusCode)

	log.Debugf("graph cache metrics after test - hits: %v, misses: %v", metricsAfter.GraphCacheHits, metricsAfter.GraphCacheMisses)

	// Verify caching behavior: first call should be a miss, subsequent calls should be hits
	require.Equal(metricsBefore.GraphCacheMisses+1, metricsAfter.GraphCacheMisses, "Expected exactly one cache miss")
	require.Equal(metricsBefore.GraphCacheHits+2, metricsAfter.GraphCacheHits, "Expected exactly two cache hits")
}
