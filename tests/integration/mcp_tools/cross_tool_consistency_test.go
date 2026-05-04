package mcp_tools

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMeshStatusDataPlaneMatchesInjectedNamespaces verifies that the namespaces
// reported by get_mesh_status in components.data_plane.monitored_namespaces match
// the namespaces from list_or_get_resources that have injection enabled.
func TestMeshStatusDataPlaneMatchesInjectedNamespaces(t *testing.T) {
	// Get mesh status
	meshResp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	require.Equal(t, 200, meshResp.StatusCode)

	// Get namespace list
	nsResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
	})
	require.NoError(t, err)
	require.Equal(t, 200, nsResp.StatusCode)

	// Extract monitored namespaces from mesh status
	components, ok := meshResp.Parsed["components"].(map[string]interface{})
	require.True(t, ok, "mesh status should have 'components'")
	dataPlane, ok := components["data_plane"].(map[string]interface{})
	require.True(t, ok, "components should have 'data_plane'")
	monitoredRaw, ok := dataPlane["monitored_namespaces"].([]interface{})
	require.True(t, ok, "data_plane should have 'monitored_namespaces' array")

	monitoredNames := make(map[string]bool)
	for _, item := range monitoredRaw {
		ns, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, ok := ns["name"].(string)
		require.True(t, ok)
		monitoredNames[name] = true
	}

	// Extract injected namespaces from list_or_get_resources
	nsRaw, ok := nsResp.Parsed["namespaces"].([]interface{})
	require.True(t, ok, "namespace list should have 'namespaces' array")

	var injectedNames []string
	for _, item := range nsRaw {
		ns, ok := item.(map[string]interface{})
		require.True(t, ok)
		injection, _ := ns["injection"].(string)
		if injection == "enabled" {
			name, _ := ns["name"].(string)
			injectedNames = append(injectedNames, name)
		}
	}

	// Verify count matches
	assert.Equal(t, len(injectedNames), len(monitoredNames),
		"monitored namespace count (%d) should equal injected namespace count (%d)",
		len(monitoredNames), len(injectedNames))

	// Verify each injected namespace is in monitored list
	for _, name := range injectedNames {
		assert.True(t, monitoredNames[name],
			"injected namespace %q should be in mesh status monitored_namespaces", name)
	}

	// Verify each monitored namespace is in injected list
	injectedSet := make(map[string]bool)
	for _, name := range injectedNames {
		injectedSet[name] = true
	}
	for name := range monitoredNames {
		assert.True(t, injectedSet[name],
			"monitored namespace %q should be in injected namespaces from list_or_get_resources", name)
	}
}

// TestMeshStatusControlPlaneNamespacesExistInNamespaceList verifies that the
// namespaces where control plane nodes run are present in the namespace list
// returned by list_or_get_resources (regardless of injection status).
func TestMeshStatusControlPlaneNamespacesExistInNamespaceList(t *testing.T) {
	// Get mesh status
	meshResp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	require.Equal(t, 200, meshResp.StatusCode)

	// Get namespace list
	nsResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
	})
	require.NoError(t, err)
	require.Equal(t, 200, nsResp.StatusCode)

	// Extract control plane node namespaces
	components, ok := meshResp.Parsed["components"].(map[string]interface{})
	require.True(t, ok)
	controlPlane, ok := components["control_plane"].(map[string]interface{})
	require.True(t, ok, "components should have 'control_plane'")
	nodes, ok := controlPlane["nodes"].([]interface{})
	require.True(t, ok, "control_plane should have 'nodes' array")
	require.NotEmpty(t, nodes, "control plane should have at least one node")

	cpNamespaces := make(map[string]bool)
	for _, item := range nodes {
		node, ok := item.(map[string]interface{})
		require.True(t, ok)
		ns, ok := node["namespace"].(string)
		require.True(t, ok)
		cpNamespaces[ns] = true
	}

	// Build set of all namespace names from list_or_get_resources
	nsRaw, ok := nsResp.Parsed["namespaces"].([]interface{})
	require.True(t, ok)

	allNames := make(map[string]bool)
	for _, item := range nsRaw {
		ns, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, _ := ns["name"].(string)
		allNames[name] = true
	}

	// Verify each control plane namespace exists in the namespace list
	for ns := range cpNamespaces {
		assert.True(t, allNames[ns],
			"control plane namespace %q should exist in namespace list from list_or_get_resources", ns)
	}
}
