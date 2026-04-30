package list_or_get_resources

type NamespaceValidationSummary struct {
	Objects int `json:"objects"`
}

type NamespaceCounts struct {
	Apps      int `json:"apps"`
	Services  int `json:"services"`
	Workloads int `json:"workloads"`
}

type NamespaceListItem struct {
	Counts         *NamespaceCounts            `json:"counts,omitempty"`
	Health         string                      `json:"health"`
	Injection      string                      `json:"injection"`
	IsControlPlane bool                        `json:"isControlPlane,omitempty"`
	MTLS           string                      `json:"mTLS,omitempty"`
	Name           string                      `json:"name"`
	Validations    *NamespaceValidationSummary `json:"validations,omitempty"`
}

type NamespaceListResponse struct {
	Cluster    string              `json:"cluster"`
	Namespaces []NamespaceListItem `json:"namespaces"`
}

type NamespaceIstioContext struct {
	Discovery string `json:"discovery,omitempty"`
	Injection string `json:"injection"`
	Revision  string `json:"revision,omitempty"`
}

type NamespaceDetailResponse struct {
	Cluster      string                `json:"cluster"`
	Counts       NamespaceCounts       `json:"counts"`
	IstioContext NamespaceIstioContext `json:"istioContext"`
	Namespace    string                `json:"namespace"`
}
