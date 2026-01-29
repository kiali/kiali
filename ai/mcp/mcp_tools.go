package mcp

import (
	"fmt"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_citations"
	"github.com/kiali/kiali/ai/mcp/get_mesh_graph"
	"github.com/kiali/kiali/ai/mcp/get_resource_detail"
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

var DefaultToolHandlers = map[string]ToolDef{}

var ExcludedToolNames = map[string]bool{
	"get_citations": true,
	"get_action_ui": true,
}

func LoadTools() error {
	toolsDir := filepath.Join("ai", "mcp", "tools")
	entries, err := os.ReadDir(toolsDir)
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

		definition, err := LoadToolDefinition(filepath.Join(toolsDir, name))
		if err != nil {
			return fmt.Errorf("load tool definition %s: %w", name, err)
		}
		DefaultToolHandlers[definition.Name] = definition
	}
	names := slices.Collect(maps.Keys(DefaultToolHandlers))
	slices.Sort(names)
	log.Infof("[AI]Loaded %d tools: %s", len(names), strings.Join(names, ", "))

	return nil
}

// LoadTools reads the YAML file
func LoadToolDefinition(filename string) (ToolDef, error) {
	contents, err := os.ReadFile(filename)
	if err != nil {
		return ToolDef{}, fmt.Errorf("read tool definition file %s: %w", filename, err)
	}

	var list []ToolDef
	if err := yaml.Unmarshal(contents, &list); err == nil && len(list) > 0 {
		if len(list) > 1 {
			return ToolDef{}, fmt.Errorf("tool definition file %s contains multiple tools", filename)
		}
		return list[0], nil
	}

	var tool ToolDef
	if err := yaml.Unmarshal(contents, &tool); err != nil {
		return ToolDef{}, fmt.Errorf("unmarshal tool definition %s: %w", filename, err)
	}
	if tool.Name == "" {
		return ToolDef{}, fmt.Errorf("tool definition file %s is empty", filename)
	}
	return tool, nil
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
