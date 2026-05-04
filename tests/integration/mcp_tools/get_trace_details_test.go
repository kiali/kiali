package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTraceDetails_MissingTraceId(t *testing.T) {
	resp, err := CallMCPTool("get_trace_details", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTraceDetails_WithTraceId(t *testing.T) {
	resp, err := CallMCPTool("get_trace_details", map[string]interface{}{
		"traceId": "0000000000000000",
	})
	require.NoError(t, err)
	// Not a client error: may be 404 (unknown id), 503 (backend), or 200 if present
	assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
}
