// Mesh package provides support for the mesh graph handlers such as supported path
// variables and query params, as well as types for mesh graph processing.
package mesh

import (
	"fmt"
	"time"
)

const (
	NodeTypeBox       string = "box" // The special "box" node. isBox will be set to "cluster" | "namespace"
	NodeTypeIstiod    string = "istiod"
	NodeTypeKiali     string = "kiali"               // The special "box" node. isBox will be set to "app" | "cluster" | "namespace"
	NodeTypeNamespace string = "namespace"           // The special "aggregate" traffic node
	TF                string = "2006-01-02 15:04:05" // TF is the TimeFormat for timestamps
	Unknown           string = "unknown"             // Istio unknown label value
)

type Node struct {
	Cluster   string  // Cluster
	Edges     []*Edge // child nodes
	ID        string  // unique identifier for the node
	IsIstiod  bool
	IsKiali   bool
	Metadata  Metadata // app-specific data
	Namespace string   // Namespace
	NodeType  string   // Node type
}

type Edge struct {
	Dest     *Node
	Metadata Metadata // app-specific data
	Source   *Node
}

type NamespaceInfo struct {
	Duration time.Duration
	IsIstio  bool
	Name     string
}

type NamespaceInfoMap map[string]NamespaceInfo

func NewNamespaceInfoMap() NamespaceInfoMap {
	return make(map[string]NamespaceInfo)
}

// MeshMap is a map of app Nodes, each optionally holding Edge data. Metadata
// is a general purpose map for holding any desired node or edge information.
type MeshMap map[string]*Node

// Edges returns all of the edges in the traffic map.
func (tm MeshMap) Edges() []*Edge {
	var edges []*Edge
	for _, n := range tm {
		edges = append(edges, n.Edges...)
	}
	return edges
}

// NewNode constructor
func NewNode(cluster, namespace string, isIstiod, isKiali bool) (*Node, error) {
	id, nodeType, err := Id(cluster, namespace, isIstiod, isKiali)
	if err != nil {
		return nil, err
	}

	return NewNodeExplicit(id, nodeType, cluster, namespace, isIstiod, isKiali), nil
}

// NewNodeExplicit constructor assigns the specified ID
func NewNodeExplicit(id, nodeType, cluster, namespace string, isIstiod, isKiali bool) *Node {
	metadata := make(Metadata)

	return &Node{
		Cluster:   cluster,
		Edges:     []*Edge{},
		ID:        id,
		IsIstiod:  isIstiod,
		IsKiali:   isKiali,
		Metadata:  metadata,
		Namespace: namespace,
		NodeType:  nodeType,
	}
}

// AddEdge adds an edge to the specified dest node
func (s *Node) AddEdge(dest *Node) *Edge {
	e := NewEdge(s, dest)
	s.Edges = append(s.Edges, &e)
	return &e
}

// NewEdge constructor
func NewEdge(source, dest *Node) Edge {
	return Edge{
		Dest:     dest,
		Metadata: NewMetadata(),
		Source:   source,
	}
}

// NewMeshMap constructor
func NewMeshMap() MeshMap {
	return make(map[string]*Node)
}

// Id returns the unique node ID
func Id(cluster, namespace string, isIstiod, isKiali bool) (id, nodeType string, err error) {
	// handle workload graph nodes (service graphs are initially processed as workload graphs)
	if isIstiod {
		return fmt.Sprintf("istiod_%s_%s", cluster, namespace), NodeTypeIstiod, nil
	}
	if isKiali {
		return fmt.Sprintf("kiali_%s_%s", cluster, namespace), NodeTypeKiali, nil
	}

	return fmt.Sprintf("ns_%s_%s", cluster, namespace), NodeTypeNamespace, nil
}
