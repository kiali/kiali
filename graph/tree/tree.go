// tree represents a parent-child tree and is used to represent a service
// hierarchy. Root nodes have parent == nil.  Metadata is a general purpose map
// for holding any desired service information. Each Service node should have
// a unique name+version
package tree

import (
	"fmt"
)

const (
	UnknownService = "unknown"
	UnknownVersion = "unknown"
)

type ServiceNode struct {
	ID       string                 // unique identifier for the service node
	Name     string                 // service name
	Version  string                 // service version
	Parent   *ServiceNode           // parent service node, or nil if no parent
	Children []*ServiceNode         // children services nodes
	Metadata map[string]interface{} // app-specific data
}

func NewServiceNode(name, version string) ServiceNode {
	return ServiceNode{
		ID:      id(name, version),
		Name:    name,
		Version: version,
	}
}

func id(name, version string) string {
	return fmt.Sprintf("%v_%v", name, version)
}
