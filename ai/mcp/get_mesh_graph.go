package mcp

import (
	"net/http"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcp/get_mesh_graph"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const GetMeshGraphToolName string = "get_mesh_graph"

// MeshGraphTool implements the ToolHandler for fetching mesh graph data.
type MeshGraphTool struct {
	name string
}

func NewMeshGraphTool() MeshGraphTool {
	return MeshGraphTool{name: GetMeshGraphToolName}
}

func (t MeshGraphTool) Definition() openai.ChatCompletionToolUnionParam {
	parameters := openai.FunctionParameters{
		"type": "object",
		"properties": map[string]interface{}{
			"namespace": map[string]interface{}{
				"type":        "string",
				"description": "Optional single namespace to include in the graph (alternative to namespaces)",
			},
			"namespaces": map[string]interface{}{
				"type":        "string",
				"description": "Optional comma-separated list of namespaces to include in the graph",
			},
			"rateInterval": map[string]interface{}{
				"type":        "string",
				"description": "Optional rate interval for fetching (e.g., '10m', '5m', '1h'). Default is '10m'.",
			},
			"graphType": map[string]interface{}{
				"type":        "string",
				"description": "Optional type of graph to return. Default is 'versionedApp'.",
				"enum":        []string{"versionedApp", "app", "service", "workload"},
			},
			"clusterName": map[string]interface{}{
				"type":        "string",
				"description": "Optional cluster name to include in the graph. Default is the cluster name in the Kiali configuration (KubeConfig).",
			},
		},
	}
	return openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        GetMeshGraphToolName,
				Description: openai.String("Returns the topology of a specific namespaces, health, status of the mesh and namespaces. Includes a mesh health summary overview with aggregated counts of healthy, degraded, and failing apps, workloads, and services. Use this for high-level overviews"),
				Parameters:  parameters,
			},
		},
	}
}

func (t MeshGraphTool) Call(r *http.Request, args map[string]interface{}, business *business.Layer,
	prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return get_mesh_graph.Execute(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
}
