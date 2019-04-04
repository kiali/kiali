package business

import (
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestGetIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService(prom)

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
	assert.Equal(float64(10), dashboard.Charts[0].Metric[0].Values[0].Value)
	assert.Equal(float64(20), dashboard.Charts[1].Histogram["avg"][0].Values[0].Value)
	assert.Equal(float64(13), dashboard.Charts[5].Metric[0].Values[0].Value)
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
