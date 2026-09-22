package business

import (
	"context"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	pmock "github.com/kiali/kiali/prometheus/prometheustest"
)

func TestClassifyEnvoyMemorySidecar(t *testing.T) {
	threshold := float64(sidecarHighMemoryBytes)

	cause := classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 100, 0, 0)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 10, 10, 5)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 10, 0, 0)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold-1, 200, 0, 0)
	assert.Equal(t, models.EnvoyMemoryCauseOK, cause)
}

func TestClassifyEnvoyMemoryGateway(t *testing.T) {
	threshold := float64(gatewayHighMemoryBytes)

	cause := classifyEnvoyMemory(threshold, gatewayLargeConfigClusters, threshold+1, 200, 0, 0)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, gatewayLargeConfigClusters, threshold+1, 10, 0, 0)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)
}

func TestComputeEnvoyMemoryThreshold(t *testing.T) {
	assert.Equal(t, float64(sidecarHighMemoryBytes), computeEnvoyMemoryThreshold(float64(sidecarHighMemoryBytes), 0))
	assert.Equal(t, 700.0, computeEnvoyMemoryThreshold(float64(sidecarHighMemoryBytes), 1000))
}

func TestEnvoyProxyMemoryLimitFromAnnotations(t *testing.T) {
	workload := &models.Workload{
		Pods: models.Pods{
			&models.Pod{
				Annotations: map[string]string{
					istioProxyMemoryLimitAnnotation: "512Mi",
				},
			},
		},
	}

	assert.Equal(t, float64(512*1024*1024), envoyProxyMemoryLimitFromAnnotations(workload))
}

func TestBuildWorkloadMetricLabelsUsesAppLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.CustomDashboards.NamespaceLabel = "namespace"

	workload := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Namespace: "bookinfo",
			Labels: map[string]string{
				"app":     "productpage",
				"version": "v1",
			},
		},
	}

	labels := BuildWorkloadMetricLabels(conf, workload)
	assert.Equal(t, `{namespace="bookinfo",app="productpage",version="v1"}`, labels)
}

func TestBuildWorkloadMetricLabelsUsesGatewayLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.CustomDashboards.NamespaceLabel = "namespace"

	workload := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Namespace: "bookinfo",
			Labels: map[string]string{
				"gateway.networking.k8s.io/gateway-name": "waypoint",
			},
		},
	}

	labels := BuildWorkloadMetricLabels(conf, workload)
	assert.Equal(t, `{namespace="bookinfo",gateway_networking_k8s_io_gateway_name="waypoint"}`, labels)
}

func TestSumEnvoyTrafficSignals(t *testing.T) {
	assert := assert.New(t)

	upstream := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(2.5)}}},
		},
	}
	downstream := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(7.5)}}},
		},
	}

	assert.Equal(10.0, sumEnvoyRequestRate(upstream, downstream))
	assert.Equal(int64(10), sumEnvoyActiveConnections(upstream, downstream))
	assert.Equal(2.5, sumEnvoyRequestRate(upstream, prometheus.Metric{}))
}

func TestMaxRequestRate(t *testing.T) {
	assert.Equal(t, 0.0, maxRequestRate())
	assert.Equal(t, 7.5, maxRequestRate(0, 2.5, 7.5))
	assert.Equal(t, 12.0, maxRequestRate(12.0, 3.0))
}

func TestRequestRatePrefersIstioWhenEnvoyAbsent(t *testing.T) {
	envoyOnly := envoyRequestRateFromMetrics(prometheus.Metric{}, prometheus.Metric{}, prometheus.Metric{})
	istio := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(1.25)}}},
		},
	}
	assert.Equal(t, 1.25, maxRequestRate(envoyOnly, sumLatestValues(istio)))
}

func TestFetchEnvoyDownstreamRequestRateUsesTotalSuffixFallback(t *testing.T) {
	prom := new(pmock.PromClientMock)
	labels := `{namespace="bookinfo",app="productpage"}`
	q := &prometheus.RangeQuery{}
	q.FillDefaults()

	prom.On("FetchRateRange", mock.Anything, "envoy_listener_http_downstream_rq", []string{labels}, "", q).
		Return(prometheus.Metric{})
	prom.On("FetchRateRange", mock.Anything, "envoy_listener_http_downstream_rq_total", []string{labels}, "", q).
		Return(prometheus.Metric{
			Matrix: model.Matrix{
				&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(4)}}},
			},
		})

	metric := fetchEnvoyDownstreamRequestRate(context.Background(), prom, labels, q)
	assert.Equal(t, 4.0, sumLatestValues(metric))
}

func TestEnvoyRequestRateFromMetricsUsesUpstreamVariants(t *testing.T) {
	upstreamTotal := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(3)}}},
		},
	}
	upstream := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(4)}}},
		},
	}
	downstream := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(2)}}},
		},
	}
	emptyMetric := prometheus.Metric{}

	assert.Equal(t, 5.0, envoyRequestRateFromMetrics(upstreamTotal, upstream, downstream))
	assert.Equal(t, 4.0, envoyRequestRateFromMetrics(emptyMetric, upstream, emptyMetric))
}

func TestHasEnvoyProxyWorkload(t *testing.T) {
	workload := &models.Workload{
		Pods: models.Pods{
			&models.Pod{Labels: map[string]string{config.IstioAppLabel: config.Ztunnel}},
		},
	}
	assert.False(t, HasEnvoyProxyWorkload(workload))

	workload = &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Labels: map[string]string{"istio": "ingressgateway"},
		},
	}
	assert.True(t, HasEnvoyProxyWorkload(workload))

	workload = &models.Workload{
		Pods: models.Pods{
			&models.Pod{IstioContainers: []*models.ContainerInfo{{Name: "istio-proxy"}}},
		},
	}
	assert.True(t, HasEnvoyProxyWorkload(workload))
}
