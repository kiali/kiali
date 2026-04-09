package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListTraces_MissingParams(t *testing.T) {
	resp, err := CallMCPTool("list_traces", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestListTraces_MissingServiceName(t *testing.T) {
	resp, err := CallMCPTool("list_traces", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestListTraces_ValidService(t *testing.T) {
	resp, err := CallMCPTool("list_traces", map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "productpage",
		"limit":       5,
	})
	require.NoError(t, err)
	// May return 200 or 503 (tracing backend may not be available in CI)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
	assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
}
