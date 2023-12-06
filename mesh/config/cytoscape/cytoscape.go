// Package cytoscape provides conversion from our graph to the CystoscapeJS
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
//            nodes for requested boxing.
//
// The package provides the Cytoscape implementation of graph/ConfigVendor.

package cytoscape

import (
	"crypto/md5"
	"fmt"
	"sort"
	"time"

	"github.com/kiali/kiali/mesh"
)

type NodeData struct {
	// Cytoscape Fields
	ID     string `json:"id"`               // unique internal node ID (n0, n1...)
	Parent string `json:"parent,omitempty"` // Compound Node parent ID

	// Required Fields (not required by Cytoscape)
	Cluster   string `json:"cluster"`
	InfraName string `json:"infraName"`
	InfraType string `json:"infraType"`
	Namespace string `json:"namespace"`
	NodeType  string `json:"nodeType"`
	// Other Fields
	HealthData     interface{} `json:"healthData"`               // data to calculate health status from configurations
	IsAmbient      bool        `json:"isAmbient,omitempty"`      // true if configured for ambient
	IsBox          string      `json:"isBox,omitempty"`          // set for NodeTypeBox, current values: [ 'cluster', 'namespace' ]
	IsInaccessible bool        `json:"isInaccessible,omitempty"` // true if the node exists in an inaccessible namespace
	IsMTLS         bool        `json:"isMTLS,omitempty"`         // true if mesh-wide mTLS is enabled
	IsOutOfMesh    bool        `json:"isOutOfMesh,omitempty"`    // true (has missing sidecar) | false
}

type EdgeData struct {
	// Cytoscape Fields
	ID     string `json:"id"`     // unique internal edge ID (e0, e1...)
	Source string `json:"source"` // parent node ID
	Target string `json:"target"` // child node ID

	// App Fields (not required by Cytoscape)
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
	Elements  Elements `json:"elements"`
	Timestamp int64    `json:"timestamp"`
}

func nodeHash(id string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(id)))
}

func edgeHash(from, to string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s.%s", from, to))))
}

// NewConfig is required by the mesh/ConfigVendor interface
func NewConfig(meshMap mesh.MeshMap, o mesh.ConfigOptions) (result Config) {
	unfilteredNodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	buildConfig(meshMap, &unfilteredNodes, &edges, o)

	// Remove namespace nodes for namespaces that contain infra, these will become namespace boxes
	namespaceWithInfraMap := make(map[string]bool)
	var node *NodeWrapper
	for _, node = range unfilteredNodes {
		if node.Data.NodeType == mesh.NodeTypeInfra {
			namespaceWithInfraMap[node.Data.Namespace] = true
		}
	}
	nodes := []*NodeWrapper{}
	for _, node = range unfilteredNodes {
		if node.Data.InfraType != mesh.InfraTypeNamespace || namespaceWithInfraMap[node.Data.InfraName] != true {
			nodes = append(nodes, node)
		}
	}

	// Add compound nodes as needed, inner boxes first
	boxByNamespace(&nodes)
	boxByCluster(&nodes)

	// sort nodes and edges for better json presentation (and predictable testing)
	// kiali-1258 parent nodes must come before the child references
	sort.Slice(nodes, func(i, j int) bool {
		switch {
		case nodes[i].Data.IsBox != nodes[j].Data.IsBox:
			rank := func(boxBy string) int {
				switch boxBy {
				case mesh.BoxByCluster:
					return 0
				case mesh.BoxByNamespace:
					return 1
				default:
					return 2
				}
			}
			return rank(nodes[i].Data.IsBox) < rank(nodes[j].Data.IsBox)
		case nodes[i].Data.Cluster != nodes[j].Data.Cluster:
			return nodes[i].Data.Cluster < nodes[j].Data.Cluster
		case nodes[i].Data.Namespace != nodes[j].Data.Namespace:
			return nodes[i].Data.Namespace < nodes[j].Data.Namespace
		default:
			return nodes[i].Data.ID < nodes[j].Data.ID
		}
	})
	sort.Slice(edges, func(i, j int) bool {
		switch {
		case edges[i].Data.Source != edges[j].Data.Source:
			return edges[i].Data.Source < edges[j].Data.Source
		default:
			// source is the same, it must differ on target
			return edges[i].Data.Target < edges[j].Data.Target
		}
	})

	elements := Elements{nodes, edges}
	result = Config{
		Elements:  elements,
		Timestamp: time.Now().Unix(),
	}
	return result
}

func buildConfig(meshMap mesh.MeshMap, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper, o mesh.ConfigOptions) {
	for id, n := range meshMap {
		nodeID := nodeHash(id)

		nd := &NodeData{
			Cluster:   n.Cluster,
			ID:        nodeID,
			InfraName: n.InfraName,
			InfraType: n.InfraType,
			Namespace: n.Namespace,
			NodeType:  n.NodeType,
		}

		if val, ok := n.Metadata[mesh.HealthData]; ok {
			nd.HealthData = val
		}

		// node is not accessible to the current user
		if val, ok := n.Metadata[mesh.IsInaccessible]; ok {
			nd.IsInaccessible = val.(bool)
		}

		// set mesh checks, if available
		if val, ok := n.Metadata[mesh.IsOutOfMesh]; ok {
			nd.IsOutOfMesh = val.(bool)
		}

		nw := NodeWrapper{
			Data: nd,
		}

		*nodes = append(*nodes, &nw)

		for _, e := range n.Edges {
			sourceIDHash := nodeHash(n.ID)
			destIDHash := nodeHash(e.Dest.ID)
			edgeID := edgeHash(sourceIDHash, destIDHash)
			ed := EdgeData{
				ID:     edgeID,
				Source: sourceIDHash,
				Target: destIDHash,
			}

			ew := EdgeWrapper{
				Data: &ed,
			}
			*edges = append(*edges, &ew)
		}
	}
}

// boxByNamespace adds compound nodes to box nodes in the same namespace
func boxByNamespace(nodes *[]*NodeWrapper) {
	box := make(map[string][]*NodeData)

	for _, nw := range *nodes {
		// don't namespace box a namespace node
		if nw.Data.Parent != "" || nw.Data.InfraType == mesh.InfraTypeNamespace {
			continue
		}

		k := fmt.Sprintf("box_%s_%s", nw.Data.Cluster, nw.Data.Namespace)
		box[k] = append(box[k], nw.Data)
	}
	generateBoxCompoundNodes(box, nodes, mesh.BoxByNamespace)
}

// boxByCluster adds compound nodes to box nodes in the same cluster
func boxByCluster(nodes *[]*NodeWrapper) {
	box := make(map[string][]*NodeData)

	for _, nw := range *nodes {
		// never box unknown
		if nw.Data.Parent == "" && nw.Data.Cluster != mesh.Unknown {
			k := fmt.Sprintf("box_%s", nw.Data.Cluster)
			box[k] = append(box[k], nw.Data)
		}
	}
	generateBoxCompoundNodes(box, nodes, mesh.BoxByCluster)
}

func generateBoxCompoundNodes(box map[string][]*NodeData, nodes *[]*NodeWrapper, boxBy string) {
	for k, members := range box {
		// create the compound (parent) node for the member nodes
		nodeID := nodeHash(k)
		namespace := ""
		switch boxBy {
		case mesh.BoxByNamespace:
			namespace = members[0].Namespace
		}
		nd := NodeData{
			ID:        nodeID,
			NodeType:  mesh.NodeTypeBox,
			Cluster:   members[0].Cluster,
			Namespace: namespace,
			IsBox:     boxBy,
		}

		nw := NodeWrapper{
			Data: &nd,
		}

		// assign each member node to the compound parent
		nd.IsOutOfMesh = false // TODO: this is probably unecessarily noisy
		nd.IsInaccessible = false

		for _, n := range members {
			n.Parent = nodeID
		}

		// add the compound node to the list of nodes
		*nodes = append(*nodes, &nw)
	}
}
