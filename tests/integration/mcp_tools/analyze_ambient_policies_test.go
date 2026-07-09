package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnalyzeAmbientPolicies_NoNamespace(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("analyze_ambient_policies")
	require.NoError(t, err)
	// Without Ambient the tool is gated at 404.
	// With Ambient enabled and no namespace specified, the tool auto-discovers all Ambient
	// namespaces and returns 200 OK (even if none are found).
	assert.True(t,
		resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound,
		"Expected 200 (auto-discovery) or 404 (Ambient not enabled), got %d", resp.StatusCode)
}

func TestAnalyzeAmbientPolicies_WithNamespace(t *testing.T) {
	resp, err := CallMCPTool("analyze_ambient_policies", map[string]interface{}{
		"namespace": "bookinfo",
	})
	require.NoError(t, err)

	if resp.StatusCode == http.StatusNotFound {
		t.Skip("Ambient Mesh is not enabled in this cluster — skipping analyze_ambient_policies test")
	}

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.NotNil(t, resp.Parsed)

	// Top-level response contains a "namespaces" array; per-namespace details live inside it.
	namespacesRaw, hasNamespaces := resp.Parsed["namespaces"]
	assert.True(t, hasNamespaces, "Response should contain 'namespaces'")

	namespaces, ok := namespacesRaw.([]interface{})
	require.True(t, ok, "'namespaces' should be an array")
	require.NotEmpty(t, namespaces, "'namespaces' array should have at least one entry")

	nsEntry, ok := namespaces[0].(map[string]interface{})
	require.True(t, ok, "first namespace entry should be an object")

	_, hasNsStatus := nsEntry["namespace_status"]
	assert.True(t, hasNsStatus, "Namespace entry should contain 'namespace_status'")

	_, hasPolicies := nsEntry["policies"]
	assert.True(t, hasPolicies, "Namespace entry should contain 'policies'")

	_, hasSummary := nsEntry["summary"]
	assert.True(t, hasSummary, "Namespace entry should contain 'summary'")
}
