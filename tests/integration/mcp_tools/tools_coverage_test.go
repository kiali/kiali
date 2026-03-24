package mcp_tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAllToolsHaveIntegrationTests verifies that every YAML tool definition
// in ai/mcp/tools/ has a corresponding integration test file in this directory.
func TestAllToolsHaveIntegrationTests(t *testing.T) {
	toolsDir := filepath.Join("..", "..", "..", "ai", "mcp", "tools")
	entries, err := os.ReadDir(toolsDir)
	require.NoError(t, err, "Failed to read tools directory: %s", toolsDir)

	var toolNames []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") {
			toolName := strings.TrimSuffix(strings.TrimSuffix(name, ".yaml"), ".yml")
			toolNames = append(toolNames, toolName)
		}
	}

	require.NotEmpty(t, toolNames, "No tool YAML files found in %s", toolsDir)

	testDir := "."
	testEntries, err := os.ReadDir(testDir)
	require.NoError(t, err)

	testFiles := make(map[string]bool)
	for _, e := range testEntries {
		if strings.HasSuffix(e.Name(), "_test.go") {
			testFiles[e.Name()] = true
		}
	}

	for _, tool := range toolNames {
		expectedFile := tool + "_test.go"
		assert.True(t, testFiles[expectedFile],
			"Missing integration test file for tool %q: expected %s", tool, expectedFile)
	}
}

// TestAllMCPEndpointsExist verifies that the /api/chat/mcp/<tool> endpoint
// returns something other than 404 for every registered tool.
func TestAllMCPEndpointsExist(t *testing.T) {
	toolsDir := filepath.Join("..", "..", "..", "ai", "mcp", "tools")
	entries, err := os.ReadDir(toolsDir)
	require.NoError(t, err)

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
			continue
		}
		toolName := strings.TrimSuffix(strings.TrimSuffix(name, ".yaml"), ".yml")

		t.Run(toolName, func(t *testing.T) {
			resp, err := CallMCPToolEmptyBody(toolName)
			require.NoError(t, err, "Failed to call tool %s", toolName)
			assert.NotEqual(t, 404, resp.StatusCode,
				"Tool endpoint /api/chat/mcp/%s returned 404 — not registered", toolName)
		})
	}
}
