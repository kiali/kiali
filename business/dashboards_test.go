package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/config/dashboards"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	pmock "github.com/kiali/kiali/prometheus/prometheustest"
)

func setupService(conf *config.Config, namespace string, dashboards []dashboards.MonitoringDashboard) (*DashboardsService, *pmock.PromClientMock) {
	for _, d := range dashboards {
		conf.CustomDashboards = append(conf.CustomDashboards, d)
	}
	prom := new(pmock.PromClientMock)
	ns := models.Namespace{Name: namespace}
	grafana := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	service := NewDashboardsService(conf, grafana, prom, &ns, nil)
	return service, prom
}

func TestGetDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	service, prom := setupService(config.NewConfig(), "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("1")})
	service.promConfig.QueryScope = map[string]string{"mesh_id": "mesh1"}

	expectedLabels := `{namespace="my-namespace",APP="my-app",mesh_id="mesh1"}`
	namespace := models.Namespace{
		Name: "my-namespace",
	}
	query := models.DashboardQuery{
		Namespace: namespace.Name,
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
		AdditionalLabels: []models.Aggregation{
			{
				Label:       "version",
				DisplayName: "Version",
			},
		},
	}
	query.FillDefaults()
	prom.MockMetric(context.Background(), "my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	prom.MockHistogram(context.Background(), "my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(context.Background(), query, "dashboard1")

	assert.Nil(err)
	assert.Equal("Dashboard 1", dashboard.Title)
	assert.Len(dashboard.Aggregations, 3)
	assert.Len(dashboard.Charts, 2)
	assert.Equal("My chart 1_1", dashboard.Charts[0].Name)
	assert.Equal("My chart 1_2", dashboard.Charts[1].Name)
	assert.Len(dashboard.Charts[0].Metrics, 1)
	// Note: fake dashboard has scale=10 for every chart
	assert.Equal(float64(100), dashboard.Charts[0].Metrics[0].Datapoints[0].Value)
	assert.Len(dashboard.Charts[1].Metrics, 2)
	assertHisto(assert, dashboard.Charts[1].Metrics, "avg", 110)
	assertHisto(assert, dashboard.Charts[1].Metrics, "0.99", 120)
}

func TestGetDashboardFromKialiNamespace(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	// allows GetDashboard to get the SA client under the covers
	kubernetes.NewTestingClientFactory(t, conf)

	// Setup mocks
	service, prom := setupService(conf, "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("1")})

	expectedLabels := "{namespace=\"my-namespace\",APP=\"my-app\"}"
	namespace := models.Namespace{
		Name: "my-namespace",
	}
	query := models.DashboardQuery{
		Namespace: namespace.Name,
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
	}
	query.FillDefaults()
	prom.MockMetric(context.Background(), "my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	prom.MockHistogram(context.Background(), "my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(context.Background(), query, "dashboard1")

	assert.Nil(err)
	assert.Equal("Dashboard 1", dashboard.Title)
}

func TestGetComposedDashboard(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Items = append(composed.Items, dashboards.MonitoringDashboardItem{Include: "dashboard1"})

	// Setup mocks
	service, _ := setupService(config.NewConfig(), "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("1"), *composed})

	d, err := service.loadAndResolveDashboardResource("dashboard2", map[string]bool{})
	assert.Nil(err)
	assert.Equal("Dashboard 2", d.Title)
	assert.Len(d.Items, 4)
	assert.Equal("My chart 2_1", d.Items[0].Chart.Name)
	assert.Equal("My chart 2_2", d.Items[1].Chart.Name)
	assert.Equal("My chart 1_1", d.Items[2].Chart.Name)
	assert.Equal("My chart 1_2", d.Items[3].Chart.Name)
}

func TestGetComposedDashboardSingleChart(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Items = append(composed.Items, dashboards.MonitoringDashboardItem{Include: "dashboard1$My chart 1_2"})

	// Setup mocks
	service, _ := setupService(config.NewConfig(), "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("1"), *composed})

	d, err := service.loadAndResolveDashboardResource("dashboard2", map[string]bool{})
	assert.Nil(err)
	assert.Equal("Dashboard 2", d.Title)
	assert.Len(d.Items, 3)
	assert.Equal("My chart 2_1", d.Items[0].Chart.Name)
	assert.Equal("My chart 2_2", d.Items[1].Chart.Name)
	assert.Equal("My chart 1_2", d.Items[2].Chart.Name)
}

func TestCircularDependency(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Items = append(composed.Items, dashboards.MonitoringDashboardItem{Include: "dashboard2"})

	// Setup mocks
	service, _ := setupService(config.NewConfig(), "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("2"), *composed})

	_, err := service.loadAndResolveDashboardResource("dashboard2", map[string]bool{})
	assert.Contains(err.Error(), "circular dependency detected")
}

func TestDiscoveryMatcher(t *testing.T) {
	assert := assert.New(t)

	d1 := fakeDashboard("1")
	d2 := fakeDashboard("2")
	d3 := fakeDashboard("3")

	dashboards := make(map[string]dashboards.MonitoringDashboard)
	dashboards[d1.Name] = *d1
	dashboards[d2.Name] = *d2
	dashboards[d3.Name] = *d3

	metrics := []string{
		"my_metric_1_1",
		"my_metric_1_2",
		"my_metric_1_3",
		"my_metric_2_1",
	}

	runtimes := runDiscoveryMatcher(metrics, dashboards)

	assert.Len(runtimes, 2)
	assert.Equal("Runtime 1", runtimes[0].Name)
	assert.Len(runtimes[0].DashboardRefs, 1)
	assert.Equal("dashboard1", runtimes[0].DashboardRefs[0].Template)
	assert.Equal("Runtime 2", runtimes[1].Name)
	assert.Len(runtimes[1].DashboardRefs, 1)
	assert.Equal("dashboard2", runtimes[1].DashboardRefs[0].Template)
}

func TestDiscoveryMatcherWithComposition(t *testing.T) {
	assert := assert.New(t)

	d1 := fakeDashboard("1")
	d2 := fakeDashboard("2")
	d2.Items = append(d2.Items, dashboards.MonitoringDashboardItem{Include: d1.Name})
	d3 := fakeDashboard("3")

	dashboards := make(map[string]dashboards.MonitoringDashboard)
	dashboards[d1.Name] = *d1
	dashboards[d2.Name] = *d2
	dashboards[d3.Name] = *d3

	metrics := []string{
		"my_metric_1_1",
		"my_metric_1_2",
		"my_metric_1_3",
		"my_metric_2_1",
	}

	runtimes := runDiscoveryMatcher(metrics, dashboards)

	// Only top-level runtime must appear
	assert.Len(runtimes, 1)
	assert.Equal("Runtime 2", runtimes[0].Name)
	assert.Len(runtimes[0].DashboardRefs, 1)
	assert.Equal("dashboard2", runtimes[0].DashboardRefs[0].Template)
}

func TestGetCustomDashboardRefs(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"

	// Setup mocks
	service, prom := setupService(conf, "my-namespace", []dashboards.MonitoringDashboard{*fakeDashboard("1"), *fakeDashboard("2")})

	prom.MockMetricsForLabels(context.Background(), []string{"my_metric_1_1", "request_count", "tcp_received", "tcp_sent"})
	pods := []*models.Pod{}

	runtimes := service.GetCustomDashboardRefs(context.Background(), "my-namespace", "app", "", pods)

	prom.AssertNumberOfCalls(t, "GetMetricsForLabels", 1)
	assert.Len(runtimes, 1)
	assert.Equal("Runtime 1", runtimes[0].Name)
	assert.Len(runtimes[0].DashboardRefs, 1)
	assert.Equal("dashboard1", runtimes[0].DashboardRefs[0].Template)
	assert.Equal("Dashboard 1", runtimes[0].DashboardRefs[0].Title)
}

func fakeDashboard(id string) *dashboards.MonitoringDashboard {
	return &dashboards.MonitoringDashboard{
		Name:       "dashboard" + id,
		Title:      "Dashboard " + id,
		Runtime:    "Runtime " + id,
		DiscoverOn: "my_metric_" + id + "_1",
		Items: []dashboards.MonitoringDashboardItem{
			{
				Chart: fakeChart(id+"_1", dashboards.Rate),
			},
			{
				Chart: fakeChart(id+"_2", dashboards.Histogram),
			},
		},
	}
}

func fakeChart(id string, dataType string) dashboards.MonitoringDashboardChart {
	return dashboards.MonitoringDashboardChart{
		Name:      "My chart " + id,
		Unit:      "s",
		UnitScale: 10.0,
		Spans:     6,
		Metrics:   []dashboards.MonitoringDashboardMetric{{DisplayName: "My chart " + id, MetricName: "my_metric_" + id}},
		DataType:  dataType,
		Aggregations: []dashboards.MonitoringDashboardAggregation{
			{
				DisplayName: "Agg " + id,
				Label:       "agg_" + id,
			},
		},
	}
}

func TestBuildIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	conf := config.NewConfig()
	ns := models.Namespace{Name: "my-namespace"}
	grafana := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	prom := new(pmock.PromClientMock)
	service := NewDashboardsService(conf, grafana, prom, &ns, nil)

	dashboard := service.BuildIstioDashboard(fakeMetrics(), "inbound")

	assert.Equal("Inbound Metrics", dashboard.Title)
	assert.Len(dashboard.Aggregations, 8)
	assert.Equal("Local version", dashboard.Aggregations[0].DisplayName)
	assert.Equal("destination_canonical_revision", dashboard.Aggregations[0].Label)
	assert.Equal("Remote namespace", dashboard.Aggregations[1].DisplayName)
	assert.Equal("source_workload_namespace", dashboard.Aggregations[1].Label)
	assert.Equal("Remote app", dashboard.Aggregations[2].DisplayName)
	assert.Equal("source_canonical_service", dashboard.Aggregations[2].Label)
	assert.Len(dashboard.Charts, 12)
	assert.Equal("Request volume", dashboard.Charts[0].Name)
	assert.Equal("Request duration", dashboard.Charts[1].Name)
	assert.Len(dashboard.Charts[1].Metrics, 2)
	assert.Equal("Request size", dashboard.Charts[2].Name)
	assert.Len(dashboard.Charts[2].Metrics, 2)
	assert.Equal("TCP closed", dashboard.Charts[9].Name)
	assert.Equal(float64(10), dashboard.Charts[0].Metrics[0].Datapoints[0].Value) // Request volume (request_count)
	assert.Equal(float64(20), dashboard.Charts[1].Metrics[0].Datapoints[0].Value) // Request duration (request_duration_millis)
	assert.Equal(float64(32), dashboard.Charts[9].Metrics[0].Datapoints[0].Value) // TCP closed (tcp_closed)
	// Absent metrics are not nil
	assert.Equal("Response throughput", dashboard.Charts[5].Name)
	assert.NotNil(dashboard.Charts[5].Metrics)
	assert.Len(dashboard.Charts[5].Metrics, 0)
	assert.Equal("Connection Security Policy", dashboard.Aggregations[7].DisplayName)
}

func fakeCounter(value float64) []models.Metric {
	return []models.Metric{{
		Labels:     map[string]string{},
		Datapoints: []models.Datapoint{{Timestamp: 0, Value: value}},
	}}
}

func fakeHistogram(avg, p99 float64) []models.Metric {
	return []models.Metric{{
		Stat:       "0.99",
		Datapoints: []models.Datapoint{{Timestamp: 0, Value: p99}},
	}, {
		Stat:       "avg",
		Datapoints: []models.Datapoint{{Timestamp: 0, Value: avg}},
	}}
}

func fakeMetrics() models.MetricsMap {
	return models.MetricsMap{
		"request_count":           fakeCounter(10),
		"request_error_count":     fakeCounter(11),
		"tcp_received":            fakeCounter(12),
		"tcp_sent":                fakeCounter(13),
		"request_duration_millis": fakeHistogram(20, 20),
		"request_size":            fakeHistogram(21, 21),
		"response_size":           fakeHistogram(22, 22),
		"tcp_opened":              fakeCounter(31),
		"tcp_closed":              fakeCounter(32),
	}
}

// resetCustomDashboardsPromClient resets the package-level cached custom
// dashboards Prometheus client so that each test starts with a clean state.
func resetCustomDashboardsPromClient() {
	customDashboardsPromClient = nil
}

// TestGetDashboardUsesCustomDashboardsPromClient verifies that when
// custom_dashboards.prometheus.url is configured, metric queries for custom
// dashboards are sent to a separate Prometheus client rather than the main one.
func TestGetDashboardUsesCustomDashboardsPromClient(t *testing.T) {
	assert := assert.New(t)

	resetCustomDashboardsPromClient()
	origFactory := newPromClient
	t.Cleanup(func() {
		newPromClient = origFactory
		resetCustomDashboardsPromClient()
	})

	customProm := new(pmock.PromClientMock)
	newPromClient = func(_ config.Config, _ config.PrometheusConfig, _ string) (prometheus.ClientInterface, error) {
		return customProm, nil
	}

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.Prometheus.URL = "http://prometheus-main:9090"
	conf.ExternalServices.CustomDashboards.Prometheus.URL = "http://prometheus-custom:9090"

	conf.CustomDashboards = append(conf.CustomDashboards, *fakeDashboard("1"))

	mainProm := new(pmock.PromClientMock)

	ns := models.Namespace{Name: "my-namespace"}
	grafanaSvc := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	service := NewDashboardsService(conf, grafanaSvc, mainProm, &ns, nil)

	expectedLabels := `{namespace="my-namespace",APP="my-app"}`
	query := models.DashboardQuery{
		Namespace: "my-namespace",
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
	}
	query.FillDefaults()

	customProm.MockMetric(context.Background(), "my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	customProm.MockHistogram(context.Background(), "my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(context.Background(), query, "dashboard1")

	require.NoError(t, err)
	assert.Equal("Dashboard 1", dashboard.Title)
	assert.Len(dashboard.Charts, 2)

	// The custom prom client should have been called for metric fetching.
	customProm.AssertNumberOfCalls(t, "FetchRateRange", 1)
	customProm.AssertNumberOfCalls(t, "FetchHistogramRange", 1)

	// The main prom client should NOT have been called at all.
	mainProm.AssertNumberOfCalls(t, "FetchRateRange", 0)
	mainProm.AssertNumberOfCalls(t, "FetchHistogramRange", 0)
}

// TestCustomDashboardsPromClientFallbackOnFactoryError verifies that when
// the factory fails to create the custom Prometheus client, the service
// falls back to the caller-supplied main client.
func TestCustomDashboardsPromClientFallbackOnFactoryError(t *testing.T) {
	assert := assert.New(t)

	resetCustomDashboardsPromClient()
	origFactory := newPromClient
	t.Cleanup(func() {
		newPromClient = origFactory
		resetCustomDashboardsPromClient()
	})

	newPromClient = func(_ config.Config, _ config.PrometheusConfig, _ string) (prometheus.ClientInterface, error) {
		return nil, fmt.Errorf("simulated TLS failure")
	}

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.CustomDashboards.Prometheus.URL = "http://prometheus-custom:9090"
	conf.CustomDashboards = append(conf.CustomDashboards, *fakeDashboard("1"))

	mainProm := new(pmock.PromClientMock)

	ns := models.Namespace{Name: "my-namespace"}
	grafanaSvc := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	service := NewDashboardsService(conf, grafanaSvc, mainProm, &ns, nil)

	expectedLabels := `{namespace="my-namespace",APP="my-app"}`
	query := models.DashboardQuery{
		Namespace: "my-namespace",
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
	}
	query.FillDefaults()
	mainProm.MockMetric(context.Background(), "my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	mainProm.MockHistogram(context.Background(), "my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(context.Background(), query, "dashboard1")

	require.NoError(t, err)
	assert.Equal("Dashboard 1", dashboard.Title)

	// Factory failed, so the main prom client should have been used.
	mainProm.AssertNumberOfCalls(t, "FetchRateRange", 1)
	mainProm.AssertNumberOfCalls(t, "FetchHistogramRange", 1)
}

// TestCustomDashboardsPromClientRetryAfterTransientError verifies that
// after a transient factory failure, the next call retries (mutex-based
// approach, unlike sync.Once which would lock in the failure permanently).
func TestCustomDashboardsPromClientRetryAfterTransientError(t *testing.T) {
	resetCustomDashboardsPromClient()
	origFactory := newPromClient
	t.Cleanup(func() {
		newPromClient = origFactory
		resetCustomDashboardsPromClient()
	})

	callCount := 0
	customProm := new(pmock.PromClientMock)
	newPromClient = func(_ config.Config, _ config.PrometheusConfig, _ string) (prometheus.ClientInterface, error) {
		callCount++
		if callCount == 1 {
			return nil, fmt.Errorf("transient failure")
		}
		return customProm, nil
	}

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.CustomDashboards.Prometheus.URL = "http://prometheus-custom:9090"

	ns := models.Namespace{Name: "ns"}

	// First call: factory fails, falls back to main.
	mainProm := new(pmock.PromClientMock)
	svc1 := NewDashboardsService(conf, nil, mainProm, &ns, nil)
	if svc1.promClient != mainProm {
		t.Fatal("expected fallback to main prom after factory error")
	}

	// Second call: factory succeeds, custom client is used.
	svc2 := NewDashboardsService(conf, nil, mainProm, &ns, nil)
	if svc2.promClient != customProm {
		t.Fatal("expected custom prom client after successful retry")
	}

	if callCount != 2 {
		t.Fatalf("expected factory to be called twice (retry after failure), got %d", callCount)
	}
}

// TestCustomDashboardsPromClientFactoryCalledOnce verifies that the factory
// is called exactly once across multiple NewDashboardsService calls — the
// successful result is cached and reused.
func TestCustomDashboardsPromClientFactoryCalledOnce(t *testing.T) {
	resetCustomDashboardsPromClient()
	origFactory := newPromClient
	t.Cleanup(func() {
		newPromClient = origFactory
		resetCustomDashboardsPromClient()
	})

	callCount := 0
	customProm := new(pmock.PromClientMock)
	newPromClient = func(_ config.Config, _ config.PrometheusConfig, _ string) (prometheus.ClientInterface, error) {
		callCount++
		return customProm, nil
	}

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.CustomDashboards.Prometheus.URL = "http://prometheus-custom:9090"

	ns := models.Namespace{Name: "ns"}
	mainProm := new(pmock.PromClientMock)

	for i := 0; i < 5; i++ {
		svc := NewDashboardsService(conf, nil, mainProm, &ns, nil)
		if svc.promClient != customProm {
			t.Fatalf("call %d: expected custom prom client", i)
		}
	}

	if callCount != 1 {
		t.Fatalf("expected factory to be called exactly once, got %d", callCount)
	}
}
