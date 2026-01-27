package mcp

import (
	"net/http"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

var DefaultToolHandlers = []ToolHandler{
	NewMeshGraphTool(),
	NewResourceDetailTool(),
	NewManageIstioConfigTool(),
	NewActionUITool(),
	NewCitationsTool(),
}

// ToolHandler defines the contract for a tool: its definition and how to execute it.
type ToolHandler interface {
	Definition() openai.ChatCompletionToolUnionParam
	Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int)
}
