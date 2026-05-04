package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMeshTrafficGraph_MissingNamespaces(t *testing.T) {
	resp, err := CallMCPTool("get_mesh_traffic_graph", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetMeshTrafficGraph_ValidNamespace(t *testing.T) {
	resp, err := CallMCPTool("get_mesh_traffic_graph", map[string]interface{}{
		"namespaces": "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "nodes")
	assert.Contains(t, resp.Parsed, "traffic")
	assert.Contains(t, resp.Parsed, "graphType")
}

func TestGetMeshTrafficGraph_InvalidNamespace(t *testing.T) {
	resp, err := CallMCPTool("get_mesh_traffic_graph", map[string]interface{}{
		"namespaces": "nonexistent-ns-12345",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestGetMeshTrafficGraph_ValidGraphTypes(t *testing.T) {
	for _, gt := range []string{"versionedApp", "app", "service", "workload"} {
		t.Run(gt, func(t *testing.T) {
			resp, err := CallMCPTool("get_mesh_traffic_graph", map[string]interface{}{
				"namespaces": "bookinfo",
				"graphType":  gt,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}
