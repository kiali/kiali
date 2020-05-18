package threshold

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

var ns = "bookinfo"
var resource = "details-v1"
var labels = map[string]string{"app": "details", "version": "v1"}
var kind = "workload"

var configs = []config.ThresholdHealth{
	{
		Namespace: "bookinfo",
		ThresholdChecks: []config.ThresholdCheck{
			{
				Rule:       ">20",
				Kind:       "**",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
				Expression: "400<x<500",
				Alert:      "Warning-bookinfo->20",
			},
			{
				Rule:       ">90",
				Kind:       "service",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "reviews"}}},
				Expression: "x<=200",
				Alert:      "Warning-bookinfo->90",
			},
			{
				Rule:       ">90",
				Kind:       "workload",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"version": "v1"}}, Regex: "tails"},
				Expression: "x<=200",
				Alert:      "Warning-bookinfo->90",
			},
			{
				Rule:       ">60",
				Kind:       "service",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
				Expression: "x<400",
				Alert:      "Warning-bookinfo->60",
			},
		},
	},
	{
		Namespace: "**",
		ThresholdChecks: []config.ThresholdCheck{
			{
				Rule:       ">20",
				Kind:       "**",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
				Expression: "400<x<500",
				Alert:      "Warning-**->20",
			},
			{
				Rule:       ">90",
				Kind:       "service",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "reviews"}}},
				Expression: "x<=200",
				Alert:      "Warning-**->90",
			},
			{
				Rule:       ">60",
				Kind:       "workload",
				Label:      "response_code",
				Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
				Expression: "x<400",
				Alert:      "Warning-**->60",
			},
		},
	},
	{
		Namespace: "istio-system",
		ThresholdChecks: []config.ThresholdCheck{
			{
				Rule:       ">20",
				Kind:       "**",
				Label:      "response_code",
				Expression: "400<x<500",
				Alert:      "Warning-istio-system",
			},
		},
	},
}

func TestFilterBy(t *testing.T) {
	ns := "bookinfo"
	resource := "details"
	expected := []config.ThresholdCheck{
		{
			Rule:       ">20",
			Kind:       "**",
			Label:      "response_code",
			Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
			Expression: "400<x<500",
			Alert:      "Warning-bookinfo->20",
		},
		{
			Rule:       ">90",
			Kind:       "workload",
			Label:      "response_code",
			Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"version": "^v1$"}}, Regex: "tails"},
			Expression: "x<=200",
			Alert:      "Warning-bookinfo->90",
		},
		{
			Rule:       ">20",
			Kind:       "**",
			Label:      "response_code",
			Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
			Expression: "400<x<500",
			Alert:      "Warning-**->20",
		},
		{
			Rule:       ">60",
			Kind:       "workload",
			Label:      "response_code",
			Filter:     config.ThresholdFilter{LabelFilter: &config.ThresholdLabelFilter{Labels: map[string]string{"app": "details"}}},
			Expression: "x<400",
			Alert:      "Warning-**->60",
		},
	}

	result := FilterBy(configs, ns, resource, kind, labels)

	for k, v := range expected {
		assert.Equal(t, v.Label, result[k].Label)
		assert.Equal(t, v.Alert, result[k].Alert)
		assert.Equal(t, v.Kind, result[k].Kind)
		assert.Equal(t, v.Rule, result[k].Rule)
		assert.Equal(t, v.Expression, result[k].Expression)
	}
}

func TestCheckIfKind(t *testing.T) {
	assert.Equal(t, checkIfKind("**", ns), true)
	assert.Equal(t, checkIfKind("", ns), true)
	assert.Equal(t, checkIfKind("bookinfo", ns), true)
	assert.Equal(t, checkIfKind("bookinfo,istio-system", ns), true)
	assert.Equal(t, checkIfKind("istio-system", ns), false)
}

func TestCheckIfLabels(t *testing.T) {
	assert.Equal(t, checkIfLabels(map[string]string{"app": "details"}, labels), true)
	assert.Equal(t, checkIfLabels(map[string]string{}, labels), true)
	assert.Equal(t, checkIfLabels(map[string]string{"app": "reviews"}, labels), false)
	assert.Equal(t, checkIfLabels(labels, labels), true)
}

func TestCheckIfRegex(t *testing.T) {
	assert.Equal(t, checkIfRegex("v1", resource), true)
	assert.Equal(t, checkIfRegex("details", resource), true)
	assert.Equal(t, checkIfRegex("reviews", resource), false)
	assert.Equal(t, checkIfRegex("tails", resource), true)
}
