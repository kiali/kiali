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

	cause := classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 200, 0, 0, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 10, 10, 50, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 10, 0, 50, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 10, 0, 0.05, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold-1, 200, 0, 0, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseOK, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, 0, 10, 0, 0, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	// HTTP-only sidecars without TCP counters must not treat 0 as proof of idle connections.
	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 50, 0, 0, false, false)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	// Large config wins over light background HTTP (demo bloat / scoped mesh).
	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 278, 1, 0.27, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 278, 10, 0.27, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 278, 1, 2.0, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, 278, 1, 120, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, cause)
}

func TestClassifyEnvoyMemoryGateway(t *testing.T) {
	threshold := float64(gatewayHighMemoryBytes)

	cause := classifyEnvoyMemory(threshold, gatewayLargeConfigClusters, threshold+1, 200, 0, 0, true, true)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	cause = classifyEnvoyMemory(threshold, gatewayLargeConfigClusters, threshold+1, 10, 0, 0, true, true)
	assert.Equal(t, models.EnvoyMemoryCauseUnknown, cause)

	// HTTP gateways report req/s; a busy gateway must not be treated as idle against the TCP byte threshold.
	cause = classifyEnvoyMemory(threshold, gatewayLargeConfigClusters, threshold+1, 200, 0, 100, false, true)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, cause)
}

func TestComputeEnvoyMemoryThreshold(t *testing.T) {
	assert.Equal(t, float64(sidecarHighMemoryBytes), computeEnvoyMemoryThreshold(float64(sidecarHighMemoryBytes), 0))
	assert.Equal(t, 700.0, computeEnvoyMemoryThreshold(float64(sidecarHighMemoryBytes), 1000))
}

func TestSelectEnvoyStatusMemory(t *testing.T) {
	peakAt := model.TimeFromUnix(2_000)
	allocated := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "pod-a"},
				Values: []model.SamplePair{{Value: model.SampleValue(100)}},
			},
		},
	}
	workingSet := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "pod-a"},
				Values: []model.SamplePair{
					{Timestamp: model.TimeFromUnix(1_000), Value: model.SampleValue(150)},
					{Timestamp: peakAt, Value: model.SampleValue(200)},
					{Timestamp: model.TimeFromUnix(3_000), Value: model.SampleValue(175)},
				},
			},
		},
	}

	selection := selectEnvoyStatusMemory(100, allocated, workingSet, map[string]float64{"pod-a": 1000})
	assert.Equal(t, 1000.0, selection.LimitBytes)
	assert.Equal(t, 200.0, selection.MaxBytes)
	assert.Equal(t, models.EnvoyMemoryMetricWorkingSet, selection.Metric)
	assert.Equal(t, "pod-a", selection.Pod)
	assert.Equal(t, peakAt, selection.PeakAt)
	assert.Equal(t, 700.0, selection.ThresholdBytes)

	selection = selectEnvoyStatusMemory(100, allocated, prometheus.Metric{}, map[string]float64{"pod-a": 1000})
	assert.Equal(t, 100.0, selection.MaxBytes)
	assert.Equal(t, models.EnvoyMemoryMetricAllocated, selection.Metric)
	// Allocated is not cgroup usage, so it keeps the absolute threshold when the
	// limit-based one would be looser (70% of 1000 = 700 > 100).
	assert.Equal(t, 100.0, selection.ThresholdBytes)

	// A small proxy limit tightens the allocated threshold to 70% of the limit.
	selection = selectEnvoyStatusMemory(100, allocated, prometheus.Metric{}, map[string]float64{"pod-a": 100})
	assert.Equal(t, models.EnvoyMemoryMetricAllocated, selection.Metric)
	assert.Equal(t, 70.0, selection.ThresholdBytes)
}

func TestSelectEnvoyStatusMemoryFallsBackPerPod(t *testing.T) {
	workingSet := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "pod-a"},
				Values: []model.SamplePair{{Value: model.SampleValue(90)}},
			},
		},
	}
	allocated := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "pod-b"},
				Values: []model.SamplePair{{Value: model.SampleValue(300)}},
			},
		},
	}

	// A working-set scrape gap on pod-b must not discard its allocated pressure.
	selection := selectEnvoyStatusMemory(100, allocated, workingSet, nil)
	assert.Equal(t, "pod-b", selection.Pod)
	assert.Equal(t, 300.0, selection.MaxBytes)
	assert.Equal(t, models.EnvoyMemoryMetricAllocated, selection.Metric)
}

func TestSelectHighestMemoryPressureTieBreakIsDeterministic(t *testing.T) {
	peaksByPod := map[string]podPeakSample{
		"pod-b": {at: model.TimeFromUnix(1_000), metric: models.EnvoyMemoryMetricWorkingSet, value: 100},
		"pod-a": {at: model.TimeFromUnix(1_000), metric: models.EnvoyMemoryMetricWorkingSet, value: 100},
	}

	selection := selectHighestMemoryPressure(peaksByPod, nil, 100)
	assert.Equal(t, "pod-a", selection.Pod)
}

func TestSampleValueAtUsesNearestSampleAtOrBefore(t *testing.T) {
	samples := []model.SamplePair{
		{Timestamp: model.TimeFromUnix(1_000), Value: model.SampleValue(50)},
		{Timestamp: model.TimeFromUnix(2_000), Value: model.SampleValue(75)},
	}

	// A traffic-series gap at the memory-peak step must read the previous sample, not zero.
	value, ok := sampleValueAt(samples, model.TimeFromUnix(2_500))
	assert.True(t, ok)
	assert.Equal(t, 75.0, value)

	value, ok = sampleValueAt(samples, model.TimeFromUnix(1_500))
	assert.True(t, ok)
	assert.Equal(t, 50.0, value)

	// No sample at or before the requested time.
	value, ok = sampleValueAt(samples, model.TimeFromUnix(500))
	assert.False(t, ok)
	assert.Equal(t, 0.0, value)
}

func TestSelectEnvoyStatusMemoryUsesWorstPodPressure(t *testing.T) {
	workingSet := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "small-limit"},
				Values: []model.SamplePair{{Value: model.SampleValue(250)}},
			},
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "large-limit"},
				Values: []model.SamplePair{{Value: model.SampleValue(300)}},
			},
		},
	}

	selection := selectEnvoyStatusMemory(
		100,
		prometheus.Metric{},
		workingSet,
		map[string]float64{"large-limit": 1000, "small-limit": 256},
	)
	assert.Equal(t, "small-limit", selection.Pod)
	assert.Equal(t, 250.0, selection.MaxBytes)
	assert.Equal(t, 256.0, selection.LimitBytes)
	assert.InDelta(t, 179.2, selection.ThresholdBytes, 0.001)
}

func TestEnvoyProxyMemoryLimitFromAnnotations(t *testing.T) {
	workload := &models.Workload{
		Pods: models.Pods{
			&models.Pod{
				Name: "pod-a",
				Annotations: map[string]string{
					istioProxyMemoryLimitAnnotation: "512Mi",
				},
			},
		},
	}

	assert.Equal(t, map[string]float64{"pod-a": 512 * 1024 * 1024}, envoyProxyMemoryLimitsFromAnnotations(workload))
}

func TestGetSummaryRequiresRunningPods(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.CustomDashboards.NamespaceLabel = "namespace"

	service := NewEnvoyMemoryService(nil, conf)
	workload := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Name:         "details-v1",
			Namespace:    "bookinfo",
			IstioSidecar: true,
			Labels: map[string]string{
				"app":     "details",
				"version": "v1",
			},
		},
	}

	_, err := service.GetSummary(context.Background(), workload, &prometheus.RangeQuery{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no pods with an Envoy proxy")
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

func TestBuildWorkloadMetricLabelsPrefersPodNames(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.CustomDashboards.NamespaceLabel = "namespace"

	workload := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Namespace: "bookinfo",
			Labels: map[string]string{
				"gateway.networking.k8s.io/gateway-name": "waypoint",
				"app":                                    "waypoint",
			},
		},
		Pods: models.Pods{
			&models.Pod{Name: "waypoint-abc"},
		},
	}

	labels := BuildWorkloadMetricLabels(conf, workload)
	assert.Equal(t, `{namespace="bookinfo",pod="waypoint-abc"}`, labels)
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

func TestResolveActiveConnectionsPrefersTCPWhenPositive(t *testing.T) {
	tcpOpened := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(20)}}},
		},
	}
	tcpClosed := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(5)}}},
		},
	}
	envoyCx := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(3)}}},
		},
	}

	active, observed := resolveActiveConnectionsAtTime(tcpOpened, tcpClosed, envoyCx, prometheus.Metric{}, 5, false, 0)
	assert.Equal(t, int64(15), active)
	assert.True(t, observed)
}

func TestResolveActiveConnectionsHTTPFallbackToEnvoy(t *testing.T) {
	tcpOpened := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(100)}}},
		},
	}
	tcpClosed := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(100)}}},
		},
	}
	upstreamCx := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(2)}}},
		},
	}
	downstreamCx := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(1)}}},
		},
	}

	active, observed := resolveActiveConnectionsAtTime(tcpOpened, tcpClosed, upstreamCx, downstreamCx, 100, false, 0)
	assert.Equal(t, int64(3), active)
	assert.True(t, observed)
}

func TestResolveActiveConnectionsUnobservedWhenAbsent(t *testing.T) {
	active, observed := resolveActiveConnectionsAtTime(prometheus.Metric{}, prometheus.Metric{}, prometheus.Metric{}, prometheus.Metric{}, 0, false, 0)
	assert.Equal(t, int64(0), active)
	assert.False(t, observed)
}

func TestEnvoyMemoryStatusTrafficSignalsAlignsAtMemoryPeak(t *testing.T) {
	peakAt := model.TimeFromUnix(2_000)
	latestAt := model.TimeFromUnix(3_000)
	threshold := float64(sidecarHighMemoryBytes)

	clusters := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{model.LabelName("pod"): "pod-a"},
				Values: []model.SamplePair{
					{Timestamp: peakAt, Value: model.SampleValue(200)},
					{Timestamp: latestAt, Value: model.SampleValue(10)},
				},
			},
		},
	}
	istioHTTPSource := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Values: []model.SamplePair{
					{Timestamp: peakAt, Value: model.SampleValue(0.27)},
					{Timestamp: latestAt, Value: model.SampleValue(150)},
				},
			},
		},
	}

	activeClusters, requestRate, _, activeConn, observed := envoyMemoryStatusTrafficSignals(
		models.EnvoyProxyTypeSidecar,
		peakAt,
		"pod-a",
		clusters,
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		istioHTTPSource,
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
		prometheus.Metric{},
	)
	assert.Equal(t, int64(200), activeClusters)
	assert.Equal(t, 0.27, requestRate)
	assert.Equal(t, int64(0), activeConn)
	assert.False(t, observed)

	cause := classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, activeClusters, activeConn, requestRate, false, observed)
	assert.Equal(t, models.EnvoyMemoryCauseConfiguration, cause)

	// Misaligned latest-only signals would incorrectly attribute traffic.
	latestClusters := int64(maxScalarAtTime(clusters, 0))
	latestRate := sumAtTime(istioHTTPSource, 0)
	causeLatest := classifyEnvoyMemory(threshold, sidecarLargeConfigClusters, threshold+1, latestClusters, activeConn, latestRate, false, observed)
	assert.Equal(t, models.EnvoyMemoryCauseTraffic, causeLatest)
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

	assert.Equal(10.0, sumEnvoyRequestRateAtTime(upstream, downstream, 0))
	assert.Equal(int64(5), activeTCPConnectionsAtTime(downstream, upstream, 0))
	assert.Equal(2.5, sumEnvoyRequestRateAtTime(upstream, prometheus.Metric{}, 0))
	assert.Equal(int64(0), activeTCPConnectionsAtTime(upstream, downstream, 0))
}

func TestMaxRequestRate(t *testing.T) {
	assert.Equal(t, 0.0, maxRequestRate())
	assert.Equal(t, 7.5, maxRequestRate(0, 2.5, 7.5))
	assert.Equal(t, 12.0, maxRequestRate(12.0, 3.0))
}

func TestRequestRatePrefersIstioWhenEnvoyAbsent(t *testing.T) {
	envoyOnly := envoyRequestRateFromMetricsAtTime(prometheus.Metric{}, prometheus.Metric{}, prometheus.Metric{}, 0)
	istio := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(1.25)}}},
		},
	}
	assert.Equal(t, 1.25, maxRequestRate(envoyOnly, sumAtTime(istio, 0)))
}

func TestIstioHTTPRequestRateAtTimeUsesMaxOfReporters(t *testing.T) {
	source := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(0.27)}}},
		},
	}
	dest := prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{Values: []model.SamplePair{{Value: model.SampleValue(200)}}},
		},
	}

	assert.Equal(t, 200.0, istioHTTPRequestRateAtTime(source, dest, 0))
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
	assert.Equal(t, 4.0, sumAtTime(metric, 0))
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

	assert.Equal(t, 5.0, envoyRequestRateFromMetricsAtTime(upstreamTotal, upstream, downstream, 0))
	assert.Equal(t, 4.0, envoyRequestRateFromMetricsAtTime(emptyMetric, upstream, emptyMetric, 0))
}

func TestBuildIstioWorkloadLabels(t *testing.T) {
	conf := config.NewConfig()
	labels := buildIstioWorkloadLabels("bookinfo", "productpage-v1", "source", conf)
	assert.Contains(t, labels, `source_workload_namespace="bookinfo"`)
	assert.Contains(t, labels, `source_workload="productpage-v1"`)

	confWithScope := config.NewConfig()
	confWithScope.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": "mesh1"}
	labels = buildIstioWorkloadLabels("bookinfo", "details-v1", "destination", confWithScope)
	assert.Contains(t, labels, `destination_workload_namespace="bookinfo"`)
	assert.Contains(t, labels, `destination_workload="details-v1"`)
	assert.Contains(t, labels, `mesh_id="mesh1"`)
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
