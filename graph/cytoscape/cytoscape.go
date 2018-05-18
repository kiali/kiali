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
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/log"
)

type NodeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`               // unique internal node ID (n0, n1...)
	Parent string `json:"parent,omitempty"` // Compound Node parent ID

	// App Fields (not required by Cytoscape)
	Service            string `json:"service"`
	Version            string `json:"version,omitempty"`
	Rate               string `json:"rate,omitempty"`               // edge aggregate
	Rate3xx            string `json:"rate3XX,omitempty"`            // edge aggregate
	Rate4xx            string `json:"rate4XX,omitempty"`            // edge aggregate
	Rate5xx            string `json:"rate5XX,omitempty"`            // edge aggregate
	RateSelfInvoke     string `json:"rateSelfInvoke,omitempty"`     // rate of selfInvoke
	HasCircuitBreaker  string `json:"hasCB,omitempty"`              // true | false
	HasRouteRule       string `json:"hasRR,omitempty"`              // true | false
	IsDead             string `json:"isDead,omitempty"`             // true (has no pods) | false
	IsGroup            string `json:"isGroup,omitempty"`            // set to the grouping type, current values: [ 'version' ]
	IsRoot             string `json:"isRoot,omitempty"`             // true | false
	IsUnused           string `json:"isUnused,omitempty"`           // true | false
	HasMissingSidecars bool   `json:"hasMissingSidecars,omitempty"` // true | false
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

// NewConfig currently ignores namespace arg
func NewConfig(namespace string, sn *[]tree.ServiceNode, o options.VendorOptions) (result Config) {
	nodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	var nodeIdSequence int
	var edgeIdSequence int

	for _, t := range *sn {
		log.Debugf("Walk Tree Root %v", t.ID)

		walk(&t, nil, &nodes, &edges, &nodeIdSequence, &edgeIdSequence, o)
	}

	// Add composite nodes that group together different versions of the same service
	if o.GroupByVersion {
		addCompositeNodes(&nodes, &nodeIdSequence)
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

func walk(sn *tree.ServiceNode, ndParent *NodeData, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper, nodeIdSequence, edgeIdSequence *int, o options.VendorOptions) {
	name := sn.Name
	if "" == name {
		name = tree.UnknownService
	}

	nd, found := findNode(nodes, name, sn.Version)

	if !found {
		nodeId := fmt.Sprintf("n%v", *nodeIdSequence)
		text := strings.Split(name, ".")[0]
		if tree.UnknownVersion != sn.Version {
			text = fmt.Sprintf("%v %v", text, sn.Version)
		}
		*nodeIdSequence++
		nd = &NodeData{
			Id:      nodeId,
			Service: name,
			Version: sn.Version,
		}

		// node may be dead (service defined but no pods running)
		if dead, ok := sn.Metadata["isDead"]; ok {
			nd.IsDead = dead.(string)
		}

		// node may be a root
		if root, ok := sn.Metadata["isRoot"]; ok {
			nd.IsRoot = root.(string)
		}

		// node may be an unused service
		if unused, ok := sn.Metadata["isUnused"]; ok {
			nd.IsUnused = unused.(string)
		}

		// node may have a circuit breaker
		if cb, ok := sn.Metadata["hasCircuitBreaker"]; ok {
			nd.HasCircuitBreaker = cb.(string)
		}

		// node may have a route rule
		if cb, ok := sn.Metadata["hasRouteRule"]; ok {
			nd.HasRouteRule = cb.(string)
		}

		// set sidecars checks, if available
		if cb, ok := sn.Metadata["hasMissingSidecars"]; ok {
			nd.HasMissingSidecars = cb.(bool)
		}

		nw := NodeWrapper{
			Data: nd,
		}
		*nodes = append(*nodes, &nw)
	}

	if ndParent != nil {
		//TODO If we can find a graph layout that handles loop edges well then
		// we can go back to allowing these but for now, flag the node text
		if ndParent.Id == nd.Id {
			nd.RateSelfInvoke = fmt.Sprintf("%.3f", sn.Metadata["rate"].(float64))
		} else {
			edgeId := fmt.Sprintf("e%v", *edgeIdSequence)
			*edgeIdSequence++
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
	}

	for _, c := range sn.Children {
		walk(c, nd, nodes, edges, nodeIdSequence, edgeIdSequence, o)
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
func addCompositeNodes(nodes *[]*NodeWrapper, nodeIdSequence *int) {
	serviceCount := make(map[string]int)
	for _, nw := range *nodes {
		serviceCount[nw.Data.Service] += 1
	}
	for k, v := range serviceCount {
		if v > 1 {
			// create the composite grouping all versions of the service
			nodeId := fmt.Sprintf("n%v", *nodeIdSequence)
			*nodeIdSequence++
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
			for _, n := range *nodes {
				if k == n.Data.Service {
					n.Data.Parent = nodeId
					nd.HasMissingSidecars = nd.HasMissingSidecars || n.Data.HasMissingSidecars
					// If there is a route rule defined in version node, move it to composite parent
					if n.Data.HasRouteRule == "true" {
						n.Data.HasRouteRule = ""
						hasRouteRule = true
					}
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
