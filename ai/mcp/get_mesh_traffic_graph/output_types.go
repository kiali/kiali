package get_mesh_traffic_graph

type CompactNode struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Version string `json:"version,omitempty"`
}

type CompactEdge struct {
	Health         string `json:"health,omitempty"`
	MTLS           bool   `json:"mTLS"`
	Protocol       string `json:"protocol"`
	ResponseTimeMs int    `json:"responseTimeMs,omitempty"`
	Source         string `json:"source"`
	Target         string `json:"target"`
	Throughput     string `json:"throughput,omitempty"`
}

type CompactGraphResponse struct {
	Errors     map[string]string  `json:"errors,omitempty"`
	GraphType  string             `json:"graphType"`
	Health     *MeshHealthSummary `json:"health,omitempty"`
	Namespaces []string           `json:"namespaces"`
	Nodes      []CompactNode      `json:"nodes"`
	Traffic    []CompactEdge      `json:"traffic"`
}
