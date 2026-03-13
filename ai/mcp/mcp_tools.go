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
	"github.com/kiali/kiali/ai/mcp/get_citations"
	"github.com/kiali/kiali/ai/mcp/get_logs"
	"github.com/kiali/kiali/ai/mcp/get_mesh_graph"
	"github.com/kiali/kiali/ai/mcp/get_pod_performance"
	"github.com/kiali/kiali/ai/mcp/get_resource_detail"
	"github.com/kiali/kiali/ai/mcp/get_traces"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

//go:embed tools
var toolsFS embed.FS

var (
	// MCPToolHandlers contains tools with toolset including "mcp" (full MCP).
	MCPToolHandlers = map[string]ToolDef{}
	// DefaultToolHandlers contains tools with toolset including "default" (chatbot UI when header kiali_chatbot is set).
	// The two sets are independent; a tool can be in one or both via the toolset field in its YAML.
	DefaultToolHandlers = map[string]ToolDef{}
)

var ExcludedToolNames = map[string]bool{
	"get_citations": true,
	"get_action_ui": true,
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

func (t ToolDef) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	switch t.Name {
	case "get_mesh_graph":
		return get_mesh_graph.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
	case "get_resource_detail":
		return get_resource_detail.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
	case "get_traces":
		return get_traces.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
	case "get_logs":
		return get_logs.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
	case "get_pod_performance":
		return get_pod_performance.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
	case "manage_istio_config":
		return manage_istio_config.Execute(r, args, business, conf)
	case "get_action_ui":
		return get_action_ui.Execute(r, args, business, conf)
	case "get_citations":
		return get_citations.Execute(r, args, business, conf)
	default:
		return nil, http.StatusNotFound
	}
}
