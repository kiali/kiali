package queryparams

import (
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRejectUnknown(t *testing.T) {
	t.Run("allows known params", func(t *testing.T) {
		query := url.Values{}
		query.Set("duration", "60s")
		query.Set("clusterName", "cluster-default")
		assert.NoError(t, RejectUnknown(query, "duration", "clusterName"))
	})

	t.Run("rejects unknown params", func(t *testing.T) {
		query := url.Values{}
		query.Set("duration", "60s")
		query.Set("foo", "bar")
		err := RejectUnknown(query, "duration")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported query parameter 'foo'")
	})

	t.Run("allows array-style params", func(t *testing.T) {
		query := url.Values{}
		query.Add("filters[]", "request_count")
		assert.NoError(t, RejectUnknown(query, "filters[]"))
	})
}

func TestParseQueryTime(t *testing.T) {
	parsed, err := ParseQueryTime("1523364061")
	require.NoError(t, err)
	assert.Equal(t, time.Unix(1523364061, 0), parsed)

	_, err = ParseQueryTime("not-a-number")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "queryTime")
}

func TestParseBoolParam(t *testing.T) {
	value, err := ParseBoolParam("", "health", true)
	require.NoError(t, err)
	assert.True(t, value)

	value, err = ParseBoolParam("false", "health", true)
	require.NoError(t, err)
	assert.False(t, value)

	_, err = ParseBoolParam("maybe", "health", true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "health")
}

func TestValidateEnum(t *testing.T) {
	assert.NoError(t, ValidateEnum("", "type", "app", "service"))
	assert.NoError(t, ValidateEnum("app", "type", "app", "service"))

	err := ValidateEnum("invalid", "type", "app", "service")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "type")
}

func TestValidatePromDuration(t *testing.T) {
	assert.NoError(t, ValidatePromDuration("", "rateInterval"))
	assert.NoError(t, ValidatePromDuration("5m", "rateInterval"))

	err := ValidatePromDuration("5 minutes", "rateInterval")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rateInterval")
}
