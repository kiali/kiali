// TrafficMap is a map of app Nodes, each optionally holding Edge data. Metadata
// is a general purpose map for holding any desired node or edge information.
// Each app node should have a unique namespace+workload.  Note that it is feasible
// but likely unusual to have two nodes with the same name+version in the same
// namespace.
package graph

import (
	"fmt"
)

const (
	UnknownApp       string = "unknown"
	UnknownNamespace string = "unknown"
	UnknownVersion   string = "unknown"
)

type Node struct {
	ID        string                 // unique identifier for the node
	Namespace string                 // Namespace
	Workload  string                 // Workload (deployment) name
	App       string                 // Workload app
	Version   string                 // Workload version
	Edges     []*Edge                // child nodes
	Metadata  map[string]interface{} // app-specific data
}

type Edge struct {
	Source   *Node
	Dest     *Node
	Metadata map[string]interface{} // app-specific data
}

type TrafficMap map[string]*Node

func NewNode(namespace, workload, app, version string) Node {
	return NewNodeWithId(Id(namespace, workload), namespace, workload, app, version)
}

func NewNodeWithId(id, namespace, workload, app, version string) Node {
	return Node{
		ID:        id,
		Namespace: namespace,
		Workload:  workload,
		App:       app,
		Version:   version,
		Edges:     []*Edge{},
		Metadata:  make(map[string]interface{}),
	}
}

func (s *Node) AddEdge(dest *Node) *Edge {
	e := NewEdge(s, dest)
	s.Edges = append(s.Edges, &e)
	return &e
}

func NewEdge(source, dest *Node) Edge {
	return Edge{
		Source:   source,
		Dest:     dest,
		Metadata: make(map[string]interface{}),
	}
}

func NewTrafficMap() TrafficMap {
	return make(map[string]*Node)
}

func Id(namespace, workload string) string {
	return fmt.Sprintf("%v_%v", namespace, workload)
}
