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
	"github.com/kiali/k-charted/prometheus/mock"
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
	res := ConvertMatrix(matrix, map[string]string{}, 0.0)
	assert.NotNil(res)
	assert.Len(res, 0)
}

func TestConvertMetric(t *testing.T) {
	assert := assert.New(t)
	metric := mock.FakeCounter(10)
	chart := Chart{}
	ref := v1alpha1.MonitoringDashboardMetric{MetricName: "foo", DisplayName: "Foo"}

	// Make sure metric is never nil, but empty slice
	chart.FillMetric(ref, metric, 2.0)
	assert.Empty(chart.Error)
	assert.Len(chart.Metrics, 1)
	assert.Len(chart.Metrics[0].LabelSet, 1)
	assert.Equal("Foo", chart.Metrics[0].LabelSet["__name__"])
	assert.Len(chart.Metrics[0].Values, 1)
	// Note, value is scaled x2
	assert.Equal(float64(20), chart.Metrics[0].Values[0].Value)
}

func TestConvertEmptyMetric(t *testing.T) {
	assert := assert.New(t)
	var metric prometheus.Metric
	chart := Chart{}
	ref := v1alpha1.MonitoringDashboardMetric{MetricName: "foo", DisplayName: "Foo"}

	chart.FillMetric(ref, metric, 0.0)
	assert.Empty(chart.Error)
	assert.Empty(chart.Metrics)

	chart = Chart{}
	metric.Err = errors.New("Some error")
	chart.FillMetric(ref, metric, 0.0)
	assert.Equal("error in metric foo: Some error", chart.Error)
	assert.Empty(chart.Metrics)
}

func TestConvertHistogram(t *testing.T) {
	assert := assert.New(t)
	histo := mock.FakeHistogram(10, 15)
	chart := Chart{}
	ref := v1alpha1.MonitoringDashboardMetric{MetricName: "foo", DisplayName: "Foo"}

	chart.FillHistogram(ref, histo, 2.0)
	assert.Empty(chart.Error)
	assert.Len(chart.Metrics, 2)

	m1 := chart.Metrics[0]
	assert.Len(m1.Values, 1)
	assert.Len(m1.LabelSet, 2)
	assert.Equal("Foo", m1.LabelSet["__name__"])
	assert.Equal("0.99", m1.LabelSet["__stat__"])
	// Note, values are scaled x2
	assert.Equal(float64(30), m1.Values[0].Value)

	m2 := chart.Metrics[1]
	assert.Len(m2.Values, 1)
	assert.Len(m2.LabelSet, 2)
	assert.Equal("Foo", m2.LabelSet["__name__"])
	assert.Equal("avg", m2.LabelSet["__stat__"])
	// Note, values are scaled x2
	assert.Equal(float64(20), m2.Values[0].Value)
}

func TestConvertEmptyHistogram(t *testing.T) {
	assert := assert.New(t)
	var histo prometheus.Histogram
	chart := Chart{}
	ref := v1alpha1.MonitoringDashboardMetric{MetricName: "foo", DisplayName: "Foo"}

	chart.FillHistogram(ref, histo, 0.0)
	assert.Empty(chart.Error)
	assert.Empty(chart.Metrics)

	// Empty metrics within an histogram
	chart = Chart{}
	histo = make(prometheus.Histogram)
	var metric prometheus.Metric
	histo["0.99"] = metric
	chart.FillHistogram(ref, histo, 0.0)
	assert.Empty(chart.Error)
	assert.Empty(chart.Metrics)

	// Check with error
	chart = Chart{}
	metric.Err = errors.New("Some error")
	histo["0.99"] = metric
	chart.FillHistogram(ref, histo, 0.0)
	assert.Equal("error in metric foo/0.99: Some error", chart.Error)
	assert.Empty(chart.Metrics)
}
