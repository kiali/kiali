package get_metrics

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/models"
)

func TestAggregateSeries(t *testing.T) {
	dps := []models.Datapoint{
		{Timestamp: 1, Value: 10},
		{Timestamp: 2, Value: 20},
		{Timestamp: 3, Value: 30},
	}
	st := aggregateSeries(dps)
	assert.InDelta(t, 10.0, st.min, 1e-9)
	assert.InDelta(t, 30.0, st.max, 1e-9)
	assert.InDelta(t, 20.0, st.mean, 1e-9)
	assert.InDelta(t, math.Sqrt(200.0/3.0), st.stdDev, 1e-9)
}

func TestIsEffectivelyConstant(t *testing.T) {
	flat := []models.Datapoint{
		{Timestamp: 1, Value: 1750},
		{Timestamp: 2, Value: 1750},
		{Timestamp: 3, Value: 1750},
	}
	assert.True(t, isEffectivelyConstant(flat))

	vary := []models.Datapoint{
		{Timestamp: 1, Value: 1.0},
		{Timestamp: 2, Value: 2.0},
	}
	assert.False(t, isEffectivelyConstant(vary))
}

func TestBucketAverages(t *testing.T) {
	dps := []models.Datapoint{
		{Timestamp: 100, Value: 1},
		{Timestamp: 200, Value: 2},
		{Timestamp: 300, Value: 3},
		{Timestamp: 400, Value: 4},
	}
	b := bucketAverages(dps, 4)
	require.Len(t, b, 4)
	assert.InDelta(t, 1.0, b[0], 1e-9)
	assert.InDelta(t, 4.0, b[3], 1e-9)
}

func TestSummarizeMetricsForLLM_Minimal(t *testing.T) {
	m := models.MetricsMap{
		"request_count": {
			{Name: "request_count", Datapoints: []models.Datapoint{{Timestamp: 1, Value: 0.95}, {Timestamp: 2, Value: 0.96}}},
		},
		"request_duration_millis": {
			{Stat: "0.5", Name: "request_duration_millis", Datapoints: []models.Datapoint{{Timestamp: 1, Value: 10}, {Timestamp: 2, Value: 12}}},
			{Stat: "avg", Name: "request_duration_millis", Datapoints: []models.Datapoint{{Timestamp: 1, Value: 11}, {Timestamp: 2, Value: 13}}},
		},
	}
	q := &models.IstioMetricsQuery{}
	q.Direction = "inbound"
	q.Reporter = "destination"
	q.RateInterval = "10m"
	q.Cluster = "cluster-default"
	q.End = time.Unix(2000, 0)
	q.Start = q.End.Add(-10 * time.Minute)

	out := SummarizeMetricsForLLM(m, "service", "bookinfo", "productpage", q)
	assert.False(t, out.Empty)
	assert.Equal(t, "productpage", out.Context.ResourceName)
	assert.Equal(t, "bookinfo", out.Context.Namespace)
	assert.Equal(t, "cluster-default", out.Context.Cluster)
	require.NotNil(t, out.Latency)
	assert.NotEmpty(t, out.Latency.Quantiles)

	_, err := json.Marshal(out)
	require.NoError(t, err)
}

func TestSummarizeMetricsForLLM_Empty(t *testing.T) {
	out := SummarizeMetricsForLLM(models.MetricsMap{}, "service", "ns", "svc", nil)
	assert.True(t, out.Empty)
	assert.NotEmpty(t, out.Message)
}

func TestHumanizeMetricTitle(t *testing.T) {
	assert.Equal(t, "Request Throughput", humanizeMetricTitle("request_throughput"))
}
