package mcp

import (
	"context"

	openai "github.com/sashabaranov/go-openai"
	"github.com/sashabaranov/go-openai/jsonschema"

	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const ManageIstioConfigToolName string = "manage_istio_config"

// MeshGraphTool implements the ToolHandler for fetching mesh graph data.
type ManageIstioConfigTool struct {
	name string
}

func NewManageIstioConfigTool() ManageIstioConfigTool {
	return ManageIstioConfigTool{name: ManageIstioConfigToolName}
}

func (t ManageIstioConfigTool) Definition() openai.Tool {
	parameters := jsonschema.Definition{
		Type: jsonschema.Object,
		Properties: map[string]jsonschema.Definition{
			"action": {
				Type:        jsonschema.String,
				Description: "Action to perform: list, get, create, patch, or delete",
			},
			"cluster": {
				Type:        jsonschema.String,
				Description: "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
			},
			"namespace": {
				Type:        jsonschema.String,
				Description: "Namespace containing the Istio object, if not provided, will return all istio objects across all namespaces in the cluster",
			},
			"group": {
				Type:        jsonschema.String,
				Description: "API group of the Istio object (e.g., 'networking.istio.io', 'gateway.networking.k8s.io'). Required for create, patch, and get actions.",
			},
			"version": {
				Type:        jsonschema.String,
				Description: "API version of the Istio object (e.g., 'v1alpha3', 'v1beta1'). Required for create, patch, and get actions.",
			},
			"kind": {
				Type:        jsonschema.String,
				Description: "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule'). Required for create, patch, and get actions.",
			},
			"object": {
				Type:        jsonschema.String,
				Description: "Name of the Istio object. Required for patch and delete actions.",
			},
			"json_data": {
				Type:        jsonschema.String,
				Description: "JSON data to apply or create the object. Required for create and patch actions.",
			},
		},
	}
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        ManageIstioConfigToolName,
			Description: "Manage Istio Objects Config: List, Get, Create, Patch, Delete",
			Parameters:  parameters,
		},
	}
}

func (t ManageIstioConfigTool) Call(ctx context.Context, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return manage_istio_config.Execute(ctx, args, business, conf)
}
