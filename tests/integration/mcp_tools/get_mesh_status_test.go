package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMeshStatus_NoArgs(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.NotNil(t, resp.Parsed)
}

func TestGetMeshStatus_HasComponents(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	components, ok := resp.Parsed["components"]
	assert.True(t, ok, "Response should contain 'components'")
	assert.NotNil(t, components)
}

func TestGetMeshStatus_HasEnvironment(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	env, ok := resp.Parsed["environment"]
	assert.True(t, ok, "Response should contain 'environment'")
	assert.NotNil(t, env)
}
