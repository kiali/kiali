package list_or_get_resources

// --- List response types ---

// ResourceListIstioFlags mirrors Istio dataplane flags for list rows (workloads, services).
type ResourceListIstioFlags struct {
	IstioInjectionAnnotation *bool `json:"istio_injection_annotation,omitempty"`
	IstioSidecar             bool  `json:"istio_sidecar"`
	IsAmbient                bool  `json:"is_ambient"`
	IsGateway                bool  `json:"is_gateway"`
	IsWaypoint               bool  `json:"is_waypoint"`
	IsZtunnel                bool  `json:"is_ztunnel"`
}

type ResourceListItem struct {
	Configuration string                  `json:"configuration"`
	Details       string                  `json:"details"`
	Health        string                  `json:"health"`
	Istio         *ResourceListIstioFlags `json:"istio,omitempty"`
	Labels        string                  `json:"labels"`
	Name          string                  `json:"name"`
	Namespace     string                  `json:"namespace"`
	Type          string                  `json:"type,omitempty"`
}

type AppIstioStatus struct {
	Ambient bool `json:"ambient"`
	Gateway bool `json:"gateway"`
	Sidecar bool `json:"sidecar"`
}

type AppIstioReference struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

type AppListItem struct {
	Health          string              `json:"health"`
	Istio           AppIstioStatus      `json:"istio"`
	IstioReferences []AppIstioReference `json:"istioReferences"`
	Name            string              `json:"name"`
	Namespace       string              `json:"namespace"`
	Versions        []string            `json:"versions"`
}

type AppListResponse struct {
	Applications []AppListItem `json:"applications"`
	Cluster      string        `json:"cluster"`
}

// --- Detail response types ---

type PortDetail struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type ServiceInfo struct {
	IP        string            `json:"ip"`
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Ports     []PortDetail      `json:"ports"`
	Selectors map[string]string `json:"selectors"`
	Type      string            `json:"type"`
}

type ServiceIstioConfig struct {
	DestinationRules []string `json:"destination_rules"`
	HasSidecar       bool     `json:"has_sidecar"`
	IsAmbient        bool     `json:"is_ambient"`
	MTLSMode         string   `json:"mtls_mode"`
	Validations      []string `json:"validations"`
	VirtualServices  []string `json:"virtual_services"`
}

type ServiceWorkloadInfo struct {
	IstioInjectionAnnotation *bool             `json:"istio_injection_annotation,omitempty"`
	IstioSidecar             bool              `json:"istio_sidecar"`
	IsAmbient                bool              `json:"is_ambient"`
	IsGateway                bool              `json:"is_gateway"`
	IsWaypoint               bool              `json:"is_waypoint"`
	IsZtunnel                bool              `json:"is_ztunnel"`
	Kind                     string            `json:"kind"`
	Labels                   map[string]string `json:"labels"`
	Name                     string            `json:"name"`
	PodCount                 int               `json:"pod_count"`
	ServiceAccount           string            `json:"service_account"`
}

type EndpointInfo struct {
	IP      string `json:"ip"`
	PodName string `json:"pod_name"`
}

type ServiceDetailResponse struct {
	Endpoints          []EndpointInfo        `json:"endpoints"`
	HealthStatus       string                `json:"health_status"`
	InboundSuccessRate string                `json:"inbound_success_rate_2xx"`
	IstioConfig        ServiceIstioConfig    `json:"istio_config"`
	Service            ServiceInfo           `json:"service"`
	Workloads          []ServiceWorkloadInfo `json:"workloads"`
}

type WorkloadInfo struct {
	CreatedAt      string            `json:"created_at"`
	Kind           string            `json:"kind"`
	Labels         map[string]string `json:"labels"`
	Name           string            `json:"name"`
	Namespace      string            `json:"namespace"`
	ServiceAccount string            `json:"service_account"`
}

type ReplicaStatus struct {
	Available int32 `json:"available"`
	Current   int32 `json:"current"`
	Desired   int32 `json:"desired"`
}

type TrafficSuccessRate struct {
	Inbound  string `json:"inbound"`
	Outbound string `json:"outbound"`
}

type WorkloadStatus struct {
	Overall            string             `json:"overall"`
	Replicas           ReplicaStatus      `json:"replicas"`
	TrafficSuccessRate TrafficSuccessRate `json:"traffic_success_rate"`
}

type SyncStatus struct {
	CDS string `json:"CDS"`
	EDS string `json:"EDS"`
	LDS string `json:"LDS"`
	RDS string `json:"RDS"`
}

type WorkloadIstioInfo struct {
	IstioInjectionAnnotation *bool       `json:"istio_injection_annotation,omitempty"`
	IstioSidecar             bool        `json:"istio_sidecar"`
	IsAmbient                bool        `json:"is_ambient"`
	IsGateway                bool        `json:"is_gateway"`
	IsWaypoint               bool        `json:"is_waypoint"`
	IsZtunnel                bool        `json:"is_ztunnel"`
	Mode                     string      `json:"mode"`
	ProxyVersion             string      `json:"proxy_version"`
	SyncStatus               *SyncStatus `json:"sync_status,omitempty"`
	Validations              []string    `json:"validations"`
}

type PodInfo struct {
	Containers []string `json:"containers"`
	IstioInit  string   `json:"istio_init"`
	IstioProxy string   `json:"istio_proxy"`
	Name       string   `json:"name"`
	Status     string   `json:"status"`
}

type WorkloadDetailResponse struct {
	AmbientNetworking  *AmbientNetworkingInfo `json:"ambientNetworking,omitempty"`
	AssociatedServices []string               `json:"associated_services"`
	Istio              WorkloadIstioInfo      `json:"istio"`
	Pods               []PodInfo              `json:"pods"`
	Status             WorkloadStatus         `json:"status"`
	Workload           WorkloadInfo           `json:"workload"`
	WaypointServices   []WaypointServiceInfo  `json:"waypointServices,omitempty"`
}

// WaypointServiceInfo contains information about services captured by a waypoint proxy
type WaypointServiceInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// AmbientNetworkingInfo contains ztunnel-specific networking details for Ambient workloads
type AmbientNetworkingInfo struct {
	Captured         bool                 `json:"captured"`
	CapturedServices []ZtunnelServiceInfo `json:"capturedServices,omitempty"`
	NetworkMode      string               `json:"networkMode,omitempty"` // "Standard", "HostNetwork"
	Node             string               `json:"node,omitempty"`        // Kubernetes node name
	Protocol         string               `json:"protocol,omitempty"`    // "HBONE", "TCP"
	Status           string               `json:"status,omitempty"`      // "Healthy", "Unhealthy"
	TrustDomain      string               `json:"trustDomain,omitempty"` // "cluster.local"
}

// ZtunnelServiceInfo contains service-level ztunnel configuration
type ZtunnelServiceInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Vips      []string `json:"vips"`
	Waypoint  string   `json:"waypoint,omitempty"` // "namespace/workload"
}

type AppWorkloadInfo struct {
	IstioSidecar   bool   `json:"istioSidecar"`
	IsAmbient      bool   `json:"isAmbient"`
	Kind           string `json:"kind"`
	Name           string `json:"name"`
	Replicas       string `json:"replicas"`
	ServiceAccount string `json:"service_account"`
	Version        string `json:"version"`
}

type AppIstioContext struct {
	IsAmbient          bool   `json:"isAmbient"`
	NamespaceInjection string `json:"namespaceInjection"`
}

type AppDetailResponse struct {
	App          string            `json:"app"`
	Cluster      string            `json:"cluster"`
	Health       string            `json:"health"`
	IstioContext AppIstioContext   `json:"istioContext"`
	Namespace    string            `json:"namespace"`
	Services     []string          `json:"services"`
	Workloads    []AppWorkloadInfo `json:"workloads"`
}

// --- ArgoCD Application types ---

type ArgoCDAppSource struct {
	Path           string `json:"path,omitempty"`
	RepoURL        string `json:"repoURL"`
	TargetRevision string `json:"targetRevision,omitempty"`
}

type ArgoCDAppDestination struct {
	Namespace string `json:"namespace"`
	Server    string `json:"server"`
}

type ArgoCDAppSyncStatus struct {
	Revision string `json:"revision"`
	Status   string `json:"status"`
}

type ArgoCDAppHealthStatus struct {
	Message string `json:"message,omitempty"`
	Status  string `json:"status"`
}

type ArgoCDRevisionHistoryEntry struct {
	DeployedAt string          `json:"deployedAt,omitempty"`
	ID         int64           `json:"id"`
	Revision   string          `json:"revision"`
	Source     ArgoCDAppSource `json:"source"`
}

type ArgoCDManagedResource struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	Status    string `json:"status,omitempty"`
}

type ArgoCDOperationState struct {
	FinishedAt string `json:"finishedAt,omitempty"`
	Message    string `json:"message,omitempty"`
	Phase      string `json:"phase"`
}

type ArgoCDAppDetailResponse struct {
	Cluster         string                       `json:"cluster"`
	Destination     ArgoCDAppDestination         `json:"destination"`
	Health          ArgoCDAppHealthStatus        `json:"health"`
	Name            string                       `json:"name"`
	Namespace       string                       `json:"namespace"`
	OperationState  *ArgoCDOperationState        `json:"operationState,omitempty"`
	Project         string                       `json:"project"`
	Resources       []ArgoCDManagedResource      `json:"resources"`
	RevisionHistory []ArgoCDRevisionHistoryEntry `json:"revisionHistory"`
	Source          ArgoCDAppSource              `json:"source"`
	SourceType      string                       `json:"sourceType,omitempty"`
	Sync            ArgoCDAppSyncStatus          `json:"sync"`
}

type ArgoCDAppListItem struct {
	Health     string `json:"health"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	RepoURL    string `json:"repoURL,omitempty"`
	SyncStatus string `json:"syncStatus"`
}

type ArgoCDAppListResponse struct {
	Applications []ArgoCDAppListItem `json:"applications"`
	Cluster      string              `json:"cluster"`
}
