package business

import (
	"errors"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	kmock "github.com/kiali/kiali/kubernetes/kiali_monitoring/mock"
	"github.com/kiali/kiali/kubernetes/kiali_monitoring/v1alpha1"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

type k8sKialiMonitoringClientMock struct {
	mock.Mock
}

func (o *k8sKialiMonitoringClientMock) GetDashboard(namespace string, name string) (*v1alpha1.MonitoringDashboard, error) {
	args := o.Called(namespace, name)
	if args.Error(1) != nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1alpha1.MonitoringDashboard), nil
}

func (o *k8sKialiMonitoringClientMock) GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	args := o.Called(namespace)
	if args.Error(1) != nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]v1alpha1.MonitoringDashboard), nil
}

func TestGetDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(k8sKialiMonitoringClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(k8s, prom)
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{namespace=\"my-namespace\",app=\"my-app\"}"
	query := prometheus.CustomMetricsQuery{
		Namespace: "my-namespace",
		App:       "my-app",
	}
	query.FillDefaults()
	prom.On("FetchRateRange", "my_metric_1_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_1_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram(11))

	dashboard, err := service.GetDashboard(query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 1)
	assert.Equal("Dashboard 1", dashboard.Title)
	assert.Len(dashboard.Aggregations, 3)
	assert.Len(dashboard.Charts, 2)
	assert.Equal("My chart 1_1", dashboard.Charts[0].Name)
	assert.Equal("My chart 1_2", dashboard.Charts[1].Name)
	assert.Nil(dashboard.Charts[0].Histogram)
	assert.Nil(dashboard.Charts[1].Metric)
	assert.Equal(model.SampleValue(10), dashboard.Charts[0].Metric.Matrix[0].Values[0].Value)
	assert.Equal(model.SampleValue(11), dashboard.Charts[1].Histogram["avg"].Matrix[0].Values[0].Value)
}

func TestGetDashboardFromKialiNamespace(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(k8sKialiMonitoringClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(k8s, prom)
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(nil, errors.New("denied"))
	k8s.On("GetDashboard", "istio-system", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{namespace=\"my-namespace\",app=\"my-app\"}"
	query := prometheus.CustomMetricsQuery{
		Namespace: "my-namespace",
		App:       "my-app",
	}
	query.FillDefaults()
	prom.On("FetchRateRange", "my_metric_1_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_1_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram(11))

	dashboard, err := service.GetDashboard(query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 2)
	assert.Equal("Dashboard 1", dashboard.Title)
}

func TestGetIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(nil, prom)

	query := prometheus.IstioMetricsQuery{
		Namespace: "my-namespace",
		App:       "my-app",
	}
	query.FillDefaults()
	query.Direction = "inbound"
	prom.On("GetMetrics", &query).Return(fakeMetrics())

	dashboard, err := service.GetIstioDashboard(query)

	assert.Nil(err)
	assert.Equal("Inbound Metrics", dashboard.Title)
	assert.Len(dashboard.Aggregations, 4)
	assert.Equal("Local version", dashboard.Aggregations[0].DisplayName)
	assert.Equal("destination_version", dashboard.Aggregations[0].Label)
	assert.Equal("Remote app", dashboard.Aggregations[1].DisplayName)
	assert.Equal("source_app", dashboard.Aggregations[1].Label)
	assert.Len(dashboard.Charts, 6)
	assert.Equal("Request volume", dashboard.Charts[0].Name)
	assert.Equal("Request duration", dashboard.Charts[1].Name)
	assert.Equal("TCP sent", dashboard.Charts[5].Name)
	assert.Nil(dashboard.Charts[0].Histogram)
	assert.Nil(dashboard.Charts[1].Metric)
	assert.Equal(model.SampleValue(10), dashboard.Charts[0].Metric.Matrix[0].Values[0].Value)
	assert.Equal(model.SampleValue(20), dashboard.Charts[1].Histogram["avg"].Matrix[0].Values[0].Value)
	assert.Equal(model.SampleValue(13), dashboard.Charts[5].Metric.Matrix[0].Values[0].Value)
}

func TestGetComposedDashboard(t *testing.T) {
	assert := assert.New(t)

	composed := fakeDashboard("2")
	composed.Spec.Items = append(composed.Spec.Items, v1alpha1.MonitoringDashboardItem{Include: "dashboard1"})

	// Setup mocks
	k8s := new(k8sKialiMonitoringClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(k8s, prom)
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
	k8s := new(k8sKialiMonitoringClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(k8s, prom)
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
	k8s := new(k8sKialiMonitoringClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(k8s, prom)
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

func fakeCounter(value int) *prometheus.Metric {
	return &prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{},
				Values: []model.SamplePair{model.SamplePair{Timestamp: 0, Value: model.SampleValue(value)}},
			},
		},
	}
}

func fakeHistogram(avg int) prometheus.Histogram {
	return prometheus.Histogram{
		"avg": fakeCounter(avg),
	}
}

func fakeDashboard(id string) *v1alpha1.MonitoringDashboard {
	return &v1alpha1.MonitoringDashboard{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "dashboard" + id,
		},
		Spec: v1alpha1.MonitoringDashboardSpec{
			Title:      "Dashboard " + id,
			Runtime:    "Runtime " + id,
			DiscoverOn: "my_metric_" + id + "_1",
			Items: []v1alpha1.MonitoringDashboardItem{
				v1alpha1.MonitoringDashboardItem{
					Chart: kmock.FakeChart(id+"_1", "rate"),
				},
				v1alpha1.MonitoringDashboardItem{
					Chart: kmock.FakeChart(id+"_2", "histogram"),
				},
			},
		},
	}
}

func fakeMetrics() prometheus.Metrics {
	return prometheus.Metrics{
		Metrics: map[string]*prometheus.Metric{
			"request_count":       fakeCounter(10),
			"request_error_count": fakeCounter(11),
			"tcp_received":        fakeCounter(12),
			"tcp_sent":            fakeCounter(13),
		},
		Histograms: map[string]prometheus.Histogram{
			"request_duration": fakeHistogram(20),
			"request_size":     fakeHistogram(21),
			"response_size":    fakeHistogram(22),
		},
	}
}
