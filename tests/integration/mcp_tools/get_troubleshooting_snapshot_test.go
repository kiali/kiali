package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTroubleshootingSnapshot_MissingAll(t *testing.T) {
	resp, err := CallKialiUITool("get_troubleshooting_snapshot", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTroubleshootingSnapshot_MissingTarget(t *testing.T) {
	resp, err := CallKialiUITool("get_troubleshooting_snapshot", map[string]interface{}{
		"namespace": "bookinfo",
		"since":     "2026-01-01T10:00:00Z",
		"to":        "2026-01-01T11:00:00Z",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetTroubleshootingSnapshot_InvalidWindow(t *testing.T) {
	resp, err := CallKialiUITool("get_troubleshooting_snapshot", map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "productpage",
		"since":       "2026-01-01T11:00:00Z",
		"to":          "2026-01-01T10:00:00Z",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
