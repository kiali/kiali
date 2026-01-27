package mcp

import (
	"net/http"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const GetActionUIToolName string = "get_action_ui"

// MeshGraphTool implements the ToolHandler for fetching mesh graph data.
type ActionUITool struct {
	name string
}

func NewActionUITool() ActionUITool {
	return ActionUITool{name: GetActionUIToolName}
}

func (t ActionUITool) Definition() openai.ChatCompletionToolUnionParam {
	parameters := openai.FunctionParameters{
		"type": "object",
		"properties": map[string]interface{}{
			"namespaces": map[string]interface{}{
				"type":        "string",
				"description": "Comma-separated list of namespaces in case of list/show resources or graph, just one namespace in case of get or show resource. If empty, will use all namespaces accessible to the user.",
			},
			"resourceType": map[string]interface{}{
				"type":        "string",
				"description": "Type of resource to get a view of : list resources,details of a resource, traffic/mesh graph or overview of namespaces",
				"enum":        []string{"service", "workload", "app", "istio", "graph", "overview"},
			},
			"resourceName": map[string]interface{}{
				"type":        "string",
				"description": "Optional. Name of the resource to get details for (optional string - if provided, gets details; if empty, lists all).",
			},
			"graph": map[string]interface{}{
				"type":        "string",
				"description": "Optional. If resourceType is graph, you can specify the type of graph to return: Mesh if user request mesh or traffic graph (Values: mesh|traffic). Mesh graph no required namespaces parameter, traffic graph have an optional namespaces parameter. Default graph is traffic",
				"enum":        []string{"mesh", "traffic"},
			},
			"graphType": map[string]interface{}{
				"type":        "string",
				"description": "Optional type of graph to return. Default is 'versionedApp'.",
				"enum":        []string{"versionedApp", "app", "service", "workload"},
			},
			"tab": map[string]interface{}{
				"type":        "string",
				"description": "Optional. Tab to open in case of show resource details. Default is info.",
				"enum":        []string{"info", "logs", "metrics", "in_metrics", "out_metrics", "traffic", "traces", "envoy"},
			},
		},
		"required": []string{"resourceType"},
	}
	return openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        GetActionUIToolName,
				Description: openai.String("Returns the action to navigate in the Kiali UI when user request see graph or mesh graph,list/get/show resources or a detailed resource information"),
				Parameters:  parameters,
			},
		},
	}
}

func (t ActionUITool) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return get_action_ui.Execute(r, args, business, conf)
}
