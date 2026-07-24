package handlers

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestParseIstioConfigListParamsUnknownParam(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("objects", "virtualservices")
	query.Set("foo", "bar")

	_, err := parseIstioConfigListParams(conf, query)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported query parameter 'foo'")
}

func TestParseIstioConfigListParamsInvalidValidate(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("validate", "maybe")

	_, err := parseIstioConfigListParams(conf, query)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "validate")
}
