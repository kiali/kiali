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
	HasInfra       bool        `json:"-"`                        // for local when generating boxes
	HealthData     interface{} `json:"healthData"`               // data to calculate health status from configurations
	InfraData      interface{} `json:"infraData,omitempty"`      // infraType-dependent data
	IsAmbient      bool        `json:"isAmbient,omitempty"`      // true if configured for ambient
	IsBox          string      `json:"isBox,omitempty"`          // set for NodeTypeBox, current values: [ 'cluster', 'dataplanes', 'namespace' ]
	IsExternal     bool        `json:"isExternal,omitempty"`     // true if the infra is external to the mesh | false
	IsInaccessible bool        `json:"isInaccessible,omitempty"` // true if the node exists in an inaccessible namespace
	IsMTLS         bool        `json:"isMTLS,omitempty"`         // true if mesh-wide mTLS is enabled
	Version        string      `json:"version,omitempty"`        // version of the component, if applicable and available
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
	MeshName  string   `json:"meshName"`
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
	nodes := []*NodeWrapper{}
	edges := []*EdgeWrapper{}

	buildConfig(meshMap, &nodes, &edges)

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
	meshName := mesh.StatusGetter().Status["Mesh Version"]
	if meshName == "" {
		meshName = "Istio Mesh"
	}
	result = Config{
		Elements:  elements,
		MeshName:  meshName,
		Timestamp: o.QueryTime,
	}
	return result
}

func buildConfig(meshMap mesh.MeshMap, nodes *[]*NodeWrapper, edges *[]*EdgeWrapper) {
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

		if val, ok := n.Metadata[mesh.InfraData]; ok {
			nd.InfraData = val
		}

		// node is external (or url could not be parsed)
		if val, ok := n.Metadata[mesh.IsExternal]; ok && val.(bool) {
			nd.IsExternal = true
			nd.IsInaccessible = true
		}

		// node is not accessible to the current user
		if val, ok := n.Metadata[mesh.IsInaccessible]; ok {
			nd.IsInaccessible = val.(bool)
		}

		if val, ok := n.Metadata[mesh.Version]; ok {
			nd.Version = val.(string)
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

// boxByNamespace adds namespace boxes for the infra nodes
func boxByNamespace(nodes *[]*NodeWrapper) {
	namespaceBoxes := make(map[string]*NodeWrapper)

	for _, n := range *nodes {
		nd := n.Data
		if nd.Namespace == "" || nd.IsExternal {
			continue
		}

		id, err := mesh.Id(nd.Cluster, nd.Namespace, nd.Namespace, nd.InfraType, false)
		mesh.CheckError(err)

		box, found := namespaceBoxes[id]
		if !found {
			boxID := nodeHash(id)

			nd := &NodeData{
				Cluster:   nd.Cluster,
				ID:        boxID,
				InfraName: nd.Namespace,
				InfraType: mesh.InfraTypeNamespace,
				IsBox:     mesh.BoxByNamespace,
				Namespace: nd.Namespace,
				NodeType:  mesh.NodeTypeBox,
			}

			box = &NodeWrapper{
				Data: nd,
			}

			*nodes = append(*nodes, box)
			namespaceBoxes[id] = box
		}
		nd.Parent = box.Data.ID
	}
}

// boxByCluster boxes nodes in the same namespace, within a cluster
func boxByCluster(nodes *[]*NodeWrapper) {
	for _, parent := range *nodes {
		if parent.Data.InfraType != mesh.InfraTypeCluster {
			continue
		}

		for _, child := range *nodes {
			if child.Data.InfraType == mesh.InfraTypeCluster ||
				child.Data.Cluster != parent.Data.Cluster ||
				(child.Data.InfraType != mesh.InfraTypeNamespace && child.Data.Namespace != "") {
				continue
			}

			parent.Data.NodeType = mesh.NodeTypeBox
			parent.Data.IsBox = mesh.BoxByCluster
			child.Data.Parent = parent.Data.ID

		}
	}
}
