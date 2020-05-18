package threshold

import (
	"github.com/kiali/kiali/config"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
)

func TestGroupBy(t *testing.T) {

	requests := model.Vector{
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "300"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "200"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "300"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "200"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
	}

	result, total := groupBy(&requests, "response_code")
	assert.Equal(t, result, map[int]int{400: 3, 300: 2, 200: 2})
	assert.Equal(t, total, 7)
}

func TestCountByResponseCode(t *testing.T) {

	requests := model.Vector{
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "300"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "200"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "300"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "200"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"response_code": "400"}},
	}

	count, total, err := countByResponseCode(&requests, config.ThresholdCheck{Rule: "", Kind: "", Label: "response_code", Expression: "x>300"})
	assert.Equal(t, count, 3)
	assert.Equal(t, total, 7)
	assert.Equal(t, err, nil)

}

func TestCountByOtherCode(t *testing.T) {

	requests := model.Vector{
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "reviews"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "productpage"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "reviews"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "details"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "productpage-v2"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "productpage-v1"}},
		&model.Sample{Metric: map[model.LabelName]model.LabelValue{"destination_service_name": "reviews"}},
	}

	count, total, err := countByOtherCode(&requests, config.ThresholdCheck{Rule: "", Kind: "", Label: "destination_service_name", Expression: "^productpage-v([0-9])"})
	assert.Equal(t, count, 2)
	assert.Equal(t, total, 7)
	assert.Equal(t, err, nil)

}
