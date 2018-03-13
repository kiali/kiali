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
	"strings"

	"github.com/kiali/swscore/graph/options"
	"github.com/kiali/swscore/graph/tree"
	"github.com/kiali/swscore/log"
)

type NodeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`               // unique internal node ID (n0, n1...)
	Text   string `json:"text"`             // display text for the node
	Parent string `json:"parent,omitempty"` // Compund Node parent ID
	// App Fields (not required by Cytoscape)
	Service       string `json:"service"`
	Version       string `json:"version,omitempty"`
	LinkPromGraph string `json:"link_prom_graph,omitempty"`
}

type EdgeData struct {
	// Cytoscape Fields
	Id     string `json:"id"`     // unique internal edge ID (e0, e1...)
	Source string `json:"source"` // parent node ID
	Target string `json:"target"` // child node ID
	Text   string `json:"text"`   // display text
	Color  string `json:"color"`  // link color
	// App Fields (not required by Cytoscape)
	Rate    string `json:"rate,omitempty"`
	Rate2xx string `json:"rate_2XX,omitempty"`
	Rate3xx string `json:"rate_3XX,omitempty"`
	Rate4xx string `json:"rate_4XX,omitempty"`
	Rate5xx string `json:"rate_5XX,omitempty"`
}

type NodeWrapper struct {
	Data NodeData `json:"data"`
}

type EdgeWrapper struct {
	Data EdgeData `json:"data"`
}

type Elements struct {
	Nodes []*NodeWrapper `json:"nodes"`
	Edges []*EdgeWrapper `json:"edges"`
}

type Config struct {
	Elements Elements `json:"elements"`
}

// NewConfig currently ignores namespace arg
func NewConfig(namespace string, sn *[]tree.ServiceNode, o options.VendorOptions) (result Config) {
	nodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	var nodeIdSequence int
	var edgeIdSequence int

	for _, t := range *sn {
		log.Debugf("Walk Tree Root %v", t.ID)

		walk(&t, &nodes, &edges, "", &nodeIdSequence, &edgeIdSequence, o)
	}

	// Add composite nodes that group together different versions of the same service
	if o.GroupByVersion {
		addCompositeNodes(&nodes, &nodeIdSequence)
	}

	// sort nodes and edges for better json presentation (and predictable testing)
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Data.Text < nodes[j].Data.Text
	})
	sort.Slice(edges, func(i, j int) bool {
		switch {
		case edges[i].Data.Source < edges[j].Data.Source:
			return true
		case edges[i].Data.Source == edges[j].Data.Source:
			return edges[i].Data.Target < edges[j].Data.Target
		default:
			return false
		}
	})

	elements := Elements{nodes, edges}
	result = Config{elements}
	return result
}

func walk(sn *tree.ServiceNode, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper, parentNodeId string, nodeIdSequence, edgeIdSequence *int, o options.VendorOptions) {
	name := sn.Name
	if "" == name {
		name = tree.UnknownService
	}

	nd, found := findNode(nodes, name, sn.Version)

	if !found {
		nodeId := fmt.Sprintf("n%v", *nodeIdSequence)
		text := strings.Split(name, ".")[0]
		if tree.UnknownVersion != sn.Version {
			text = fmt.Sprintf("%v (%v)", text, sn.Version)
		}
		*nodeIdSequence++
		nd = &NodeData{
			Id:            nodeId,
			Service:       name,
			Version:       sn.Version,
			Text:          text,
			LinkPromGraph: sn.Metadata["link_prom_graph"].(string),
		}
		nw := NodeWrapper{
			Data: *nd,
		}
		*nodes = append(*nodes, &nw)
	}

	if parentNodeId != "" {
		//TODO If we can find a graph layout that handles loop edges well then
		// we can go back to allowing these but for now, flag the node text
		if parentNodeId == nd.Id {
			nd.Text = fmt.Sprintf("%s <%.2fpm>", nd.Text, sn.Metadata["rate"].(float64))
		} else {
			edgeId := fmt.Sprintf("e%v", *edgeIdSequence)
			*edgeIdSequence++
			ed := EdgeData{
				Id:     edgeId,
				Source: parentNodeId,
				Target: nd.Id,
			}
			addRate(&ed, sn, o)
			// TODO: Add in the response code breakdowns and/or other metric info
			ew := EdgeWrapper{
				Data: ed,
			}
			*edges = append(*edges, &ew)
		}
	}

	for _, c := range sn.Children {
		walk(c, nodes, edges, nd.Id, nodeIdSequence, edgeIdSequence, o)
	}
}

func findNode(nodes *[]*NodeWrapper, service, version string) (*NodeData, bool) {
	for _, nw := range *nodes {
		if nw.Data.Service == service && nw.Data.Version == version {
			return &nw.Data, true
		}
	}
	return nil, false
}

func addRate(ed *EdgeData, sn *tree.ServiceNode, o options.VendorOptions) {
	rate := sn.Metadata["rate"].(float64)
	if rate > 0.0 {
		successRate := sn.Metadata["rate_2xx"].(float64)
		errorPercent := (rate - successRate) / rate * 100.0
		switch {
		case errorPercent > o.ThresholdError:
			ed.Color = o.ColorError
			ed.Text = fmt.Sprintf("%.2fps (err=%.2f%%)", rate, errorPercent)
		case errorPercent > o.ThresholdWarn:
			ed.Color = o.ColorWarn
			ed.Text = fmt.Sprintf("%.2fps (err=%.2f%%)", rate, errorPercent)
		default:
			ed.Color = o.ColorNormal
			ed.Text = fmt.Sprintf("%.2fps", rate)
		}
	} else {
		ed.Color = o.ColorDead
		ed.Text = "0ps"
	}
}

func addRpmField(rpmField *string, sn *tree.ServiceNode, key string) {
	rpm := sn.Metadata[key].(float64)
	if rpm > 0.0 {
		*rpmField = fmt.Sprintf("%.2f", rpm)
	}
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
				Text:    strings.Split(k, ".")[0],
			}
			nw := NodeWrapper{
				Data: nd,
			}

			// assign each service version node to the composite parent
			for _, n := range *nodes {
				if k == n.Data.Service {
					n.Data.Parent = nodeId
				}
			}

			// add the composite node to the list of nodes
			*nodes = append(*nodes, &nw)
		}
	}
}
