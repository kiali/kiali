// Cytoscape package provides conversion from our graph/tree to the CystoscapeJS
// configuration json model.
//
// The following links are useful for understanding CytoscapeJS and it's configuration:
//
// Main page:   http://js.cytoscape.org/
// JSON config: http://js.cytoscape.org/#notation/elements-json
// Demos:       http://js.cytoscape.org/#demos
//
// Algorithm: Walk each tree adding nodes and edges, decorating each with information
//            provided.  An optional second pass generates compound nodes for
//            for versioned services.
//
package cytoscape

import (
	"crypto/md5"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

type NodeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`               // unique internal node ID (n0, n1...)
	Parent string `json:"parent,omitempty"` // Compound Node parent ID

	// App Fields (not required by Cytoscape)
	Service            string         `json:"service"`
	Version            string         `json:"version,omitempty"`
	Rate               string         `json:"rate,omitempty"`               // edge aggregate
	Rate3xx            string         `json:"rate3XX,omitempty"`            // edge aggregate
	Rate4xx            string         `json:"rate4XX,omitempty"`            // edge aggregate
	Rate5xx            string         `json:"rate5XX,omitempty"`            // edge aggregate
	HasCircuitBreaker  string         `json:"hasCB,omitempty"`              // true | false
	HasRouteRule       string         `json:"hasRR,omitempty"`              // true | false
	IsDead             string         `json:"isDead,omitempty"`             // true (has no pods) | false
	IsGroup            string         `json:"isGroup,omitempty"`            // set to the grouping type, current values: [ 'version' ]
	IsRoot             string         `json:"isRoot,omitempty"`             // true | false
	IsUnused           string         `json:"isUnused,omitempty"`           // true | false
	HasMissingSidecars bool           `json:"hasMissingSidecars,omitempty"` // true | false
	Health             *models.Health `json:"health,omitempty"`
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
	IsUnused    string `json:"isUnused,omitempty"` // true | false
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

func NewConfig(sn *[]*tree.ServiceNode, o options.VendorOptions) (result Config) {
	nodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	for _, t := range *sn {
		log.Debugf("Walk Tree Root %v", t.ID)

		walk(t, nil, &nodes, &edges, o)
	}

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

func walk(sn *tree.ServiceNode, ndParent *NodeData, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper, o options.VendorOptions) {
	name := sn.Name
	if "" == name {
		name = tree.UnknownService
	}

	nd, found := findNode(nodes, name, sn.Version)

	if !found {
		nodeId := nodeHash(sn.ID)

		text := strings.Split(name, ".")[0]
		if tree.UnknownVersion != sn.Version {
			text = fmt.Sprintf("%v %v", text, sn.Version)
		}
		nd = &NodeData{
			Id:      nodeId,
			Service: name,
			Version: sn.Version,
		}

		// node may be dead (service defined but no pods running)
		if val, ok := sn.Metadata["isDead"]; ok {
			nd.IsDead = val.(string)
		}

		// node may be a root
		if val, ok := sn.Metadata["isRoot"]; ok {
			nd.IsRoot = val.(string)
		}

		// node may be an unused service
		if val, ok := sn.Metadata["isUnused"]; ok {
			nd.IsUnused = val.(string)
		}

		// node may have a circuit breaker
		if val, ok := sn.Metadata["hasCircuitBreaker"]; ok {
			nd.HasCircuitBreaker = val.(string)
		}

		// node may have a route rule
		if val, ok := sn.Metadata["hasRouteRule"]; ok {
			nd.HasRouteRule = val.(string)
		}

		// set sidecars checks, if available
		if val, ok := sn.Metadata["hasMissingSidecars"]; ok {
			nd.HasMissingSidecars = val.(bool)
		}

		// set health, if available
		if val, ok := sn.Metadata["health"]; ok {
			nd.Health = val.(*models.Health)
		}

		nw := NodeWrapper{
			Data: nd,
		}
		*nodes = append(*nodes, &nw)
	}

	if ndParent != nil {
		edgeId := edgeHash(ndParent.Id, nd.Id)
		ed := EdgeData{
			Id:     edgeId,
			Source: ndParent.Id,
			Target: nd.Id,
		}
		addTelemetry(&ed, sn, nd, o)
		// TODO: Add in the response code breakdowns and/or other metric info
		ew := EdgeWrapper{
			Data: &ed,
		}
		*edges = append(*edges, &ew)
	}

	for _, c := range sn.Children {
		walk(c, nd, nodes, edges, o)
	}
}

func findNode(nodes *[]*NodeWrapper, service, version string) (*NodeData, bool) {
	for _, nw := range *nodes {
		if nw.Data.Service == service && nw.Data.Version == version {
			return nw.Data, true
		}
	}
	return nil, false
}

func addTelemetry(ed *EdgeData, sn *tree.ServiceNode, nd *NodeData, o options.VendorOptions) {
	rate := sn.Metadata["rate"].(float64)

	if rate > 0.0 {
		rate3xx := sn.Metadata["rate_3xx"].(float64)
		rate4xx := sn.Metadata["rate_4xx"].(float64)
		rate5xx := sn.Metadata["rate_5xx"].(float64)
		rateErr := rate4xx + rate5xx
		percentErr := rateErr / rate * 100.0

		ed.Rate = fmt.Sprintf("%.3f", rate)
		nd.Rate = add(nd.Rate, rate)
		if rate3xx > 0.0 {
			ed.Rate3xx = fmt.Sprintf("%.3f", rate3xx)
			nd.Rate3xx = add(nd.Rate3xx, rate3xx)
		}
		if rate4xx > 0.0 {
			ed.Rate4xx = fmt.Sprintf("%.3f", rate4xx)
			nd.Rate4xx = add(nd.Rate4xx, rate4xx)
		}
		if rate5xx > 0.0 {
			ed.Rate5xx = fmt.Sprintf("%.3f", rate5xx)
			nd.Rate5xx = add(nd.Rate5xx, rate5xx)
		}
		if percentErr > 0.0 {
			ed.PercentErr = fmt.Sprintf("%.3f", percentErr)
		}

		if val, ok := sn.Metadata["latency"]; ok {
			latency := val.(float64)
			ed.Latency = fmt.Sprintf("%.3f", latency)
		}

		percentRate := rate / sn.Parent.Metadata["rateOut"].(float64) * 100.0
		if percentRate < 100.0 {
			ed.PercentRate = fmt.Sprintf("%.3f", percentRate)
		}

	} else {
		if val, ok := sn.Metadata["isUnused"]; ok {
			ed.IsUnused = val.(string)
		}
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
			nd.HasMissingSidecars = false
			for _, n := range v {
				n.Parent = nodeId
				nd.HasMissingSidecars = nd.HasMissingSidecars || n.HasMissingSidecars
				// If there is a route rule defined in version node, move it to composite parent
				if n.HasRouteRule == "true" {
					n.HasRouteRule = ""
					hasRouteRule = true
				}
			}

			if hasRouteRule {
				nd.HasRouteRule = "true"
			}

			// add the composite node to the list of nodes
			*nodes = append(*nodes, &nw)
		}
	}
}
