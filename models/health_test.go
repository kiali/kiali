package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewNamespaceHealthBucket(t *testing.T) {
	b := newNamespaceHealthBucket()
	require.NotNil(t, b)
	assert.NotNil(t, b.InError)
	assert.NotNil(t, b.InNotReady)
	assert.NotNil(t, b.InSuccess)
	assert.NotNil(t, b.InWarning)
	assert.NotNil(t, b.NotAvailable)
	assert.Len(t, b.InError, 0)
	assert.Len(t, b.InNotReady, 0)
	assert.Len(t, b.InSuccess, 0)
	assert.Len(t, b.InWarning, 0)
	assert.Len(t, b.NotAvailable, 0)

	// JSON should marshal arrays, not null
	data, err := json.Marshal(b)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"inError":[]`)
	assert.Contains(t, string(data), `"inWarning":[]`)
	assert.NotContains(t, string(data), `"inError":null`)
}

func TestAggregateNamespaceStatus_EmptyMaps(t *testing.T) {
	agg := AggregateNamespaceStatus(nil, nil, nil)
	require.NotNil(t, agg)
	assert.Equal(t, string(HealthStatusNA), agg.WorstStatus)
}

func TestAggregateNamespaceStatus_EmptyMapsNonNil(t *testing.T) {
	app := NamespaceAppHealth{}
	svc := NamespaceServiceHealth{}
	wl := NamespaceWorkloadHealth{}
	agg := AggregateNamespaceStatus(&app, &svc, &wl)
	require.NotNil(t, agg)
	assert.Equal(t, string(HealthStatusNA), agg.WorstStatus)
	if agg.StatusApp != nil {
		assert.Len(t, agg.StatusApp.InError, 0)
	}
	if agg.StatusService != nil {
		assert.Len(t, agg.StatusService.InError, 0)
	}
	if agg.StatusWorkload != nil {
		assert.Len(t, agg.StatusWorkload.InError, 0)
	}
}

func TestAggregateNamespaceStatus_AppFailure(t *testing.T) {
	app := NamespaceAppHealth{
		"bad": {
			Status: &CalculatedHealthStatus{Status: HealthStatusFailure},
		},
		"good": {
			Status: &CalculatedHealthStatus{Status: HealthStatusHealthy},
		},
	}
	agg := AggregateNamespaceStatus(&app, nil, nil)
	require.NotNil(t, agg)
	assert.Equal(t, string(HealthStatusFailure), agg.WorstStatus)
	require.NotNil(t, agg.StatusApp)
	assert.Equal(t, []string{"bad"}, agg.StatusApp.InError)
	assert.Equal(t, []string{"good"}, agg.StatusApp.InSuccess)
}

func TestAggregateNamespaceStatus_MergesWorstAcrossTypes(t *testing.T) {
	app := NamespaceAppHealth{
		"a": {Status: &CalculatedHealthStatus{Status: HealthStatusHealthy}},
	}
	svc := NamespaceServiceHealth{
		"s": {Status: &CalculatedHealthStatus{Status: HealthStatusDegraded}},
	}
	wl := NamespaceWorkloadHealth{
		"w": {Status: &CalculatedHealthStatus{Status: HealthStatusHealthy}},
	}
	agg := AggregateNamespaceStatus(&app, &svc, &wl)
	require.NotNil(t, agg)
	assert.Equal(t, string(HealthStatusDegraded), agg.WorstStatus)
	require.NotNil(t, agg.StatusApp)
	require.NotNil(t, agg.StatusService)
	require.NotNil(t, agg.StatusWorkload)
	assert.Contains(t, agg.StatusService.InWarning, "s")
}
