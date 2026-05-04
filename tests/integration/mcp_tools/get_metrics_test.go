package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMetrics_MissingAll(t *testing.T) {
	resp, err := CallMCPTool("get_metrics", map[string]interface{}{})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
	assert.NotEqual(t, http.StatusOK, resp.StatusCode)
}

func TestGetMetrics_MissingNamespace(t *testing.T) {
	resp, err := CallMCPTool("get_metrics", map[string]interface{}{
		"resourceType": "service",
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	// Missing namespace triggers a namespace access check failure (403)
	assert.NotEqual(t, http.StatusOK, resp.StatusCode)
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetMetrics_MissingResourceName(t *testing.T) {
	resp, err := CallMCPTool("get_metrics", map[string]interface{}{
		"resourceType": "service",
		"namespace":    "bookinfo",
	})
	require.NoError(t, err)
	// Tool still returns metrics even without resourceName
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetMetrics_InvalidResourceType(t *testing.T) {
	resp, err := CallMCPTool("get_metrics", map[string]interface{}{
		"resourceType": "invalid",
		"namespace":    "bookinfo",
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetMetrics_ValidResourceTypes(t *testing.T) {
	for _, rt := range []string{"service", "workload", "app"} {
		t.Run(rt, func(t *testing.T) {
			name := "productpage"
			if rt == "workload" {
				name = "productpage-v1"
			}
			resp, err := CallMCPTool("get_metrics", map[string]interface{}{
				"resourceType": rt,
				"namespace":    "bookinfo",
				"resourceName": name,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestGetMetrics_WithDirection(t *testing.T) {
	for _, dir := range []string{"inbound", "outbound"} {
		t.Run(dir, func(t *testing.T) {
			resp, err := CallMCPTool("get_metrics", map[string]interface{}{
				"resourceType": "service",
				"namespace":    "bookinfo",
				"resourceName": "productpage",
				"direction":    dir,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}
