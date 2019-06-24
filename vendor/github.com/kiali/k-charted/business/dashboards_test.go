package business

import (
	"errors"
	"fmt"
	"testing"

	pmodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/k-charted/config"
	kmock "github.com/kiali/k-charted/kubernetes/mock"
	"github.com/kiali/k-charted/kubernetes/v1alpha1"
	"github.com/kiali/k-charted/model"
	"github.com/kiali/k-charted/prometheus"
	pmock "github.com/kiali/k-charted/prometheus/mock"
)

func setupService() (*DashboardsService, *kmock.ClientMock, *pmock.PromClientMock) {
	k8s := new(kmock.ClientMock)
	prom := new(pmock.PromClientMock)
	service := NewDashboardsService(config.Config{
		GlobalNamespace: "istio-system",
		Errorf: func(s string, args ...interface{}) {
			fmt.Printf(s+"\n", args...)
		},
		Tracef: func(s string, args ...interface{}) {
			fmt.Printf(s+"\n", args...)
		},
	})
	service.k8sClient = k8s
	service.promClient = prom
	return &service, k8s, prom
}

func TestGetDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	service, k8s, prom := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{namespace=\"my-namespace\",APP=\"my-app\"}"
	query := model.DashboardQuery{
		Namespace: "my-namespace",
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
		AdditionalLabels: []model.Aggregation{
			model.Aggregation{
				Label:       "version",
				DisplayName: "Version",
			},
		},
	}
	query.FillDefaults()
	prom.On("FetchRateRange", "my_metric_1_1", expectedLabels, "", &query.MetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_1_2", expectedLabels, "", &query.MetricsQuery).Return(fakeHistogram(11))

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
	assert.Equal(float64(10), dashboard.Charts[0].Metric[0].Values[0].Value)
	assert.Equal(float64(11), dashboard.Charts[1].Histogram["avg"][0].Values[0].Value)
}

func TestGetDashboardFromKialiNamespace(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	service, k8s, prom := setupService()
	k8s.On("GetDashboard", "my-namespace", "dashboard1").Return(nil, errors.New("denied"))
	k8s.On("GetDashboard", "istio-system", "dashboard1").Return(fakeDashboard("1"), nil)

	expectedLabels := "{namespace=\"my-namespace\",APP=\"my-app\"}"
	query := model.DashboardQuery{
		Namespace: "my-namespace",
		LabelsFilters: map[string]string{
			"APP": "my-app",
		},
	}
	query.FillDefaults()
	prom.On("FetchRateRange", "my_metric_1_1", expectedLabels, "", &query.MetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_1_2", expectedLabels, "", &query.MetricsQuery).Return(fakeHistogram(11))

	dashboard, err := service.GetDashboard(query, "dashboard1")

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

func fakeCounter(value int) prometheus.Metric {
	return prometheus.Metric{
		Matrix: pmodel.Matrix{
			&pmodel.SampleStream{
				Metric: pmodel.Metric{},
				Values: []pmodel.SamplePair{pmodel.SamplePair{Timestamp: 0, Value: pmodel.SampleValue(value)}},
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
		ObjectMeta: v1.ObjectMeta{
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

func TestConvertEmptyMetric(t *testing.T) {
	assert := assert.New(t)
	in := NewDashboardsService(config.Config{})
	var metric prometheus.Metric

	// Make sure metric is never nil, but empty slice
	res, err := in.convertMetric(metric, "foo")
	assert.Empty(err)
	assert.NotNil(res)
	assert.Len(res, 0)

	metric.Err = errors.New("Some error")
	res, err = in.convertMetric(metric, "foo")
	assert.Equal("Some error", err)
	assert.NotNil(res)
	assert.Len(res, 0)
}

func TestConvertEmptyHistogram(t *testing.T) {
	assert := assert.New(t)
	in := NewDashboardsService(config.Config{})
	var histo prometheus.Histogram

	// An empty histogram gives an empty map
	res, err := in.convertHistogram(histo, "foo")
	assert.Empty(err)
	assert.NotNil(res)
	assert.Len(res, 0)

	// ... But empty metrics within an histogram cannot be nil
	histo = make(prometheus.Histogram)
	var metric prometheus.Metric
	histo["0.99"] = metric
	res, err = in.convertHistogram(histo, "foo")
	assert.Empty(err)
	assert.NotNil(res)
	assert.Len(res, 1)
	assert.NotNil(res["0.99"])
	assert.Len(res["0.99"], 0)

	// Check with error (here, histogram is nil)
	metric.Err = errors.New("Some error")
	histo["0.99"] = metric
	res, err = in.convertHistogram(histo, "foo")
	assert.Equal("Some error", err)
	assert.Nil(res)
}
