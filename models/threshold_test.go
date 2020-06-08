package models

import (
	"fmt"
	"github.com/prometheus/common/model"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models/threshold"
)

var thresholdConfResponseCode = []config.ThresholdCheck{
	{
		Rule:        ">20",
		Kind:        "service",
		RequestType: "inbound",
		Label:       "response_code",
		Expression:  "x>=200",
		Alert:       "warning",
	},
}

var thresholdConfOther = []config.ThresholdCheck{
	{
		Rule:        ">20",
		Kind:        "service",
		RequestType: "inbound",
		Label:       "destination_service_name",
		Expression:  "^reviews$",
		Alert:       "warning",
	},
}

var thresholdConfOtherWrongRegex = []config.ThresholdCheck{
	{
		Rule:        ">20",
		Kind:        "service",
		RequestType: "inbound",
		Label:       "destination_service_name",
		Expression:  "^rev23iews$",
		Alert:       "warning",
	},
}

func TestParse(t *testing.T) {
	thresholds := Thresholds{}
	thresholds.Parse(thresholdConfResponseCode, &threshold.Requests, &model.Vector{})
	calculation := (1 * 100 / len(threshold.Requests))
	thresholdsResult := Thresholds{
		{
			Percent: 50,
			Rule:    fmt.Sprintf("[%s][%s] Alert requests where %s are %d%% , rule defined %s", thresholdConfResponseCode[0].Alert, thresholdConfResponseCode[0].RequestType, thresholdConfResponseCode[0].Expression, calculation, thresholdConfResponseCode[0].Rule),
			Alert:   thresholdConfResponseCode[0].Alert,
		},
	}
	assert.Equal(t, thresholdsResult, thresholds)

	// other property

	thresholds = Thresholds{}
	thresholds.Parse(thresholdConfOther, &threshold.Requests, &model.Vector{})
	thresholdsResult = Thresholds{
		{
			Percent: 50,
			Rule:    fmt.Sprintf("[%s][%s] Alert requests where %s are %d%% , rule defined %s", thresholdConfOther[0].Alert, thresholdConfResponseCode[0].RequestType, thresholdConfOther[0].Expression, calculation, thresholdConfOther[0].Rule),
			Alert:   thresholdConfResponseCode[0].Alert,
		},
	}
	assert.Equal(t, thresholdsResult, thresholds)

	// other property with wrong regex

	thresholds = Thresholds{}
	thresholds.Parse(thresholdConfOtherWrongRegex, &threshold.Requests, &model.Vector{})
	thresholdsResult = Thresholds{}
	assert.Equal(t, thresholdsResult, thresholds)

}
