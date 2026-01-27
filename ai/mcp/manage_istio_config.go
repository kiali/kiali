package mcp

import (
	"net/http"

	openai "github.com/openai/openai-go/v3"

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

func (t ManageIstioConfigTool) Definition() openai.ChatCompletionToolUnionParam {
	parameters := openai.FunctionParameters{
		"type": "object",
		"properties": map[string]interface{}{
			"action": map[string]interface{}{
				"type":        "string",
				"description": "Action to perform",
				"enum":        []string{"list", "get", "create", "patch", "delete"},
			},
			"confirmed": map[string]interface{}{
				"type":        "boolean",
				"description": "CRITICAL: For 'create', 'patch', or 'delete' actions. If 'true', the destructive action (create/patch/delete) is executed. If 'false' (or omitted) for create/patch, the tool will return a YAML PREVIEW of the object. You should display this YAML to the user and ask for confirmation before calling this tool again with confirmed=true.",
			},
			"cluster": map[string]interface{}{
				"type":        "string",
				"description": "Cluster containing the Istio object, if not provided, will use the cluster name in the Kiali configuration (KubeConfig)",
			},
			"namespace": map[string]interface{}{
				"type":        "string",
				"description": "Namespace containing the Istio object, if not provided, will return all istio objects across all namespaces in the cluster",
			},
			"group": map[string]interface{}{
				"type":        "string",
				"description": "API group of the Istio object (e.g., 'networking.istio.io', 'gateway.networking.k8s.io'). Required for create, patch, and get actions.",
			},
			"version": map[string]interface{}{
				"type":        "string",
				"description": "API version. IMPORTANT: Use 'v1' for VirtualService, DestinationRule, and Gateway. Do NOT use 'v1alpha3'.. Required for create, patch, and get actions.",
			},
			"kind": map[string]interface{}{
				"type":        "string",
				"description": "Kind of the Istio object (e.g., 'VirtualService', 'DestinationRule'). Required for create, patch, and get actions.",
			},
			"object": map[string]interface{}{
				"type":        "string",
				"description": "Name of the Istio object. Required for patch,get,create and delete actions.",
			},
			"json_data": map[string]interface{}{
				"type":        "string",
				"description": "JSON data to apply or create the object. Required for create and patch actions.",
			},
		},
	}
	return openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        ManageIstioConfigToolName,
				Description: openai.String("Manage Istio Config. 1. Always use 'confirmed: false' first to preview YAML. 2. You must create the necessary objects (VirtualService, DestinationRule, etc.) for the desired configuration. Example: If creating traffic splitting, you MUST create both a VirtualService AND a DestinationRule."),
				Parameters:  parameters,
			},
		},
	}
}

func (t ManageIstioConfigTool) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return manage_istio_config.Execute(r, args, business, conf)
}
