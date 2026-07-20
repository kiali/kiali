package queryparams

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
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
