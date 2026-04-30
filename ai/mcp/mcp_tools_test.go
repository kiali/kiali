package mcp

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadTools_Success(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)
	assert.Greater(t, len(DefaultToolHandlers), 0, "Should load at least one tool")
}

func TestLoadTools_Concurrent(t *testing.T) {
	// Reset state for this test (normally would use a test helper, but keeping it simple)
	// Note: In real scenario, sync.Once cannot be reset, so we're testing that concurrent
	// calls don't cause issues even if LoadTools was already called

	var wg sync.WaitGroup
	numGoroutines := 100
	errors := make(chan error, numGoroutines)

	// Simulate 100 concurrent HTTP requests all trying to load tools
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := LoadTools()
			if err != nil {
				errors <- err
			}
		}()
	}

	wg.Wait()
	close(errors)

	// Check no errors occurred
	for err := range errors {
		t.Errorf("LoadTools() failed in concurrent execution: %v", err)
	}

	// Verify tools were loaded
	assert.Greater(t, len(DefaultToolHandlers), 0, "Tools should be loaded after concurrent calls")
}

func TestLoadTools_Idempotent(t *testing.T) {
	// First call
	err1 := LoadTools()
	require.NoError(t, err1)
	count1 := len(DefaultToolHandlers)

	// Second call should return same result
	err2 := LoadTools()
	require.NoError(t, err2)
	count2 := len(DefaultToolHandlers)

	assert.Equal(t, count1, count2, "Multiple calls to LoadTools() should return same number of tools")
	assert.Greater(t, count1, 0, "Should have loaded tools")
}

func TestLoadTools_ThreadSafety(t *testing.T) {
	// This test should be run with: go test -race
	// It verifies that concurrent LoadTools() calls and concurrent map reads don't cause data races.
	var wg sync.WaitGroup
	errCh := make(chan error, 50)

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errCh <- LoadTools()
			_ = len(DefaultToolHandlers) // Concurrent read after load
		}()
	}

	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}
}

func TestToolDef_Call_UnknownTool(t *testing.T) {
	tool := ToolDef{
		Name:        "unknown_tool",
		Description: "Unknown tool for testing",
	}

	result, code := tool.Call(nil, nil)

	assert.Nil(t, result, "Unknown tool should return nil")
	assert.Equal(t, 404, code, "Unknown tool should return 404")
}

// ========================================================================
// get_pod_performance Schema Verification Tests
// ========================================================================

func TestPodPerformanceSchema_ToolDefinitionLoads(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool, ok := DefaultToolHandlers["get_pod_performance"]
	require.True(t, ok, "get_pod_performance should be registered in DefaultToolHandlers")
	assert.Equal(t, "get_pod_performance", tool.GetName())
	assert.NotEmpty(t, tool.GetDescription())
}

func TestPodPerformanceSchema_RequiredFields(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_pod_performance"]
	schema := tool.GetDefinition()

	required, ok := schema["required"].([]interface{})
	require.True(t, ok, "schema should have a 'required' field")
	assert.Contains(t, required, "namespace", "namespace should be required")
}

func TestPodPerformanceSchema_AnyOfConstraint(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_pod_performance"]
	schema := tool.GetDefinition()

	anyOf, ok := schema["anyOf"].([]interface{})
	require.True(t, ok, "schema should have an 'anyOf' field for podName/workloadName")
	assert.Len(t, anyOf, 2, "anyOf should have exactly 2 entries (podName, workloadName)")

	var requiredFields []string
	for _, entry := range anyOf {
		m, mOk := entry.(map[string]interface{})
		require.True(t, mOk)
		req, rOk := m["required"].([]interface{})
		require.True(t, rOk)
		for _, r := range req {
			requiredFields = append(requiredFields, r.(string))
		}
	}
	assert.Contains(t, requiredFields, "podName")
	assert.Contains(t, requiredFields, "workloadName")
}

func TestPodPerformanceSchema_PropertiesIncludeExpectedFields(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_pod_performance"]
	schema := tool.GetDefinition()

	props, ok := schema["properties"].(map[string]interface{})
	require.True(t, ok, "schema should have a 'properties' field")

	expectedFields := []string{"namespace", "podName", "workloadName", "timeRange", "queryTime", "clusterName"}
	for _, field := range expectedFields {
		_, exists := props[field]
		assert.True(t, exists, "schema should contain property %q", field)
	}
}

func TestPodPerformanceSchema_MCPToolsetRegistered(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	_, inMCP := MCPToolHandlers["get_pod_performance"]
	assert.True(t, inMCP, "get_pod_performance should be in MCPToolHandlers")

	_, inDefault := DefaultToolHandlers["get_pod_performance"]
	assert.True(t, inDefault, "get_pod_performance should be in DefaultToolHandlers")
}

// ========================================================================
// get_mesh_traffic_graph Schema Verification Tests
// ========================================================================

func TestMeshGraphSchema_ToolDefinitionLoads(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool, ok := DefaultToolHandlers["get_mesh_traffic_graph"]
	require.True(t, ok, "get_mesh_traffic_graph should be registered in DefaultToolHandlers")
	assert.Equal(t, "get_mesh_traffic_graph", tool.GetName())
	assert.NotEmpty(t, tool.GetDescription())
}

func TestMeshGraphSchema_RequiredFields(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_mesh_traffic_graph"]
	schema := tool.GetDefinition()

	required, ok := schema["required"].([]interface{})
	require.True(t, ok, "schema should have a 'required' field")
	assert.Contains(t, required, "namespaces", "namespaces should be required")
}

func TestMeshGraphSchema_PropertiesIncludeExpectedFields(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_mesh_traffic_graph"]
	schema := tool.GetDefinition()

	props, ok := schema["properties"].(map[string]interface{})
	require.True(t, ok, "schema should have a 'properties' field")

	expectedFields := []string{"namespaces", "graphType", "clusterName"}
	for _, field := range expectedFields {
		_, exists := props[field]
		assert.True(t, exists, "schema should contain property %q", field)
	}
}

func TestMeshGraphSchema_GraphTypeEnum(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	tool := DefaultToolHandlers["get_mesh_traffic_graph"]
	schema := tool.GetDefinition()

	props := schema["properties"].(map[string]interface{})
	graphTypeProp := props["graphType"].(map[string]interface{})
	enumRaw, ok := graphTypeProp["enum"].([]interface{})
	require.True(t, ok, "graphType should have an enum constraint")

	enumValues := make([]string, len(enumRaw))
	for i, v := range enumRaw {
		enumValues[i] = v.(string)
	}

	assert.Contains(t, enumValues, "versionedApp")
	assert.Contains(t, enumValues, "app")
	assert.Contains(t, enumValues, "service")
	assert.Contains(t, enumValues, "workload")
	assert.Len(t, enumValues, 4, "graphType enum should have exactly 4 values")
}

func TestMeshGraphSchema_MCPToolsetRegistered(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)

	_, inMCP := MCPToolHandlers["get_mesh_traffic_graph"]
	assert.True(t, inMCP, "get_mesh_traffic_graph should be in MCPToolHandlers")

	_, inDefault := DefaultToolHandlers["get_mesh_traffic_graph"]
	assert.True(t, inDefault, "get_mesh_traffic_graph should be in DefaultToolHandlers")
}
