package model

import (
	"encoding/json"
	"errors"
	"math"
	"testing"

	pmod "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
	"github.com/kiali/k-charted/prometheus"
)

func TestConvertAggregations(t *testing.T) {
	assert := assert.New(t)

	dashboardSpec := v1alpha1.MonitoringDashboardSpec{
		Items: []v1alpha1.MonitoringDashboardItem{
			v1alpha1.MonitoringDashboardItem{
				Chart: v1alpha1.MonitoringDashboardChart{
					Aggregations: []v1alpha1.MonitoringDashboardAggregation{
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Path",
							Label:       "path",
						},
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Error code",
							Label:       "error_code",
						},
					},
				},
			},
			v1alpha1.MonitoringDashboardItem{
				Chart: v1alpha1.MonitoringDashboardChart{
					Aggregations: []v1alpha1.MonitoringDashboardAggregation{
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Address",
							Label:       "address",
						},
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Error code",
							Label:       "error_code",
						},
					},
				},
			},
		},
	}

	converted := ConvertAggregations(dashboardSpec)

	// Results must be aggregated, unique and sorted
	assert.Len(converted, 3)
	assert.Equal(converted[0], Aggregation{DisplayName: "Address", Label: "address"})
	assert.Equal(converted[1], Aggregation{DisplayName: "Error code", Label: "error_code"})
	assert.Equal(converted[2], Aggregation{DisplayName: "Path", Label: "path"})
}

func TestJSONMarshalling(t *testing.T) {
	assert := assert.New(t)

	samplePair := SamplePair{
		Timestamp: 123456789,
		Value:     50.0,
	}

	res, err := json.Marshal(samplePair)
	assert.Nil(err)
	assert.Equal("[123456.789,\"50\"]", string(res))
}

func TestJSONMarshallingNaN(t *testing.T) {
	assert := assert.New(t)

	samplePair := SamplePair{
		Timestamp: 123456789,
		Value:     math.NaN(),
	}

	res, err := json.Marshal(samplePair)
	assert.Nil(err)
	assert.Equal("[123456.789,\"NaN\"]", string(res))
}

func TestConvertEmptyMatrix(t *testing.T) {
	assert := assert.New(t)
	var matrix pmod.Matrix

	// Make sure matrices are never nil, but empty slices
	res := ConvertMatrix(matrix, 0.0)
	assert.NotNil(res)
	assert.Len(res, 0)
}

func TestConvertEmptyMetric(t *testing.T) {
	assert := assert.New(t)
	var metric prometheus.Metric
	chart := Chart{}

	// Make sure metric is never nil, but empty slice
	FillMetric(metric, 0.0, "foo", &chart)
	assert.Empty(chart.Error)
	assert.Nil(chart.Histogram)
	assert.NotNil(chart.Metric)
	assert.Len(chart.Metric, 0)

	chart = Chart{}
	metric.Err = errors.New("Some error")
	FillMetric(metric, 0.0, "foo", &chart)
	assert.Equal("error in metric foo: Some error", chart.Error)
	assert.Nil(chart.Histogram)
	assert.Nil(chart.Metric)
}

func TestConvertEmptyHistogram(t *testing.T) {
	assert := assert.New(t)
	var histo prometheus.Histogram
	chart := Chart{}

	// An empty histogram gives an empty map
	FillHistogram(histo, 0.0, "foo", &chart)
	assert.Empty(chart.Error)
	assert.NotNil(chart.Histogram)
	assert.Len(chart.Histogram, 0)
	assert.Nil(chart.Metric)

	// ... But empty metrics within an histogram cannot be nil
	chart = Chart{}
	histo = make(prometheus.Histogram)
	var metric prometheus.Metric
	histo["0.99"] = metric
	FillHistogram(histo, 0.0, "foo", &chart)
	assert.Empty(chart.Error)
	assert.NotNil(chart.Histogram)
	assert.Len(chart.Histogram, 1)
	assert.NotNil(chart.Histogram["0.99"])
	assert.Len(chart.Histogram["0.99"], 0)
	assert.Nil(chart.Metric)

	// Check with error (here, histogram is nil)
	chart = Chart{}
	metric.Err = errors.New("Some error")
	histo["0.99"] = metric
	FillHistogram(histo, 0.0, "foo", &chart)
	assert.Equal("error in metric foo/0.99: Some error", chart.Error)
	assert.Nil(chart.Histogram)
	assert.Nil(chart.Metric)
}
