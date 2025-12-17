package mcp

import (
	"net/http"

	openai "github.com/sashabaranov/go-openai"
	"github.com/sashabaranov/go-openai/jsonschema"

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

func (t ActionUITool) Definition() openai.Tool {
	parameters := jsonschema.Definition{
		Type: jsonschema.Object,
		Properties: map[string]jsonschema.Definition{
			"namespaces": {
				Type:        jsonschema.String,
				Description: "Comma-separated list of namespaces in case of list/show resources or graph, just one namespace in case of get or show resource. If empty, will use all namespaces accessible to the user.",
			},
			"resourceType": {
				Type:        jsonschema.String,
				Description: "Type of resource to get a view of : list resources,details of a resource, traffic/mesh graph or overview of namespaces",
				Enum:        []string{"service", "workload", "app", "istio", "graph", "overview"},
			},
			"resourceName": {
				Type:        jsonschema.String,
				Description: "Optional. Name of the resource to get details for (optional string - if provided, gets details; if empty, lists all).",
			},
			"graph": {
				Type:        jsonschema.String,
				Description: "Optional. Mesh if user request mesh or traffic graph (Values: mesh|graph) if user request traffic graph of a namespace or list of namespaces. Default graph is traffic",
				Enum:        []string{"mesh", "traffic"},
			},
			"graphType": {
				Type:        jsonschema.String,
				Description: "Optional type of graph to return. Default is 'versionedApp'.",
				Enum:        []string{"versionedApp", "app", "service", "workload"},
			},
			"tab": {
				Type:        jsonschema.String,
				Description: "Optional. Tab to open in case of show resource details. Default is info.",
				Enum:        []string{"info", "logs", "metrics", "in_metrics", "out_metrics", "traffic", "traces", "envoy"},
			},
		},
		Required: []string{"resourceType"},
	}
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        GetActionUIToolName,
			Description: "Returns the action to navigate in the Kiali UI when user request see graph or mesh graph,list/get/show resources or a detailed resource information",
			Parameters:  parameters,
		},
	}
}

func (t ActionUITool) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return get_action_ui.Execute(r, args, business, conf)
}
