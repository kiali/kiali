package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPodPerformance_MissingNamespace(t *testing.T) {
	resp, err := CallMCPTool("get_pod_performance", map[string]interface{}{})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
	assert.NotEqual(t, http.StatusOK, resp.StatusCode)
}

func TestGetPodPerformance_MissingPodAndWorkload(t *testing.T) {
	resp, err := CallMCPTool("get_pod_performance", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetPodPerformance_ValidWorkload(t *testing.T) {
	resp, err := CallMCPTool("get_pod_performance", map[string]interface{}{
		"namespace":    "bookinfo",
		"workloadName": "productpage-v1",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
