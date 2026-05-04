package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetActionUI_MissingResourceType(t *testing.T) {
	resp, err := CallMCPTool("get_action_ui", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	assert.Contains(t, string(resp.Body), "resourceType is required")
}

func TestGetActionUI_InvalidResourceType(t *testing.T) {
	resp, err := CallMCPTool("get_action_ui", map[string]interface{}{
		"resourceType": "invalid_type",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	assert.Contains(t, string(resp.Body), "invalid resourceType")
}

func TestGetActionUI_ValidResourceTypes(t *testing.T) {
	validTypes := []string{"service", "workload", "app", "istio", "graph", "overview", "namespaces"}
	for _, rt := range validTypes {
		t.Run(rt, func(t *testing.T) {
			resp, err := CallMCPTool("get_action_ui", map[string]interface{}{
				"resourceType": rt,
				"namespaces":   "bookinfo",
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestGetActionUI_GraphWithType(t *testing.T) {
	for _, g := range []string{"mesh", "traffic"} {
		t.Run(g, func(t *testing.T) {
			resp, err := CallMCPTool("get_action_ui", map[string]interface{}{
				"resourceType": "graph",
				"graph":        g,
				"namespaces":   "bookinfo",
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}
