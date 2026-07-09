package mcp_tools

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
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

// tracingEnabledFromKialiAPI reports whether Kiali has mesh tracing integration enabled
// (same flag as external_services.tracing.enabled), via GET /api/tracing.
func tracingEnabledFromKialiAPI(t *testing.T) bool {
	t.Helper()
	base := strings.TrimRight(os.Getenv("URL"), "/")
	req, err := http.NewRequest(http.MethodGet, base+"/api/tracing", nil)
	require.NoError(t, err)
	httpResp, err := mcpClient.httpClient.Do(req)
	require.NoError(t, err)
	defer httpResp.Body.Close()
	body, err := io.ReadAll(httpResp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, httpResp.StatusCode, "GET /api/tracing: %s", string(body))
	var info struct {
		Enabled bool `json:"enabled"`
	}
	require.NoError(t, json.Unmarshal(body, &info))
	return info.Enabled
}

// TestAllMCPEndpointsExist verifies that the /api/chat/mcp/<tool> endpoint
// returns something other than 404 for every registered tool.
// Trace MCP tools (list_traces, get_trace_details) return 404 when tracing is disabled in Kiali config.
func TestAllMCPEndpointsExist(t *testing.T) {
	tracingOn := tracingEnabledFromKialiAPI(t)

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
			if mcp.IsTraceTool(toolName) {
				if tracingOn {
					assert.NotEqual(t, 404, resp.StatusCode,
						"Trace tool /api/chat/mcp/%s should be registered when tracing is enabled", toolName)
				} else {
					assert.Equal(t, 404, resp.StatusCode,
						"Trace tool /api/chat/mcp/%s should return 404 when tracing is disabled", toolName)
				}
				return
			}
			if mcp.IsAmbientTool(toolName) {
				// Ambient-specific tools return 404 when Ambient Mesh is not enabled in any cluster.
				// A 400 means Ambient is enabled but required args are missing — the tool is reachable.
				assert.NotEqual(t, 500, resp.StatusCode,
					"Ambient tool /api/chat/mcp/%s returned an unexpected server error", toolName)
				return
			}
			assert.NotEqual(t, 404, resp.StatusCode,
				"Tool endpoint /api/chat/mcp/%s returned 404 — not registered", toolName)
		})
	}
}

// KubernetesMCPServerEndpoints lists the tool names that containers/kubernetes-mcp-server
// delegates to Kiali via POST /api/chat/mcp/<tool>. Keep in sync with
// https://github.com/containers/kubernetes-mcp-server/blob/main/pkg/toolsets/kiali/tools/endpoints.go
var KubernetesMCPServerEndpoints = []string{
	"get_mesh_traffic_graph",
	"get_mesh_status",
	"get_metrics",
	"list_or_get_resources",
	"list_traces",
	"get_trace_details",
	"get_logs",
	"manage_istio_config",
	"manage_istio_config_read",
	"get_pod_performance",
}

// TestKubernetesMCPServerEndpointsCovered verifies that every tool endpoint used by
// containers/kubernetes-mcp-server has a matching YAML tool definition in Kiali.
// If kubernetes-mcp-server adds a new endpoint, this test will fail until the
// corresponding tool is added in ai/mcp/tools/.
func TestKubernetesMCPServerEndpointsCovered(t *testing.T) {
	toolsDir := filepath.Join("..", "..", "..", "ai", "mcp", "tools")
	entries, err := os.ReadDir(toolsDir)
	require.NoError(t, err)

	kialiTools := make(map[string]bool)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") {
			toolName := strings.TrimSuffix(strings.TrimSuffix(name, ".yaml"), ".yml")
			kialiTools[toolName] = true
		}
	}

	for _, endpoint := range KubernetesMCPServerEndpoints {
		t.Run(endpoint, func(t *testing.T) {
			assert.True(t, kialiTools[endpoint],
				"kubernetes-mcp-server uses endpoint /api/chat/mcp/%s but no matching tool definition found in ai/mcp/tools/", endpoint)
		})
	}
}
