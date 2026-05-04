package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListOrGetResources_MissingResourceType(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestListOrGetResources_InvalidResourceType(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "invalid",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestListOrGetResources_ValidResourceTypes(t *testing.T) {
	for _, rt := range []string{"service", "workload", "app", "namespace"} {
		t.Run(rt, func(t *testing.T) {
			resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
				"resourceType": rt,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestListOrGetResources_ListServices(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"namespaces":   "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestListOrGetResources_ListNamespaces(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "namespaces")
	assert.Contains(t, resp.Parsed, "cluster")
}

func TestListOrGetResources_DetailService(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"namespaces":   "bookinfo",
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "service")
	assert.Contains(t, resp.Parsed, "health_status")
}

func TestListOrGetResources_DetailWorkload(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "workload",
		"namespaces":   "bookinfo",
		"resourceName": "productpage-v1",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "workload")
	assert.Contains(t, resp.Parsed, "status")
}

func TestListOrGetResources_DetailNamespace(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
		"resourceName": "bookinfo",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "namespace")
	assert.Contains(t, resp.Parsed, "cluster")
	assert.Contains(t, resp.Parsed, "counts")
}

func TestListOrGetResources_InvalidNamespace(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"namespaces":   "nonexistent-ns-12345",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Parsed, "errors")
}

func TestListOrGetResources_ResourceNameRequiresNamespace(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
