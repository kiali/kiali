package mcp

import (
	"net/http"

	openai "github.com/sashabaranov/go-openai"
	"github.com/sashabaranov/go-openai/jsonschema"

	"github.com/kiali/kiali/ai/mcp/get_resource_detail"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const GetResourceDetailToolName string = "get_resource_detail"

// MeshGraphTool implements the ToolHandler for fetching mesh graph data.
type ResourceDetailTool struct {
	name string
}

func NewResourceDetailTool() ResourceDetailTool {
	return ResourceDetailTool{name: GetResourceDetailToolName}
}

func (t ResourceDetailTool) Definition() openai.Tool {
	parameters := jsonschema.Definition{
		Type: jsonschema.Object,
		Properties: map[string]jsonschema.Definition{
			"resource_type": {
				Type:        jsonschema.String,
				Description: "Type of resource to get list/details",
				Enum:        []string{"service", "workload", "app", "istio"},
			},
			"namespaces": {
				Type:        jsonschema.String,
				Description: "Comma-separated list of namespaces to get services from (e.g. 'bookinfo' or 'bookinfo,default'). If not provided, will list services from all accessible namespaces",
			},
			"resource_name": {
				Type:        jsonschema.String,
				Description: "Name of the resource to get details for (optional string - if provided, gets details; if empty, lists all).",
			},
			"cluster_name": {
				Type:        jsonschema.String,
				Description: "Name of the cluster to get resources from. If not provided, will use the cluster name in the Kiali configuration (KubeConfig).",
			},
		},
	}
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        GetResourceDetailToolName,
			Description: "Gets lists or detailed info for Kubernetes resources (services, workloads) within the mesh",
			Parameters:  parameters,
		},
	}
}

func (t ResourceDetailTool) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return get_resource_detail.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
}
