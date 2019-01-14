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
	prom.On("FetchRateRange", "my_metric_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram(11))

	dashboard, err := service.GetDashboard(query, "dashboard1")

	assert.Nil(err)
	k8s.AssertNumberOfCalls(t, "GetDashboard", 1)
	assert.Equal("Dashboard 1", dashboard.Title)
	assert.Len(dashboard.Aggregations, 2)
	assert.Len(dashboard.Charts, 2)
	assert.Equal("My chart 1", dashboard.Charts[0].Name)
	assert.Equal("My chart 2", dashboard.Charts[1].Name)
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
	prom.On("FetchRateRange", "my_metric_1", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeCounter(10))
	prom.On("FetchHistogramRange", "my_metric_2", expectedLabels, "", &query.BaseMetricsQuery).Return(fakeHistogram(11))

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
					DataType:   "rate",
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
					DataType:   "histogram",
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
