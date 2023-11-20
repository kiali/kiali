// Mesh package provides support for the mesh graph handlers such as supported path
// variables and query params, as well as types for mesh graph processing.
package mesh

import (
	"fmt"
	"time"
)

const (
	NodeTypeCluster   string = "cluster"             // A cluster "box" node
	NodeTypeInfra     string = "infra"               // Any non-box node of interest
	NodeTypeNamespace string = "namespace"           // A namespace "box" node
	TF                string = "2006-01-02 15:04:05" // TF is the TimeFormat for timestamps
	Unknown           string = "unknown"             // Istio unknown label value
)

type Node struct {
	Cluster   string  // cluster name
	Edges     []*Edge // child nodes
	ID        string  // unique identifier for the node
	IsIstiod  bool
	IsKiali   bool
	IsProm    bool
	IsTracing bool
	Metadata  Metadata // app-specific data
	Name      string   // infra name
	Namespace string   // namespace name
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
func NewNode(cluster, namespace, name string) (*Node, error) {
	id, nodeType, err := Id(cluster, namespace, name)
	if err != nil {
		return nil, err
	}

	return NewNodeExplicit(id, nodeType, cluster, namespace, name), nil
}

// NewNodeExplicit constructor assigns the specified ID
func NewNodeExplicit(id, nodeType, cluster, namespace, name string) *Node {
	metadata := make(Metadata)

	return &Node{
		Cluster:   cluster,
		Edges:     []*Edge{},
		ID:        id,
		Metadata:  metadata,
		Name:      name,
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
func Id(cluster, namespace, name string) (id, nodeType string, err error) {
	if cluster != "" {
		if namespace != "" {
			if name != "" {
				return fmt.Sprintf("infra_%s_%s_%s", cluster, namespace, name), NodeTypeInfra, nil
			}
			return fmt.Sprintf("box_%s_%s", cluster, namespace), NodeTypeNamespace, nil
		}
		return fmt.Sprintf("box_%s", cluster), NodeTypeCluster, nil
	}
	return "", "", fmt.Errorf("Failed Mesh ID gen: cluster=[%s] namespace=[%s] name=[%s]", cluster, namespace, name)
}
