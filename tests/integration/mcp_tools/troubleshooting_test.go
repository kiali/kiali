package mcp_tools

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTroubleshooting_NoArgs(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("troubleshooting")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var issues []interface{}
	require.NoError(t, json.Unmarshal(resp.Body, &issues))
}

func TestTroubleshooting_WithNamespace(t *testing.T) {
	resp, err := CallMCPTool("troubleshooting", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
	if resp.StatusCode == http.StatusOK {
		var issues []interface{}
		require.NoError(t, json.Unmarshal(resp.Body, &issues))
	}
}
