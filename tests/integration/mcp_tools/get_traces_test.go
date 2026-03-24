package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTraces_MissingParams(t *testing.T) {
	resp, err := CallMCPTool("get_traces", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTraces_MissingServiceName(t *testing.T) {
	resp, err := CallMCPTool("get_traces", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTraces_ValidService(t *testing.T) {
	resp, err := CallMCPTool("get_traces", map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "productpage",
		"limit":       5,
	})
	require.NoError(t, err)
	// May return 200 or 500 (tracing backend may not be available in CI)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
	assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTraces_WithTraceId(t *testing.T) {
	resp, err := CallMCPTool("get_traces", map[string]interface{}{
		"traceId": "0000000000000000",
	})
	require.NoError(t, err)
	// traceId bypasses namespace/service requirement
	assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
}
