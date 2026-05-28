package providers

import (
	"sort"
	"strings"
	"sync"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var loggedFilteredToolSets sync.Map

func FilteredDefaultTools(conf *config.Config, providerName string) []mcp.ToolDef {
	names := FilteredDefaultToolNames(conf, providerName)
	tools := make([]mcp.ToolDef, 0, len(names))
	for _, name := range names {
		tools = append(tools, mcp.DefaultToolHandlers[name])
	}
	return tools
}

func FilteredDefaultToolNames(conf *config.Config, providerName string) []string {
	names := make([]string, 0, len(mcp.DefaultToolHandlers))
	for name := range mcp.DefaultToolHandlers {
		if IsDefaultToolExposed(conf, providerName, name) {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	return names
}

func LookupFilteredDefaultTool(conf *config.Config, providerName string, toolName string) (mcp.ToolDef, bool) {
	tool, ok := mcp.DefaultToolHandlers[toolName]
	if !ok {
		return mcp.ToolDef{}, false
	}
	if !IsDefaultToolExposed(conf, providerName, toolName) {
		return mcp.ToolDef{}, false
	}
	return tool, true
}

func IsDefaultToolExposed(conf *config.Config, providerName string, toolName string) bool {
	if _, ok := mcp.DefaultToolHandlers[toolName]; !ok {
		return false
	}
	if conf == nil {
		return true
	}

	if !conf.ExternalServices.Tracing.Enabled && mcp.IsTraceTool(toolName) {
		return false
	}
	if !conf.ExternalServices.Prometheus.Enabled && mcp.IsMetricTool(toolName) {
		return false
	}
	if !toolAllowedByFilter(toolName, conf.ChatAI.Tools) {
		return false
	}

	providerFilter, ok := providerToolFilter(conf, providerName)
	if ok && !toolAllowedByFilter(toolName, providerFilter) {
		return false
	}

	return true
}

func LogFilteredDefaultTools(displayName string, conf *config.Config, providerName string) {
	names := FilteredDefaultToolNames(conf, providerName)
	joined := strings.Join(names, ", ")
	if joined == "" {
		joined = "<none>"
	}

	cacheKey := displayName + "|" + providerName + "|" + joined
	if _, loaded := loggedFilteredToolSets.LoadOrStore(cacheKey, struct{}{}); loaded {
		return
	}

	log.Infof("[Chat AI][%s][Tools] Exposed tools after filtering (provider=%q): %d tools: %s",
		displayName, providerName, len(names), joined)
}

func toolAllowedByFilter(toolName string, filter config.ToolFilterConfig) bool {
	if len(filter.Include) > 0 {
		allowed := false
		for _, included := range filter.Include {
			if included == toolName {
				allowed = true
				break
			}
		}
		if !allowed {
			return false
		}
	}

	for _, excluded := range filter.Exclude {
		if excluded == toolName {
			return false
		}
	}

	return true
}

func providerToolFilter(conf *config.Config, providerName string) (config.ToolFilterConfig, bool) {
	if conf == nil || providerName == "" {
		return config.ToolFilterConfig{}, false
	}
	for _, provider := range conf.ChatAI.Providers {
		if provider.Name == providerName {
			return provider.Tools, true
		}
	}
	return config.ToolFilterConfig{}, false
}
