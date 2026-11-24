package mcp

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTroubleshootingSnapshotSchema(t *testing.T) {
	require.NoError(t, LoadTools())

	tool, ok := DefaultToolHandlers["get_troubleshooting_snapshot"]
	assert.True(t, ok, "get_troubleshooting_snapshot should be available to the Kiali chatbot")
	_, ok = MCPToolHandlers["get_troubleshooting_snapshot"]
	assert.False(t, ok, "get_troubleshooting_snapshot is intentionally unavailable to external MCP clients")

	schema := tool.GetDefinition()
	assert.Equal(t, "get_troubleshooting_snapshot", tool.GetName())
	assert.NotEmpty(t, tool.GetDescription())

	properties, ok := schema["properties"].(map[string]interface{})
	require.True(t, ok)
	for _, field := range []string{"clusterName", "durationSeconds", "namespace", "serviceName", "since", "to", "workloadName"} {
		assert.Contains(t, properties, field)
	}

	required, ok := schema["required"].([]interface{})
	require.True(t, ok)
	assert.Contains(t, required, "namespace")
	assert.NotContains(t, required, "since")
	assert.NotContains(t, required, "to")
}
