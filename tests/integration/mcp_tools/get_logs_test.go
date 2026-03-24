package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetLogs_MissingAll(t *testing.T) {
	resp, err := CallMCPTool("get_logs", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetLogs_MissingName(t *testing.T) {
	resp, err := CallMCPTool("get_logs", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetLogs_MissingNamespace(t *testing.T) {
	resp, err := CallMCPTool("get_logs", map[string]interface{}{
		"name": "productpage-v1",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetLogs_ValidWorkload(t *testing.T) {
	resp, err := CallMCPTool("get_logs", map[string]interface{}{
		"namespace": "bookinfo",
		"name":      "productpage-v1",
		"tail":      10,
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestGetLogs_WithFormat(t *testing.T) {
	for _, fmt := range []string{"codeblock", "plain"} {
		t.Run(fmt, func(t *testing.T) {
			resp, err := CallMCPTool("get_logs", map[string]interface{}{
				"namespace": "bookinfo",
				"name":      "productpage-v1",
				"tail":      5,
				"format":    fmt,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}
