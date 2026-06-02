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
			Description: "Report applications that may need attention, including health issues or missing sidecars",
			Name:        "app-health",
			Query:       "Analyze the applications currently shown and report only the ones that may need attention, including health issues, traffic anomalies, or missing sidecars.",
			Title:       "Application Health Analysis",
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
			Description: "Highlight Istio objects that may be misconfigured or likely to impact traffic",
			Name:        "istio-config-review",
			Query:       "Review the Istio configuration currently shown and highlight objects that may be misconfigured, ineffective, or likely to impact traffic.",
			Title:       "Istio Config Review",
		},
		{
			Category:    "mesh",
			Description: "Summarize mesh health with control plane status, cluster connectivity, and any warnings",
			Name:        "mesh-health-summary",
			Query:       "Summarize the current mesh health. Include control plane status, cluster connectivity, and only the most important warnings or unhealthy components.",
			Title:       "Mesh Health Summary",
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
			Description: "Highlight services with unhealthy behavior, unusual traffic patterns, or configuration issues",
			Name:        "service-health",
			Query:       "Review the services currently shown and highlight only services with unhealthy behavior, unusual traffic patterns, or likely configuration issues.",
			Title:       "Service Health Analysis",
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
			Description: "Report degraded workloads, missing sidecars, or other issues that may need troubleshooting",
			Name:        "workload-health",
			Query:       "Check the workloads currently shown and report degraded workloads, missing sidecars, or other issues that may need troubleshooting.",
			Title:       "Workload Health Analysis",
		},
	}
}
