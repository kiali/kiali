package models

import "k8s.io/apimachinery/pkg/runtime/schema"

type ClusterApps struct {
	// Applications list for namespaces of a single cluster
	// required: true
	Apps []AppListItem `json:"applications"`

	// Cluster where the apps live in
	// required: true
	// example: east
	Cluster string `json:"cluster"`
}

type AppList struct {
	// Namespace where the apps live in
	// required: true
	// example: bookinfo
	Namespace Namespace `json:"namespace"`

	// Cluster where the apps live in
	// required: true
	// example: east
	Cluster string `json:"cluster"`

	// Applications for a given namespace
	// required: true
	Apps []AppListItem `json:"applications"`
}

// AppListItem has the necessary information to display the console app list
type AppListItem struct {
	// Name of the application
	// required: true
	// example: reviews
	Name string `json:"name"`

	// Namespace of the application
	Namespace string `json:"namespace"`

	// The kube cluster where this application is located.
	Cluster string `json:"cluster"`

	// Define if all Pods related to the Workloads of this app has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`

	// Define if any pod has the Ambient annotation
	// required: true
	// example: true
	IsAmbient bool `json:"isAmbient"`

	// Define if Labels related to this Workload contains any Gateway label
	// required: true
	// example: true
	IsGateway bool `json:"isGateway"`

	// Labels for App
	Labels map[string]string `json:"labels"`

	// Istio References
	IstioReferences []*IstioValidationKey `json:"istioReferences"`

	// Health
	Health AppHealth `json:"health,omitempty"`
}

type WorkloadItem struct {
	// Name of a workload member of an application
	// required: true
	// example: reviews-v1
	WorkloadName string `json:"workloadName"`

	// Group Version Kind of the workload
	// required: true
	// example: 'apps/v1, Kind=Deployment'
	WorkloadGVK schema.GroupVersionKind `json:"workloadGVK"`

	// Define if all Pods related to the Workload has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`

	// Define if belongs to a namespace labeled as ambient
	// required: true
	// example: true
	IsAmbient bool `json:"isAmbient"`

	// Labels for Workload
	Labels map[string]string `json:"labels"`

	// List of service accounts involved in this application
	// required: true
	ServiceAccountNames []string `json:"serviceAccountNames"`
}

type App struct {
	// Namespace where the app lives in
	// required: true
	// example: bookinfo
	Namespace Namespace `json:"namespace"`

	// Name of the application
	// required: true
	// example: reviews
	Name string `json:"name"`

	// Cluster of the application
	// required: false
	// example: east
	Cluster string `json:"cluster"`

	// Define if all the workloads are ambient
	// required: true
	// example: true
	IsAmbient bool `json:"isAmbient"`

	// Workloads for a given application
	// required: true
	Workloads []WorkloadItem `json:"workloads"`

	// List of service names linked with an application
	// required: true
	ServiceNames []string `json:"serviceNames"`

	// Runtimes and associated dashboards
	Runtimes []Runtime `json:"runtimes"`

	// Health
	Health AppHealth `json:"health"`
}
