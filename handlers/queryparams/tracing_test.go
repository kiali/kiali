package queryparams

import (
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func TestParseTracingQueryUnknownParam(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("limit", "10")
	query.Set("foo", "bar")

	_, err := ParseTracingQuery(conf, query)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported query parameter 'foo'")
}

func TestParseErrorTracesDurationUnknownParam(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("duration", "60")
	query.Set("foo", "bar")

	_, _, err := ParseErrorTracesDuration(conf, query)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported query parameter 'foo'")
}

func TestParseTracingQueryValid(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("startMicros", "1000000")
	query.Set("endMicros", "2000000")
	query.Set("limit", "25")
	query.Set("minDuration", "500")
	query.Set("tags", `{"http.method":"GET"}`)
	query.Set("clusterName", "east")

	q, err := ParseTracingQuery(conf, query)
	require.NoError(t, err)
	assert.Equal(t, time.Unix(0, 1000000*int64(time.Microsecond)), q.Start)
	assert.Equal(t, time.Unix(0, 2000000*int64(time.Microsecond)), q.End)
	assert.Equal(t, 25, q.Limit)
	assert.Equal(t, 500*time.Microsecond, q.MinDuration)
	assert.Equal(t, "GET", q.Tags["http.method"])
	assert.Equal(t, "east", q.Cluster)
	assert.Equal(t, "east", q.Tags[models.IstioClusterTag])
}

func TestParseTracingQueryLimitBoundaries(t *testing.T) {
	conf := config.NewConfig()

	t.Run("zero rejected", func(t *testing.T) {
		query := url.Values{}
		query.Set("limit", "0")
		_, err := ParseTracingQuery(conf, query)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be positive")
	})

	t.Run("negative rejected", func(t *testing.T) {
		query := url.Values{}
		query.Set("limit", "-1")
		_, err := ParseTracingQuery(conf, query)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be positive")
	})

	t.Run("clamped to max", func(t *testing.T) {
		query := url.Values{}
		query.Set("limit", "999999")
		q, err := ParseTracingQuery(conf, query)
		require.NoError(t, err)
		assert.Equal(t, models.MaxTracingLimit, q.Limit)
	})
}

func TestParseTracingQueryTagsNull(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("tags", "null")

	_, err := ParseTracingQuery(conf, query)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "must be a JSON object, not null")
}

func TestParseTracingQueryAppliesQueryScope(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.QueryScope = map[string]string{
		"tenant": "acme",
	}
	query := url.Values{}
	query.Set("tags", `{"http.method":"GET"}`)

	q, err := ParseTracingQuery(conf, query)
	require.NoError(t, err)
	assert.Equal(t, "GET", q.Tags["http.method"])
	assert.Equal(t, "acme", q.Tags["tenant"])
	assert.Equal(t, conf.KubernetesConfig.ClusterName, q.Tags[models.IstioClusterTag])
}

func TestParseErrorTracesDurationValid(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("duration", "120")
	query.Set("clusterName", "west")

	duration, cluster, err := ParseErrorTracesDuration(conf, query)
	require.NoError(t, err)
	assert.Equal(t, 120*time.Second, duration)
	assert.Equal(t, "west", cluster)
}

func TestParseErrorTracesDurationBoundaries(t *testing.T) {
	conf := config.NewConfig()

	t.Run("zero rejected", func(t *testing.T) {
		query := url.Values{}
		query.Set("duration", "0")
		_, _, err := ParseErrorTracesDuration(conf, query)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be positive")
	})

	t.Run("non-numeric rejected", func(t *testing.T) {
		query := url.Values{}
		query.Set("duration", "abc")
		_, _, err := ParseErrorTracesDuration(conf, query)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot parse parameter 'duration'")
	})
}
