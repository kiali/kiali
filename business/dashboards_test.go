package business

import (
	"errors"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type k8sKialiMonitoringClientMock struct {
	mock.Mock
}

func (o *k8sKialiMonitoringClientMock) GetDashboard(namespace string, name string) (*kubernetes.MonitoringDashboard, error) {
	args := o.Called(namespace, name)
	if args.Error(1) != nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*kubernetes.MonitoringDashboard), nil
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
	prom.On("FetchRateRange", "my_metric_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter())
	prom.On("FetchHistogramRange", "my_metric_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram())

	dashboard, err := service.GetDashboard(query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 1)
	assert.Equal("Dashboard 1", dashboard.Title)
	assert.Len(dashboard.Aggregations, 2)
	assert.Len(dashboard.Charts, 2)
	assert.Equal("My chart 1", dashboard.Charts[0].Name)
	assert.Equal("My chart 2", dashboard.Charts[1].Name)
	assert.Nil(dashboard.Charts[0].Histogram)
	assert.Nil(dashboard.Charts[1].CounterRate)
	assert.Equal(model.SampleValue(10), dashboard.Charts[0].CounterRate.Matrix[0].Values[0].Value)
	assert.Equal(model.SampleValue(10), dashboard.Charts[1].Histogram["avg"].Matrix[0].Values[0].Value)
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
	prom.On("FetchRateRange", "my_metric_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter())
	prom.On("FetchHistogramRange", "my_metric_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram())

	dashboard, err := service.GetDashboard(query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 2)
	assert.Equal("Dashboard 1", dashboard.Title)
}

func fakeCounter() *prometheus.Metric {
	return &prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{},
				Values: []model.SamplePair{model.SamplePair{Timestamp: 0, Value: 10}},
			},
		},
	}
}

func fakeHistogram() prometheus.Histogram {
	return prometheus.Histogram{
		"avg": fakeCounter(),
	}
}

func fakeDashboard(id string) *kubernetes.MonitoringDashboard {
	return &kubernetes.MonitoringDashboard{
		Spec: kubernetes.MonitoringDashboardSpec{
			Title: "Dashboard " + id,
			Charts: []kubernetes.MonitoringDashboardChart{
				kubernetes.MonitoringDashboardChart{
					Name:       "My chart 1",
					Unit:       "s",
					Spans:      6,
					MetricName: "my_metric_1",
					MetricType: "counter",
					Aggregations: []kubernetes.MonitoringDashboardAggregation{
						kubernetes.MonitoringDashboardAggregation{
							DisplayName: "Agg 1",
							Label:       "agg_1",
						},
					},
				},
				kubernetes.MonitoringDashboardChart{
					Name:       "My chart 2",
					Unit:       "s",
					Spans:      6,
					MetricName: "my_metric_2",
					MetricType: "histogram",
					Aggregations: []kubernetes.MonitoringDashboardAggregation{
						kubernetes.MonitoringDashboardAggregation{
							DisplayName: "Agg 2",
							Label:       "agg_2",
						},
					},
				},
			},
		},
	}
}
