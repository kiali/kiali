// Graph package provides support for the graph handlers such as supported path
// variables and query params, as well as types for graph processing.
package graph

import (
	"fmt"
)

const (
	GraphTypeApp          string = "app"
	GraphTypeVersionedApp string = "versionedApp"
	GraphTypeWorkload     string = "workload"
	NodeTypeApp           string = "app"
	NodeTypeService       string = "service"
	NodeTypeUnknown       string = "unknown" // The special "unknown" traffic gen node
	NodeTypeWorkload      string = "workload"
	UnknownApp            string = "unknown"
	UnknownNamespace      string = "unknown"
	UnknownVersion        string = "unknown"
	UnknownWorkload       string = "unknown"
)

type Node struct {
	ID        string                 // unique identifier for the node
	NodeType  string                 // Node type
	Namespace string                 // Namespace
	Workload  string                 // Workload (deployment) name
	App       string                 // Workload app label value
	Version   string                 // Workload version label value
	Service   string                 // Service name
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

func NewNode(namespace, workload, app, version, service, graphType string) Node {
	id, nodeType := Id(namespace, workload, app, version, service, graphType)

	return NewNodeExplicit(id, namespace, workload, app, version, service, nodeType, graphType)
}

func NewNodeExplicit(id, namespace, workload, app, version, service, nodeType, graphType string) Node {
	// trim unnecessary fields
	switch nodeType {
	case NodeTypeWorkload:
		// maintain the app+version labeling if it is set, it can be useful for
		// for identifying destination rules, and providing additional links
		if app == UnknownApp {
			app = ""
		}
		if version == UnknownVersion {
			version = ""
		}
		service = ""
	case NodeTypeApp:
		// note: we keep workload for a versioned app node because app+version labeling
		// should be backed by a single workload and it can be useful to use the workload
		// name as opposed to the label values.
		if graphType != GraphTypeVersionedApp {
			workload = ""
			version = ""
		}
		service = ""
	case NodeTypeService:
		app = ""
		workload = ""
		version = ""
	}

	return Node{
		ID:        id,
		NodeType:  nodeType,
		Namespace: namespace,
		Workload:  workload,
		App:       app,
		Version:   version,
		Service:   service,
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

func Id(namespace, workload, app, version, service, graphType string) (id, nodeType string) {
	// first, check for the special-case "unknown" node
	if UnknownWorkload == workload && UnknownApp == app && "" == service {
		return fmt.Sprintf("source-unknown"), NodeTypeUnknown
	}

	// It is possible that a request is made for an unknown destination. For example, an Ingress
	// request to an unknown path. In this case everything is unknown.
	if UnknownNamespace == namespace && UnknownWorkload == workload && UnknownApp == app && UnknownApp == service {
		return fmt.Sprintf("dest-unknown"), NodeTypeService
	}

	workloadOk := workload != "" && workload != UnknownWorkload
	appOk := app != "" && app != UnknownApp
	serviceOk := service != "" && service != UnknownApp

	if !workloadOk && !appOk && !serviceOk {
		panic(fmt.Sprintf("Failed ID gen: namespace=[%s] workload=[%s] app=[%s] version=[%s] service=[%s] graphType=[%s]", namespace, workload, app, version, service, graphType))
	}

	// handle workload graph nodes
	if graphType == GraphTypeWorkload {
		// workload graph nodes are type workload or service
		if !workloadOk && !serviceOk {
			panic(fmt.Sprintf("Failed ID gen: namespace=[%s] workload=[%s] app=[%s] version=[%s] service=[%s] graphType=[%s]", namespace, workload, app, version, service, graphType))
		}
		if !workloadOk {
			return fmt.Sprintf("svc_%v_%v", namespace, service), NodeTypeService
		}
		return fmt.Sprintf("wl_%v_%v", namespace, workload), NodeTypeWorkload
	}

	// handle app nodes
	if appOk {
		// For a versionedApp graph we use workload as the Id, it allows us some protection against labeling
		// anti-patterns. For versionless we  just use the app label to aggregate versions/workloads into one node
		if graphType == GraphTypeVersionedApp {
			return fmt.Sprintf("app_%v_%v", namespace, workload), NodeTypeApp
		} else {
			return fmt.Sprintf("app_%v_%v", namespace, app), NodeTypeApp
		}
	}

	// fall back to service if applicable
	if serviceOk {
		return fmt.Sprintf("svc_%v_%v", namespace, service), NodeTypeService
	}

	// fall back to workload as a last resort in the app graph
	return fmt.Sprintf("wl_%v_%v", namespace, workload), NodeTypeWorkload
}
