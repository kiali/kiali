package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

func TestNoPrometheus(t *testing.T) {
	require := require.New(t)
	kubeClientSet := kube.NewKubeClient(t)
	dynamicClient := kube.NewDynamicClient(t)

	ctx := contextWithTestingDeadline(t)

	instance, err := kiali.NewInstance(ctx, kubeClientSet, dynamicClient)
	require.NoError(err)

	cfg, err := instance.GetConfig(ctx)
	require.NoError(err)

	defer func() {
		cfg.ExternalServices.Prometheus.Enabled = true
		require.NoError(instance.UpdateConfig(ctx, cfg))
		require.NoError(instance.Restart(ctx))
	}()

	cfg.ExternalServices.Prometheus.Enabled = false
	require.NoError(instance.UpdateConfig(ctx, cfg))
	require.NoError(instance.Restart(ctx))

	t.Run("PrometheusDisabledInConfig", prometheusDisabledInConfig)
	t.Run("GraphReturnsEmptyWhenPrometheusDisabled", graphEmptyWhenPrometheusDisabled)
	t.Run("MetricsEndpointEmptyWhenPrometheusDisabled", metricsEmptyWhenPrometheusDisabled)
	t.Run("WorkloadsStillAccessibleWhenPrometheusDisabled", workloadsAccessibleWhenPrometheusDisabled)
}

func prometheusDisabledInConfig(t *testing.T) {
	require := require.New(t)
	config, code, err := kiali.KialiConfig()
	require.NoError(err)
	require.Equal(200, code)
	require.False(config.Prometheus.Enabled)
}

func graphEmptyWhenPrometheusDisabled(t *testing.T) {
	require := require.New(t)
	params := map[string]string{
		"namespaces": kiali.BOOKINFO,
		"duration":   "60s",
		"graphType":  "workload",
	}
	graph, code, err := kiali.Graph(params)
	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(graph)
	require.NotNil(graph.Elements)
	require.Empty(graph.Elements.Nodes)
	require.Empty(graph.Elements.Edges)
}

func metricsEmptyWhenPrometheusDisabled(t *testing.T) {
	require := require.New(t)
	params := map[string]string{
		"direction": "outbound",
		"reporter":  "destination",
	}
	metrics, err := kiali.NamespaceMetrics(kiali.BOOKINFO, params)
	require.NoError(err)
	require.NotNil(metrics)
	require.Empty(metrics.RequestCount)
	require.Empty(metrics.RequestErrorCount)
}

func workloadsAccessibleWhenPrometheusDisabled(t *testing.T) {
	require := require.New(t)
	wlList, err := kiali.WorkloadsList(kiali.BOOKINFO)
	require.NoError(err)
	require.NotEmpty(wlList.Workloads)
}
