package model

import (
	"encoding/json"
	"math"
	"testing"

	pmod "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
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
	res := ConvertMatrix(matrix)
	assert.NotNil(res)
	assert.Len(res, 0)
}
