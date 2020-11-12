package handlers

import (
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
)

func TestExtractEmptyDashboardQueryParams(t *testing.T) {
	assert := assert.New(t)

	queryParams := url.Values{
		"": []string{""},
	}

	params := models.DashboardQuery{Namespace: "test"}
	err := extractDashboardQueryParams(queryParams, &params, buildNamespace("ns", time.Time{}))

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

	params := models.DashboardQuery{Namespace: "test"}
	err := extractDashboardQueryParams(queryParams, &params, buildNamespace("ns", time.Time{}))

	assert.Nil(err)
	assert.Equal("test", params.Namespace)
	assert.Equal("avg", params.RawDataAggregator)
	assert.Len(params.LabelsFilters, 2)
	assert.Equal("foo", params.LabelsFilters["app"])
	assert.Equal("v1", params.LabelsFilters["version"])
	assert.Len(params.AdditionalLabels, 2)
	assert.Equal(models.Aggregation{
		Label:       "xx",
		DisplayName: "XX",
	}, params.AdditionalLabels[0])
	assert.Equal(models.Aggregation{
		Label:       "yy",
		DisplayName: "YY",
	}, params.AdditionalLabels[1])
}
