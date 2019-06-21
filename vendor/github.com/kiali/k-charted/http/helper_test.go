package http

import (
	"net/url"
	"testing"

	"github.com/kiali/k-charted/model"
	"github.com/stretchr/testify/assert"
)

func TestExtractEmptyDashboardQueryParams(t *testing.T) {
	assert := assert.New(t)

	queryParams := url.Values{
		"": []string{""},
	}

	params := model.DashboardQuery{Namespace: "test"}
	err := ExtractDashboardQueryParams(queryParams, &params)

	assert.Nil(err)
	assert.Equal("test", params.Namespace)
	assert.Equal("sum", params.RawDataAggregator)
}

func TestExtractDashboardQueryParams(t *testing.T) {
	assert := assert.New(t)

	queryParams := url.Values{
		"labelsFilters":     []string{" app : foo  ,   version:v1 "},
		"additionalLabels":  []string{" xx : XX  ,   yy:YY "},
		"rawDataAggregator": []string{"avg"},
	}

	params := model.DashboardQuery{Namespace: "test"}
	err := ExtractDashboardQueryParams(queryParams, &params)

	assert.Nil(err)
	assert.Equal("test", params.Namespace)
	assert.Equal("avg", params.RawDataAggregator)
	assert.Len(params.LabelsFilters, 2)
	assert.Equal("foo", params.LabelsFilters["app"])
	assert.Equal("v1", params.LabelsFilters["version"])
	assert.Len(params.AdditionalLabels, 2)
	assert.Equal(model.Aggregation{
		Label:       "xx",
		DisplayName: "XX",
	}, params.AdditionalLabels[0])
	assert.Equal(model.Aggregation{
		Label:       "yy",
		DisplayName: "YY",
	}, params.AdditionalLabels[1])
}
