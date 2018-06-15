// Cytoscape package provides conversion from our graph to the CystoscapeJS
// configuration json model.
//
// The following links are useful for understanding CytoscapeJS and it's configuration:
//
// Main page:   http://js.cytoscape.org/
// JSON config: http://js.cytoscape.org/#notation/elements-json
// Demos:       http://js.cytoscape.org/#demos
//
// Algorithm: Process the graph structure adding nodes and edges, decorating each
//            with information provided.  An optional second pass generates compound
//            nodes for for versioned services.
//
package cytoscape

import (
	"crypto/md5"
	"fmt"
	"sort"
	"strconv"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/services/models"
)

type NodeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`               // unique internal node ID (n0, n1...)
	Parent string `json:"parent,omitempty"` // Compound Node parent ID

	// App Fields (not required by Cytoscape)
	Service      string         `json:"service"`
	Version      string         `json:"version,omitempty"`
	Rate         string         `json:"rate,omitempty"`         // edge aggregate
	Rate3xx      string         `json:"rate3XX,omitempty"`      // edge aggregate
	Rate4xx      string         `json:"rate4XX,omitempty"`      // edge aggregate
	Rate5xx      string         `json:"rate5XX,omitempty"`      // edge aggregate
	RateOut      string         `json:"rateOut,omitempty"`      // edge aggregate
	HasCB        bool           `json:"hasCB,omitempty"`        // true (has circuit breaker) | false
	HasMissingSC bool           `json:"hasMissingSC,omitempty"` // true (has missing sidecar) | false
	HasRR        bool           `json:"hasRR,omitempty"`        // true (has route rule) | false
	Health       *models.Health `json:"health,omitempty"`
	IsDead       bool           `json:"isDead,omitempty"`   // true (has no pods) | false
	IsGroup      string         `json:"isGroup,omitempty"`  // set to the grouping type, current values: [ 'version' ]
	IsRoot       bool           `json:"isRoot,omitempty"`   // true | false
	IsUnused     bool           `json:"isUnused,omitempty"` // true | false
}

type EdgeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`     // unique internal edge ID (e0, e1...)
	Source string `json:"source"` // parent node ID
	Target string `json:"target"` // child node ID

	// App Fields (not required by Cytoscape)
	Rate        string `json:"rate,omitempty"`
	Rate3xx     string `json:"rate3XX,omitempty"`
	Rate4xx     string `json:"rate4XX,omitempty"`
	Rate5xx     string `json:"rate5XX,omitempty"`
	PercentErr  string `json:"percentErr,omitempty"`
	PercentRate string `json:"percentRate,omitempty"` // percent of total parent requests
	Latency     string `json:"latency,omitempty"`
	IsMTLS      bool   `json:"isMTLS,omitempty"`   // true (mutual TLS connection) | false
	IsUnused    bool   `json:"isUnused,omitempty"` // true | false
}

type NodeWrapper struct {
	Data *NodeData `json:"data"`
}

type EdgeWrapper struct {
	Data *EdgeData `json:"data"`
}

type Elements struct {
	Nodes []*NodeWrapper `json:"nodes"`
	Edges []*EdgeWrapper `json:"edges"`
}

type Config struct {
	Timestamp int64    `json:"timestamp"`
	Elements  Elements `json:"elements"`
}

func nodeHash(id string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(id)))
}

func edgeHash(from string, to string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s.%s", from, to))))
}

func NewConfig(trafficMap graph.TrafficMap, o options.VendorOptions) (result Config) {
	nodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	buildConfig(trafficMap, &nodes, &edges, o)

	// Add composite nodes that group together different versions of the same service
	if o.GroupByVersion {
		addCompositeNodes(&nodes)
	}

	// sort nodes and edges for better json presentation (and predictable testing)
	sort.Slice(nodes, func(i, j int) bool {
		switch {
		case nodes[i].Data.Service < nodes[j].Data.Service:
			return true
		case nodes[i].Data.Service > nodes[j].Data.Service:
			return false
		default:
			return nodes[i].Data.Version < nodes[j].Data.Version
		}
	})
	sort.Slice(edges, func(i, j int) bool {
		switch {
		case edges[i].Data.Source < edges[j].Data.Source:
			return true
		case edges[i].Data.Source > edges[j].Data.Source:
			return false
		default:
			return edges[i].Data.Target < edges[j].Data.Target
		}
	})

	elements := Elements{nodes, edges}
	result = Config{
		Timestamp: o.Timestamp,
		Elements:  elements,
	}
	return result
}

func buildConfig(trafficMap graph.TrafficMap, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper, o options.VendorOptions) {
	for id, s := range trafficMap {
		nodeId := nodeHash(id)

		nd := &NodeData{
			Id:      nodeId,
			Service: s.Name,
			Version: s.Version,
		}

		addServiceTelemetry(s, nd)

		// node may be dead (service defined but no pods running)
		if val, ok := s.Metadata["isDead"]; ok {
			nd.IsDead = val.(bool)
		}

		// node may be a root
		if val, ok := s.Metadata["isRoot"]; ok {
			nd.IsRoot = val.(bool)
		}

		// node may be an unused service
		if val, ok := s.Metadata["isUnused"]; ok {
			nd.IsUnused = val.(bool)
		}

		// node may have a circuit breaker
		if val, ok := s.Metadata["hasCB"]; ok {
			nd.HasCB = val.(bool)
		}

		// node may have a route rule
		if val, ok := s.Metadata["hasRR"]; ok {
			nd.HasRR = val.(bool)
		}

		// set sidecars checks, if available
		if val, ok := s.Metadata["hasMissingSC"]; ok {
			nd.HasMissingSC = val.(bool)
		}

		// set health, if available
		if val, ok := s.Metadata["health"]; ok {
			nd.Health = val.(*models.Health)
		}

		nw := NodeWrapper{
			Data: nd,
		}
		*nodes = append(*nodes, &nw)

		for _, e := range s.Edges {
			sourceIdHash := nodeHash(s.ID)
			destIdHash := nodeHash(e.Dest.ID)
			edgeId := edgeHash(sourceIdHash, destIdHash)
			ed := EdgeData{
				Id:     edgeId,
				Source: sourceIdHash,
				Target: destIdHash,
			}
			addEdgeTelemetry(&ed, e, o)

			ew := EdgeWrapper{
				Data: &ed,
			}
			*edges = append(*edges, &ew)
		}
	}
}

func addServiceTelemetry(s *graph.ServiceNode, nd *NodeData) {
	rate := s.Metadata["rate"].(float64)

	if rate > 0.0 {
		nd.Rate = fmt.Sprintf("%.3f", rate)

		rate3xx := s.Metadata["rate3xx"].(float64)
		rate4xx := s.Metadata["rate4xx"].(float64)
		rate5xx := s.Metadata["rate5xx"].(float64)

		if rate3xx > 0.0 {
			nd.Rate3xx = fmt.Sprintf("%.3f", rate3xx)
		}
		if rate4xx > 0.0 {
			nd.Rate4xx = fmt.Sprintf("%.3f", rate4xx)
		}
		if rate5xx > 0.0 {
			nd.Rate5xx = fmt.Sprintf("%.3f", rate5xx)
		}
	}

	rateOut := s.Metadata["rateOut"].(float64)

	if rateOut > 0.0 {
		nd.RateOut = fmt.Sprintf("%.3f", rateOut)
	}
}

func addEdgeTelemetry(ed *EdgeData, e *graph.Edge, o options.VendorOptions) {
	rate := e.Metadata["rate"].(float64)

	if rate > 0.0 {
		rate3xx := e.Metadata["rate3xx"].(float64)
		rate4xx := e.Metadata["rate4xx"].(float64)
		rate5xx := e.Metadata["rate5xx"].(float64)
		rateErr := rate4xx + rate5xx
		percentErr := rateErr / rate * 100.0

		ed.Rate = fmt.Sprintf("%.3f", rate)
		if rate3xx > 0.0 {
			ed.Rate3xx = fmt.Sprintf("%.3f", rate3xx)
		}
		if rate4xx > 0.0 {
			ed.Rate4xx = fmt.Sprintf("%.3f", rate4xx)
		}
		if rate5xx > 0.0 {
			ed.Rate5xx = fmt.Sprintf("%.3f", rate5xx)
		}
		if percentErr > 0.0 {
			ed.PercentErr = fmt.Sprintf("%.3f", percentErr)
		}

		if val, ok := e.Metadata["latency"]; ok {
			latency := val.(float64)
			ed.Latency = fmt.Sprintf("%.3f", latency)
		}

		percentRate := rate / e.Source.Metadata["rateOut"].(float64) * 100.0
		if percentRate < 100.0 {
			ed.PercentRate = fmt.Sprintf("%.3f", percentRate)
		}
	} else {
		if val, ok := e.Source.Metadata["isUnused"]; ok {
			ed.IsUnused = val.(bool)
		}
	}

	if val, ok := e.Metadata["isMTLS"]; ok {
		ed.IsMTLS = val.(bool)
	}
}

func add(current string, val float64) string {
	sum := val
	f, err := strconv.ParseFloat(current, 64)
	if err == nil {
		sum += f
	}
	return fmt.Sprintf("%.3f", sum)
}

// addCompositeNodes generates additional nodes to group multiple versions of the
// same service.
func addCompositeNodes(nodes *[]*NodeWrapper) {
	grouped := make(map[string][]*NodeData)

	for _, nw := range *nodes {
		grouped[nw.Data.Service] = append(grouped[nw.Data.Service], nw.Data)
	}

	for k, v := range grouped {
		if len(v) > 1 {
			// create the composite grouping all versions of the service
			nodeId := nodeHash(k)
			nd := NodeData{
				Id:      nodeId,
				Service: k,
				IsGroup: "version",
			}

			nw := NodeWrapper{
				Data: &nd,
			}

			// assign each service version node to the composite parent
			hasRouteRule := false
			nd.HasMissingSC = false
			for _, n := range v {
				n.Parent = nodeId
				nd.HasMissingSC = nd.HasMissingSC || n.HasMissingSC
				// If there is a route rule defined in version node, move it to composite parent
				if n.HasRR {
					n.HasRR = false
					hasRouteRule = true
				}
			}

			if hasRouteRule {
				nd.HasRR = true
			}

			// add the composite node to the list of nodes
			*nodes = append(*nodes, &nw)
		}
	}
}
