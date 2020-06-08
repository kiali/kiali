package threshold

import (
	"github.com/kiali/kiali/config"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
)

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

	count, total, err := CountBy(&requests, config.ThresholdCheck{Rule: "", Kind: "", Label: "destination_service_name", Expression: "^productpage-v([0-9])"})
	assert.Equal(t, count, 2)
	assert.Equal(t, total, 7)
	assert.Equal(t, err, nil)

}
