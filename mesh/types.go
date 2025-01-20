// Mesh package provides support for the mesh graph handlers such as supported path
// variables and query params, as well as types for mesh graph processing.
package mesh

import (
	"fmt"
	"time"
)

const (
	BoxTypeCluster       string = "cluster"
	BoxTypeNamespace     string = "namespace"
	External             string = "_external_" // Special cluster name for external deployment
	InfraTypeCluster     string = "cluster"    // cluster node (not box) with no other infra (very rare)
	InfraTypeDataPlane   string = "dataplane"  // single node representing 1 or more dataPlane namespaces
	InfraTypeGateway     string = "gateway"
	InfraTypeGrafana     string = "grafana"
	InfraTypeIstiod      string = "istiod"
	InfraTypeKiali       string = "kiali"
	InfraTypeMetricStore string = "metricStore"
	InfraTypeNamespace   string = "namespace"
	InfraTypeTraceStore  string = "traceStore"
	InfraTypeWaypoint    string = "waypoint"
	NodeTypeBox          string = "box"                 // The special "box" node. isBox will be set to a BoxType
	NodeTypeInfra        string = "infra"               // Any non-box node of interest
	TF                   string = "2006-01-02 15:04:05" // TF is the TimeFormat for timestamps
)

type Node struct {
	Cluster   string   // cluster name
	Edges     []*Edge  // child nodes
	ID        string   // unique identifier for the node
	InfraName string   // infra name
	InfraType string   // set to appropriate InfraType
	Metadata  Metadata // app-specific data
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

// NewNode constructor assigns the specified ID
func NewNode(id, nodeType, infraType, cluster, namespace, name string) *Node {
	metadata := make(Metadata)

	return &Node{
		Cluster:   cluster,
		Edges:     []*Edge{},
		ID:        id,
		InfraName: name,
		InfraType: infraType,
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
func Id(cluster, namespace, name, infraType, version string, isExternal bool) (id string, err error) {
	if cluster == "" || (namespace == "" && !(isExternal || infraType == InfraTypeCluster || infraType == InfraTypeDataPlane)) || name == "" {
		return "", fmt.Errorf("failed Mesh ID gen: type=[%s] cluster=[%s] namespace=[%s] name=[%s], isExternal=[%v]", infraType, cluster, namespace, name, isExternal)
	}
	return fmt.Sprintf("infra_%s_%s_%s_%s", cluster, namespace, name, version), nil
}
