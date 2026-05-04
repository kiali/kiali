package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManageIstioConfig_MissingAction(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfig_InvalidAction(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
		"action": "invalid",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfig_ReadActionsRejected(t *testing.T) {
	for _, action := range []string{"list", "get"} {
		t.Run(action, func(t *testing.T) {
			resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
				"action": action,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		})
	}
}

func TestManageIstioConfig_CreateMissingRequired(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
		"action":    "create",
		"confirmed": false,
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfig_CreatePreview(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
		"action":    "create",
		"confirmed": false,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "test-dr",
		"data":      `{"apiVersion":"networking.istio.io/v1","kind":"DestinationRule","metadata":{"name":"test-dr","namespace":"bookinfo"},"spec":{"host":"reviews"}}`,
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestManageIstioConfig_DeleteMissingObject(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
		"action":    "delete",
		"confirmed": false,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestManageIstioConfig_PatchMissingData(t *testing.T) {
	resp, err := CallMCPTool("manage_istio_config", map[string]interface{}{
		"action":    "patch",
		"confirmed": false,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "test-dr",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
