package mcp_tools

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListClusters_ReturnsOK(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("list_clusters")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestListClusters_ReturnsAtLeastOneCluster(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("list_clusters")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var clusters []map[string]interface{}
	require.NoError(t, json.Unmarshal(resp.Body, &clusters))
	require.NotEmpty(t, clusters, "expected at least one cluster")
}

func TestListClusters_HomeClusterPresent(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("list_clusters")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var clusters []map[string]interface{}
	require.NoError(t, json.Unmarshal(resp.Body, &clusters))

	hasHome := false
	for _, c := range clusters {
		name, hasName := c["name"]
		assert.True(t, hasName, "cluster entry should have a 'name' field")
		assert.NotEmpty(t, name)

		if isHome, ok := c["isHome"].(bool); ok && isHome {
			hasHome = true
		}
	}
	assert.True(t, hasHome, "expected at least one cluster marked as home")
}
