package mcp

import (
	"net/http"

	openai "github.com/sashabaranov/go-openai"
	"github.com/sashabaranov/go-openai/jsonschema"

	"github.com/kiali/kiali/ai/mcp/get_citations"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const GetCitationsToolName string = "get_citations"

// MeshGraphTool implements the ToolHandler for fetching mesh graph data.
type CitationsTool struct {
	name string
}

func NewCitationsTool() CitationsTool {
	return CitationsTool{name: GetCitationsToolName}
}

func (t CitationsTool) Definition() openai.Tool {
	parameters := jsonschema.Definition{
		Type: jsonschema.Object,
		Properties: map[string]jsonschema.Definition{
			"keywords": {
				Type:        jsonschema.String,
				Description: "Comma-separated list of keywords to search for in the documents",
			},
			"domain": {
				Type:        jsonschema.String,
				Description: "Optional. Domain to search for the documents. Possible values: kiali, istio. If not provided, will search in all domains.",
				Enum:        []string{"kiali", "istio", "all", ""},
			},
		},
	}
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        GetCitationsToolName,
			Description: "Returns the links to a documentation page related with a list of keywords related with the user query. The keywords are comma-separated.",
			Parameters:  parameters,
		},
	}
}

func (t CitationsTool) Call(r *http.Request, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	return get_citations.Execute(r, args, business, conf)
}
