package business

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	kmock "github.com/kiali/kiali/kubernetes/monitoringdashboards/mock"
	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
	"github.com/kiali/kiali/models"
	pmock "github.com/kiali/kiali/prometheus/prometheustest"
)

func setupService() (*DashboardsService, *kmock.ClientMock, *pmock.PromClientMock) {
	config.Set(config.NewConfig())
	k8s := new(kmock.ClientMock)
	prom := new(pmock.PromClientMock)
	service := NewDashboardsService()
	service.k8sClient = k8s
	service.promClient = prom
	return service, k8s, prom
}

func TestGetDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	service, k8s, prom := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{kubernetes_namespace=\"my-namespace\",APP=\"my-app\"}"
	query := models.DashboardQuery{
		Namespace: "my-namespace",
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
	prom.MockMetric("my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	prom.MockHistogram("my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(&api.AuthInfo{Token: ""}, query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 1)
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

	// Setup mocks
	service, k8s, prom := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(nil, errors.New("denied"))
	k8s.On("GetDashboard", "istio-system", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{kubernetes_namespace=\"my-namespace\",APP=\"my-app\"}"
	query := models.DashboardQuery{
		Namespace: "my-namespace",
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
	}
	query.FillDefaults()
	prom.MockMetric("my_metric_1_1", expectedLabels, &query.RangeQuery, 10)
	prom.MockHistogram("my_metric_1_2", expectedLabels, &query.RangeQuery, 11, 12)

	dashboard, err := service.GetDashboard(&api.AuthInfo{Token: ""}, query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 2)
	assert.Equal("Dashboard 1", dashboard.Title)
}

func TestGetComposedDashboard(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Spec.Items = append(composed.Spec.Items, v1alpha1.MonitoringDashboardItem{Include: "dashboard1"})

	// Setup mocks
	service, k8s, _ := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(fakeDashboard("1"), nil)
	k8s.On("GetDashboard", "my-namespace", "dashboard2").Return(composed, nil)

	d, err := service.loadAndResolveDashboardResource("my-namespace", "dashboard2", map[string]bool{})
	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 2)
	assert.Equal("Dashboard 2", d.Spec.Title)
	assert.Len(d.Spec.Items, 4)
	assert.Equal("My chart 2_1", d.Spec.Items[0].Chart.Name)
	assert.Equal("My chart 2_2", d.Spec.Items[1].Chart.Name)
	assert.Equal("My chart 1_1", d.Spec.Items[2].Chart.Name)
	assert.Equal("My chart 1_2", d.Spec.Items[3].Chart.Name)
}

func TestGetComposedDashboardSingleChart(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Spec.Items = append(composed.Spec.Items, v1alpha1.MonitoringDashboardItem{Include: "dashboard1$My chart 1_2"})

	// Setup mocks
	service, k8s, _ := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(fakeDashboard("1"), nil)
	k8s.On("GetDashboard", "my-namespace", "dashboard2").Return(composed, nil)

	d, err := service.loadAndResolveDashboardResource("my-namespace", "dashboard2", map[string]bool{})
	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 2)
	assert.Equal("Dashboard 2", d.Spec.Title)
	assert.Len(d.Spec.Items, 3)
	assert.Equal("My chart 2_1", d.Spec.Items[0].Chart.Name)
	assert.Equal("My chart 2_2", d.Spec.Items[1].Chart.Name)
	assert.Equal("My chart 1_2", d.Spec.Items[2].Chart.Name)
}

func TestCircularDependency(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Spec.Items = append(composed.Spec.Items, v1alpha1.MonitoringDashboardItem{Include: "dashboard2"})

	// Setup mocks
	service, k8s, _ := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard2").Return(composed, nil)

	_, err := service.loadAndResolveDashboardResource("my-namespace", "dashboard2", map[string]bool{})
	assert.Contains(err.Error(), "circular dependency detected")
	k8s.AssertNumberOfCalls(t, "GetDashboard", 1)
}

func TestDiscoveryMatcher(t *testing.T) {
	assert := assert.New(t)

	d1 := fakeDashboard("1")
	d2 := fakeDashboard("2")
	d3 := fakeDashboard("3")

	dashboards := make(map[string]v1alpha1.MonitoringDashboard)
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
	d2.Spec.Items = append(d2.Spec.Items, v1alpha1.MonitoringDashboardItem{Include: d1.Name})
	d3 := fakeDashboard("3")

	dashboards := make(map[string]v1alpha1.MonitoringDashboard)
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

	// Setup mocks
	service, k8s, prom := setupService()
	d1 := fakeDashboard("1")
	d2 := fakeDashboard("2")
	k8s.On("GetDashboards", "my-namespace").Return([]v1alpha1.MonitoringDashboard{}, nil)
	k8s.On("GetDashboards", "istio-system").Return([]v1alpha1.MonitoringDashboard{*d1, *d2}, nil)
	prom.MockMetricsForLabels([]string{"my_metric_1_1", "request_count", "tcp_received", "tcp_sent"})
	pods := []*models.Pod{}

	runtimes := service.GetCustomDashboardRefs("my-namespace", "app", "", pods)

	k8s.AssertNumberOfCalls(t, "GetDashboards", 2)
	prom.AssertNumberOfCalls(t, "GetMetricsForLabels", 1)
	assert.Len(runtimes, 1)
	assert.Equal("Runtime 1", runtimes[0].Name)
	assert.Len(runtimes[0].DashboardRefs, 1)
	assert.Equal("dashboard1", runtimes[0].DashboardRefs[0].Template)
	assert.Equal("Dashboard 1", runtimes[0].DashboardRefs[0].Title)
}

func fakeDashboard(id string) *v1alpha1.MonitoringDashboard {
	return &v1alpha1.MonitoringDashboard{
		ObjectMeta: v1.ObjectMeta{
			Name: "dashboard" + id,
		},
		Spec: v1alpha1.MonitoringDashboardSpec{
			Title:      "Dashboard " + id,
			Runtime:    "Runtime " + id,
			DiscoverOn: "my_metric_" + id + "_1",
			Items: []v1alpha1.MonitoringDashboardItem{
				{
					Chart: kmock.FakeChart(id+"_1", "rate"),
				},
				{
					Chart: kmock.FakeChart(id+"_2", "histogram"),
				},
			},
		},
	}
}

func TestBuildIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService()

	dashboard := service.BuildIstioDashboard(fakeMetrics(), "inbound")

	assert.Equal("Inbound Metrics", dashboard.Title)
	assert.Len(dashboard.Aggregations, 7)
	assert.Equal("Local version", dashboard.Aggregations[0].DisplayName)
	assert.Equal("destination_canonical_revision", dashboard.Aggregations[0].Label)
	assert.Equal("Remote namespace", dashboard.Aggregations[1].DisplayName)
	assert.Equal("source_workload_namespace", dashboard.Aggregations[1].Label)
	assert.Equal("Remote app", dashboard.Aggregations[2].DisplayName)
	assert.Equal("source_canonical_service", dashboard.Aggregations[2].Label)
	assert.Len(dashboard.Charts, 8)
	assert.Equal("Request volume", dashboard.Charts[0].Name)
	assert.Len(dashboard.Charts[0].Metrics, 1)
	assert.Equal("Request duration", dashboard.Charts[1].Name)
	assert.Len(dashboard.Charts[1].Metrics, 2)
	assert.Equal("TCP sent", dashboard.Charts[7].Name)
	assert.Equal(float64(10), dashboard.Charts[0].Metrics[0].Datapoints[0].Value) // Request volume (request_count)
	assert.Equal(float64(20), dashboard.Charts[1].Metrics[0].Datapoints[0].Value) // Request duration (request_duration_millis)
	assert.Equal(float64(13), dashboard.Charts[7].Metrics[0].Datapoints[0].Value) // TCP sent (tcp_sent)
	// Absent metrics are not nil
	assert.Equal("Request throughput", dashboard.Charts[2].Name)
	assert.NotNil(dashboard.Charts[2].Metrics)
	assert.Len(dashboard.Charts[2].Metrics, 0)
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
	}
}
