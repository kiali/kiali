package prompts

// Prompt represents a reusable chatbot prompt suggestion.
type Prompt struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	Name        string `json:"name"`
	Query       string `json:"query"`
	Title       string `json:"title"`
}

// Catalog returns the built-in prompt catalog.
// Prompts are grouped by category matching Kiali UI page sections.
func Catalog() []Prompt {
	return []Prompt{
		{
			Category:    "applications",
			Description: "List applications in the selected namespaces",
			Name:        "app-health",
			Query:       "List applications in the selected namespaces",
			Title:       "List Applications",
		},
		{
			Category:    "graph",
			Description: "Analyze the traffic topology showing service dependencies and traffic flow",
			Name:        "traffic-topology",
			Query:       "Analyze the traffic topology and show me the service dependencies",
			Title:       "Traffic Topology Analysis",
		},
		{
			Category:    "istio",
			Description: "List Istio configuration in the selected namespaces",
			Name:        "istio-config-list",
			Query:       "List Istio configuration in the selected namespaces",
			Title:       "List Istio Config",
		},
		{
			Category:    "mesh",
			Description: "Inspect the mesh topology including control plane components, data plane status, and cluster connectivity",
			Name:        "mesh-topology",
			Query:       "Show the mesh topology and report on control plane components and cluster connectivity",
			Title:       "Mesh Topology Overview",
		},
		{
			Category:    "namespaces",
			Description: "List all namespaces with their sidecar injection status and Istio labels",
			Name:        "namespace-overview",
			Query:       "List all namespaces and show their sidecar injection status and Istio labels",
			Title:       "Namespace Overview",
		},
		{
			Category:    "overview",
			Description: "Check the health of your service mesh including control plane and data plane status",
			Name:        "mesh-health-check",
			Query:       "Check the health of my service mesh and report any unhealthy namespaces",
			Title:       "Mesh Health Check",
		},
		{
			Category:    "services",
			Description: "List services in the selected namespaces",
			Name:        "service-list",
			Query:       "List services in the selected namespaces",
			Title:       "List Services",
		},
		{
			Category:    "services",
			Description: "Show the traffic topology for services in the selected namespaces",
			Name:        "service-traffic",
			Query:       "Show the traffic topology for services in the selected namespaces",
			Title:       "Service Traffic",
		},
		{
			Category:    "workloads",
			Description: "List workloads in the selected namespaces",
			Name:        "workload-list",
			Query:       "List workloads in the selected namespaces",
			Title:       "List Workloads",
		},
	}
}
