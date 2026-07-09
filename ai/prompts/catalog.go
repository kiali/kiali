package prompts

// Prompt represents a reusable chatbot prompt suggestion.
type Prompt struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	IsAmbient   bool   `json:"isAmbient"`
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
			Category:    "application-details",
			Description: "Analyze the current application for health issues, traffic anomalies, and missing sidecars",
			Name:        "app-details-troubleshooting",
			Query:       "Analyze the current application and report health issues, traffic anomalies, missing sidecars, and the next troubleshooting steps.",
			Title:       "Application Troubleshooting",
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
			Category:    "istio-details",
			Description: "Review the current Istio object for misconfiguration, ineffective rules, or traffic impact",
			Name:        "istio-object-review",
			Query:       "Analyze the current Istio configuration object and report possible misconfigurations, ineffective rules, traffic impact, and the next troubleshooting steps.",
			Title:       "Istio Object Review",
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
			Category:    "namespace-details",
			Description: "Analyze the current namespace for health issues, injection problems, and Istio config issues",
			Name:        "namespace-troubleshooting",
			Query:       "Analyze the current namespace and report health problems, missing sidecar injection, Istio configuration issues, and the next troubleshooting steps.",
			Title:       "Namespace Troubleshooting",
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
			Category:    "service-details",
			Description: "Analyze the current service for health issues, unusual traffic, and related workload problems",
			Name:        "service-troubleshooting",
			Query:       "Analyze the current service and report unusual traffic patterns, health issues, related workload problems, and likely configuration issues.",
			Title:       "Service Troubleshooting",
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
		{
			Category:    "workload-details",
			Description: "Analyze the current workload for degraded status, traffic anomalies, and sidecar issues",
			Name:        "workload-troubleshooting",
			Query:       "Analyze the current workload and report degraded status, traffic anomalies, sidecar issues, and the next troubleshooting steps.",
			Title:       "Workload Troubleshooting",
		},

		// Ambient Mesh prompts — only shown when Ambient Mesh is enabled in at least one cluster
		{
			Category:    "mesh",
			Description: "Check if Ambient Mesh is enabled and get ztunnel DaemonSet status across clusters",
			IsAmbient:   true,
			Name:        "ambient-mesh-status",
			Query:       "Check if Ambient Mesh is enabled in my clusters. Show ztunnel DaemonSet status, pod health per node, and which namespaces are in Ambient mode.",
			Title:       "Ambient Mesh Status",
		},
		{
			Category:    "namespaces",
			Description: "List namespaces with their Ambient mode status and identify which ones need waypoints",
			IsAmbient:   true,
			Name:        "ambient-namespace-overview",
			Query:       "List all namespaces with their Ambient status. Identify which namespaces are in Ambient mode, which have waypoints deployed, and analyze all Istio configs across Ambient namespaces to determine which need waypoints for L7 features.",
			Title:       "Ambient Namespace Overview",
		},
		{
			Category:    "namespace-details",
			Description: "Analyze all Istio configs in this namespace for Ambient compatibility (L4 vs L7)",
			IsAmbient:   true,
			Name:        "ambient-config-analysis",
			Query:       "Analyze all Istio configurations in the current namespace for Ambient Mesh compatibility. Show which configs are L4 (ztunnel-processed) vs L7 (waypoint-required) including AuthorizationPolicies, VirtualServices, DestinationRules, RequestAuthentications, PeerAuthentications, WasmPlugins, and Telemetry. Warn if L7 configs exist without a waypoint.",
			Title:       "Ambient Config Analysis",
		},
		{
			Category:    "workload-details",
			Description: "Show ztunnel networking details for this Ambient workload (protocol, captured services, waypoint)",
			IsAmbient:   true,
			Name:        "ambient-workload-networking",
			Query:       "Show detailed Ambient networking information for the current workload. Include ztunnel capture status, protocol (HBONE/TCP), network mode, captured services with VIPs, and waypoint configuration.",
			Title:       "Ambient Workload Networking",
		},
		{
			Category:    "workload-details",
			Description: "For waypoint proxies, show which services they are capturing and enforcing policies for",
			IsAmbient:   true,
			Name:        "waypoint-captured-services",
			Query:       "If this workload is a waypoint proxy, show which services it is capturing and enforcing L7 policies for. Include service names and namespaces.",
			Title:       "Waypoint Captured Services",
		},
		{
			Category:    "graph",
			Description: "Show traffic topology filtered to Ambient Mesh waypoint-reported traffic only",
			IsAmbient:   true,
			Name:        "ambient-waypoint-traffic",
			Query:       "Show the traffic topology for the selected namespaces, filtered to show only waypoint-reported traffic. This helps visualize L7 traffic flow in Ambient mode.",
			Title:       "Ambient Waypoint Traffic",
		},
		{
			Category:    "istio",
			Description: "Review all Istio configs across namespaces for Ambient compatibility issues",
			IsAmbient:   true,
			Name:        "ambient-config-audit",
			Query:       "Audit all Istio configurations across all Ambient namespaces. Report L7 configs (AuthorizationPolicies, VirtualServices, RequestAuthentications, DestinationRules, WasmPlugins, Telemetry) in namespaces without waypoints, and recommend where waypoints should be deployed.",
			Title:       "Ambient Config Audit",
		},
	}
}
