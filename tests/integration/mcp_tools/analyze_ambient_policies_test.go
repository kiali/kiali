package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnalyzeAmbientPolicies_MissingNamespace(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("analyze_ambient_policies")
	require.NoError(t, err)
	// Without Ambient the tool is gated at 404; with Ambient but no namespace it is 400.
	assert.True(t,
		resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusNotFound,
		"Expected 400 (missing namespace) or 404 (Ambient not enabled), got %d", resp.StatusCode)
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

	_, hasSummary := resp.Parsed["summary"]
	assert.True(t, hasSummary, "Response should contain 'summary'")

	_, hasNsStatus := resp.Parsed["namespace_status"]
	assert.True(t, hasNsStatus, "Response should contain 'namespace_status'")

	_, hasPolicies := resp.Parsed["policies"]
	assert.True(t, hasPolicies, "Response should contain 'policies'")
}
