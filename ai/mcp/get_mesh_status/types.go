package get_mesh_status

// MeshSummaryFormatted is the compact, LLM-optimized mesh status response.
type MeshSummaryFormatted struct {
	Components        MeshSummaryComponents      `json:"components"`
	ConnectivityGraph []MeshSummaryEdge          `json:"connectivity_graph"`
	CriticalAlerts    []MeshSummaryCriticalAlert `json:"critical_alerts,omitempty"`
	Environment       MeshSummaryEnvironment     `json:"environment"`
}

type MeshSummaryEnvironment struct {
	IstioVersion string `json:"istio_version"`
	KialiVersion string `json:"kiali_version"`
	Timestamp    string `json:"timestamp"`
	TrustDomain  string `json:"trust_domain"`
}

type MeshSummaryComponents struct {
	ControlPlane       MeshSummaryControlPlane       `json:"control_plane"`
	DataPlane          MeshSummaryDataPlane          `json:"data_plane"`
	ObservabilityStack MeshSummaryObservabilityStack `json:"observability_stack"`
}

type MeshSummaryControlPlane struct {
	Nodes  []MeshSummaryControlPlaneNode `json:"nodes"`
	Status string                        `json:"status"`
}

type MeshSummaryControlPlaneNode struct {
	Cluster   string `json:"cluster"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Version   string `json:"version"`
}

type MeshSummaryObservabilityStack struct {
	Grafana    string `json:"grafana,omitempty"`
	Jaeger     string `json:"jaeger,omitempty"`
	OTel       string `json:"otel,omitempty"`
	Perses     string `json:"perses,omitempty"`
	Prometheus string `json:"prometheus"`
	Tempo      string `json:"tempo,omitempty"`
	Zipkin     string `json:"zipkin,omitempty"`
}

type MeshSummaryDataPlane struct {
	MonitoredNamespaces []MeshSummaryMonitoredNamespace `json:"monitored_namespaces"`
}

type MeshSummaryMonitoredNamespace struct {
	Cluster   string `json:"cluster"`
	Health    string `json:"health"`
	IsAmbient bool   `json:"is_ambient,omitempty"`
	Name      string `json:"name"`
}

type MeshSummaryEdge struct {
	From        string `json:"from"`
	FromCluster string `json:"from_cluster,omitempty"`
	Note        string `json:"note,omitempty"`
	Status      string `json:"status,omitempty"`
	To          string `json:"to"`
	ToCluster   string `json:"to_cluster,omitempty"`
}

type MeshSummaryCriticalAlert struct {
	Cluster   string `json:"cluster,omitempty"`
	Component string `json:"component"`
	Impact    string `json:"impact"`
	Message   string `json:"message"`
}
