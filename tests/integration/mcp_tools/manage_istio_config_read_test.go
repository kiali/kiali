package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManageIstioConfigRead_MissingAction(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfigRead_InvalidAction(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{
		"action": "invalid",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfigRead_ValidActions(t *testing.T) {
	t.Run("list", func(t *testing.T) {
		resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{
			"action": "list",
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("list_with_namespace", func(t *testing.T) {
		resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{
			"action":    "list",
			"namespace": "bookinfo",
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestManageIstioConfigRead_GetMissingParams(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{
		"action": "get",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfigRead_WriteActionsRejected(t *testing.T) {
	for _, action := range []string{"create", "patch", "delete"} {
		t.Run(action, func(t *testing.T) {
			resp, err := CallMCPTool("manage_istio_config_read", map[string]interface{}{
				"action": action,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		})
	}
}
