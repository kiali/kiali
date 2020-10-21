package business

import (
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

func TestBuildIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	conf := config.NewConfig()
	config.Set(conf)
	service := NewDashboardsService()

	dashboard, err := service.BuildIstioDashboard(fakeMetrics(), "inbound")

	assert.Nil(err)
	assert.Equal("Inbound Metrics", dashboard.Title)
	assert.Len(dashboard.Aggregations, 6)
	assert.Equal("Local version", dashboard.Aggregations[0].DisplayName)
	assert.Equal("destination_canonical_revision", dashboard.Aggregations[0].Label)
	assert.Equal("Remote app", dashboard.Aggregations[1].DisplayName)
	assert.Equal("source_canonical_service", dashboard.Aggregations[1].Label)
	assert.Len(dashboard.Charts, 8)
	assert.Equal("Request volume", dashboard.Charts[0].Name)
	assert.Equal("Request duration", dashboard.Charts[1].Name)
	assert.Equal("TCP sent", dashboard.Charts[7].Name)
	assert.Len(dashboard.Charts[0].Metrics, 1)
	assert.Len(dashboard.Charts[1].Metrics, 1)
	assert.Equal(float64(10), dashboard.Charts[0].Metrics[0].Values[0].Value)
	assert.Equal(float64(20), dashboard.Charts[1].Metrics[0].Values[0].Value)
	assert.Equal(float64(13), dashboard.Charts[7].Metrics[0].Values[0].Value)
}

func fakeCounter(value int) *prometheus.Metric {
	return &prometheus.Metric{
		Matrix: model.Matrix{
			&model.SampleStream{
				Metric: model.Metric{},
				Values: []model.SamplePair{{Timestamp: 0, Value: model.SampleValue(value)}},
			},
		},
	}
}

func fakeHistogram(avg int) prometheus.Histogram {
	return prometheus.Histogram{
		"avg": fakeCounter(avg),
	}
}

func fakeMetrics() models.Metrics {
	return models.Metrics{
		Metrics: map[string]*prometheus.Metric{
			"request_count":       fakeCounter(10),
			"request_error_count": fakeCounter(11),
			"tcp_received":        fakeCounter(12),
			"tcp_sent":            fakeCounter(13),
		},
		Histograms: map[string]prometheus.Histogram{
			"request_duration_millis": fakeHistogram(20000),
			"request_size":            fakeHistogram(21),
			"response_size":           fakeHistogram(22),
		},
	}
}
