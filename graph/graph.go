// TrafficMap is a map of ServiceNodes, each optionally holding Edge data. Metadata
// is a general purpose map for holding any desired service or edge information.
// Each Service node should have a unique name+version
package graph

import (
	"fmt"
	"strings"
)

const (
	UnknownNamespace = "unknown"
	UnknownService   = "unknown"
	UnknownVersion   = "unknown"
)

type ServiceNode struct {
	ID          string                 // unique identifier for the service node
	Name        string                 // full service name
	Version     string                 // service version
	ServiceName string                 // short service name
	Namespace   string                 // namespace name
	Edges       []*Edge                // children services nodes
	Metadata    map[string]interface{} // app-specific data
}

type Edge struct {
	Source   *ServiceNode
	Dest     *ServiceNode
	Metadata map[string]interface{} // app-specific data
}

type TrafficMap map[string]*ServiceNode

func NewServiceNode(name, version string) ServiceNode {
	return NewServiceNodeWithId(Id(name, version), name, version)
}

func NewServiceNodeWithId(id, name, version string) ServiceNode {
	split := strings.Split(name, ".")
	serviceName := split[0]
	namespace := UnknownNamespace
	if len(split) > 1 {
		namespace = split[1]
	}

	return ServiceNode{
		ID:          id,
		Name:        name,
		Version:     version,
		ServiceName: serviceName,
		Namespace:   namespace,
		Edges:       []*Edge{},
		Metadata:    make(map[string]interface{}),
	}
}

func (s *ServiceNode) AddEdge(dest *ServiceNode) *Edge {
	e := NewEdge(s, dest)
	s.Edges = append(s.Edges, &e)
	return &e
}

func NewEdge(source, dest *ServiceNode) Edge {
	return Edge{
		Source:   source,
		Dest:     dest,
		Metadata: make(map[string]interface{}),
	}
}

func NewTrafficMap() TrafficMap {
	return make(map[string]*ServiceNode)
}

func Id(name, version string) string {
	return fmt.Sprintf("%v_%v", name, version)
}
