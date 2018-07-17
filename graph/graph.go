// Graph package provides support for the graph handlers such as supported path
// variables and query params, as well as types for graph processing.
package graph

import (
	"fmt"
)

const (
	GraphTypeApp          string = "app"
	GraphTypeAppPreferred string = "appPreferred"
	GraphTypeWorkload     string = "workload"
	UnknownApp            string = "unknown"
	UnknownNamespace      string = "unknown"
	UnknownVersion        string = "unknown"
	UnknownWorkload       string = "unknown"
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

// TrafficMap is a map of app Nodes, each optionally holding Edge data. Metadata
// is a general purpose map for holding any desired node or edge information.
// Each app node should have a unique namespace+workload.  Note that it is feasible
// but likely unusual to have two nodes with the same name+version in the same
// namespace.
type TrafficMap map[string]*Node

func NewNode(id, namespace, workload, app, version string) Node {
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

func Id(namespace, workload, app, version, graphType string, versioned bool) string {
	switch graphType {
	case GraphTypeApp:
		if versioned {
			return fmt.Sprintf("%v_%v_%v", namespace, app, version)
		}
		return fmt.Sprintf("%v_%v", namespace, app)
	case GraphTypeAppPreferred:
		if app != UnknownApp {
			if versioned {
				return fmt.Sprintf("%v_%v_%v", namespace, app, version)
			}
			return fmt.Sprintf("%v_%v", namespace, app)
		} else {
			return fmt.Sprintf("%v_%v", namespace, workload)
		}
	case GraphTypeWorkload:
		return fmt.Sprintf("%v_%v", namespace, workload)
	default:
		panic(fmt.Sprintf("Unrecognized graphFormat [%s]", graphType))
	}
}
