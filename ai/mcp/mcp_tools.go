package mcp

import (
	"embed"
	"fmt"
	"io/fs"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_logs"
	"github.com/kiali/kiali/ai/mcp/get_mesh_status"
	"github.com/kiali/kiali/ai/mcp/get_mesh_traffic_graph"
	"github.com/kiali/kiali/ai/mcp/get_metrics"
	"github.com/kiali/kiali/ai/mcp/get_pod_performance"
	"github.com/kiali/kiali/ai/mcp/get_referenced_docs"
	"github.com/kiali/kiali/ai/mcp/get_trace_details"
	"github.com/kiali/kiali/ai/mcp/list_or_get_resources"
	"github.com/kiali/kiali/ai/mcp/list_traces"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config_read"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/log"
)

//go:embed tools
var toolsFS embed.FS

var (
	// MCPToolHandlers contains tools with toolset including "mcp" (full MCP).
	MCPToolHandlers = map[string]ToolDef{}
	// DefaultToolHandlers contains tools with toolset including "default" (chatbot UI; also used for POST /api/chat/mcp when HeaderKialiUI is set).
	// The two sets are independent; a tool can be in one or both via the toolset field in its YAML.
	DefaultToolHandlers = map[string]ToolDef{}
)

var ExcludedToolNames = map[string]bool{
	"get_referenced_docs": true,
	"get_action_ui":       true,
}

// TraceToolNames are MCP tools that call the mesh tracing backend (Jaeger/Tempo).
// They must not be offered or executed when external_services.tracing.enabled is false.
var TraceToolNames = map[string]struct{}{
	"list_traces":       {},
	"get_trace_details": {},
}

func IsTraceTool(name string) bool {
	_, ok := TraceToolNames[name]
	return ok
}

var (
	loadToolsOnce sync.Once
	loadToolsErr  error
)

func LoadTools() error {
	loadToolsOnce.Do(func() {
		loadToolsErr = loadToolsImpl()
	})
	return loadToolsErr
}

func loadToolsImpl() error {
	if len(MCPToolHandlers) > 0 || len(DefaultToolHandlers) > 0 {
		return nil
	}
	entries, err := fs.ReadDir(toolsFS, "tools")
	if err != nil {
		return fmt.Errorf("read tools directory: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
			continue
		}
		contents, err := fs.ReadFile(toolsFS, "tools/"+name)
		if err != nil {
			return fmt.Errorf("read tool definition %s: %w", name, err)
		}
		definition, err := loadToolDefinitionFromContent(contents, name)
		if err != nil {
			return fmt.Errorf("load tool definition %s: %w", name, err)
		}
		for _, set := range definition.Toolset {
			switch set {
			case "mcp":
				MCPToolHandlers[definition.Name] = definition
			case "default":
				DefaultToolHandlers[definition.Name] = definition
			}
		}
	}
	mcpNames := slices.Collect(maps.Keys(MCPToolHandlers))
	slices.Sort(mcpNames)
	log.Infof("[AI]Loaded %d MCP tools: %s", len(mcpNames), strings.Join(mcpNames, ", "))
	defaultNames := slices.Collect(maps.Keys(DefaultToolHandlers))
	slices.Sort(defaultNames)
	log.Infof("[AI]Default (chatbot) toolset: %d tools: %s", len(defaultNames), strings.Join(defaultNames, ", "))

	return nil
}

func loadToolDefinitionFromContent(contents []byte, name string) (ToolDef, error) {
	var list []ToolDef
	if err := yaml.Unmarshal(contents, &list); err == nil && len(list) > 0 {
		if len(list) > 1 {
			return ToolDef{}, fmt.Errorf("tool definition file %s contains multiple tools", name)
		}
		return list[0], nil
	}
	var tool ToolDef
	if err := yaml.Unmarshal(contents, &tool); err != nil {
		return ToolDef{}, fmt.Errorf("unmarshal tool definition %s: %w", name, err)
	}
	if tool.Name == "" {
		return ToolDef{}, fmt.Errorf("tool definition file %s is empty", name)
	}
	return tool, nil
}

func LoadToolDefinition(filename string) (ToolDef, error) {
	contents, err := os.ReadFile(filename)
	if err != nil {
		return ToolDef{}, fmt.Errorf("read tool definition file %s: %w", filename, err)
	}
	return loadToolDefinitionFromContent(contents, filepath.Base(filename))
}

func (t ToolDef) GetName() string {
	return t.Name
}

func (t ToolDef) GetDescription() string {
	return t.Description
}

func (t ToolDef) GetDefinition() map[string]interface{} {
	return t.InputSchema
}

func (t ToolDef) Call(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	switch t.Name {
	case "get_mesh_traffic_graph":
		return get_mesh_traffic_graph.Execute(kialiInterface, args)
	case "list_or_get_resources":
		return list_or_get_resources.Execute(kialiInterface, args)
	case "get_mesh_status":
		return get_mesh_status.Execute(kialiInterface, args)
	case "list_traces":
		return list_traces.Execute(kialiInterface, args)
	case "get_trace_details":
		return get_trace_details.Execute(kialiInterface, args)
	case "get_logs":
		return get_logs.Execute(kialiInterface, args)
	case "get_pod_performance":
		return get_pod_performance.Execute(kialiInterface, args)
	case "manage_istio_config":
		return manage_istio_config.Execute(kialiInterface, args)
	case "manage_istio_config_read":
		return manage_istio_config_read.Execute(kialiInterface, args)
	case "get_action_ui":
		return get_action_ui.Execute(kialiInterface, args)
	case "get_referenced_docs":
		return get_referenced_docs.Execute(kialiInterface, args)
	case "get_metrics":
		return get_metrics.Execute(kialiInterface, args)
	default:
		return nil, http.StatusNotFound
	}
}
