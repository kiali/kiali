package kubernetes

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// Networking
	DestinationRuleType = "DestinationRule"
	GatewayType         = "Gateway"
	EnvoyFilterType     = "EnvoyFilter"
	SidecarType         = "Sidecar"
	ServiceEntryType    = "ServiceEntry"
	VirtualServiceType  = "VirtualService"
	WorkloadEntryType   = "WorkloadEntry"
	WorkloadGroupType   = "WorkloadGroup"
	WasmPluginType      = "WasmPlugin"
	TelemetryType       = "Telemetry"

	// K8s Networking
	K8sGatewayType        = "Gateway"
	K8sGatewayClassType   = "GatewayClass"
	K8sGRPCRouteType      = "GRPCRoute"
	K8sHTTPRouteType      = "HTTPRoute"
	K8sReferenceGrantType = "ReferenceGrant"
	K8sTCPRouteType       = "TCPRoute"
	K8sTLSRouteType       = "TLSRoute"

	// Authorization PeerAuthentications
	AuthorizationPoliciesType = "AuthorizationPolicy"

	// Peer Authentications
	PeerAuthenticationsType = "PeerAuthentication"

	// Request Authentications
	RequestAuthenticationsType = "RequestAuthentication"

	// Kubernetes Controllers
	ConfigMapType             = "ConfigMap"
	CronJobType               = "CronJob"
	DaemonSetType             = "DaemonSet"
	DeploymentType            = "Deployment"
	DeploymentConfigType      = "DeploymentConfig"
	EndpointsType             = "Endpoints"
	JobType                   = "Job"
	PodType                   = "Pod"
	ReplicationControllerType = "ReplicationController"
	ReplicaSetType            = "ReplicaSet"
	ServiceType               = "Service"
	StatefulSetType           = "StatefulSet"
)

var (
	// Networking
	DestinationRules = NetworkingGroupVersionV1.WithKind(DestinationRuleType)
	Gateways         = NetworkingGroupVersionV1.WithKind(GatewayType)
	EnvoyFilters     = NetworkingGroupVersionV1Alpha3.WithKind(EnvoyFilterType)
	Sidecars         = NetworkingGroupVersionV1.WithKind(SidecarType)
	ServiceEntries   = NetworkingGroupVersionV1.WithKind(ServiceEntryType)
	VirtualServices  = NetworkingGroupVersionV1.WithKind(VirtualServiceType)
	WorkloadEntries  = NetworkingGroupVersionV1.WithKind(WorkloadEntryType)
	WorkloadGroups   = NetworkingGroupVersionV1.WithKind(WorkloadGroupType)
	WasmPlugins      = ExtensionGroupVersionV1Alpha1.WithKind(WasmPluginType)
	Telemetries      = TelemetryGroupV1.WithKind(TelemetryType)

	// K8s Networking
	K8sGateways        = K8sNetworkingGroupVersionV1.WithKind(K8sGatewayType)
	K8sGatewayClasses  = K8sNetworkingGroupVersionV1.WithKind(K8sGatewayClassType)
	K8sGRPCRoutes      = K8sNetworkingGroupVersionV1.WithKind(K8sGRPCRouteType)
	K8sHTTPRoutes      = K8sNetworkingGroupVersionV1.WithKind(K8sHTTPRouteType)
	K8sReferenceGrants = K8sNetworkingGroupVersionV1Beta1.WithKind(K8sReferenceGrantType)
	K8sTCPRoutes       = K8sNetworkingGroupVersionV1Alpha2.WithKind(K8sTCPRouteType)
	K8sTLSRoutes       = K8sNetworkingGroupVersionV1Alpha2.WithKind(K8sTLSRouteType)

	// Authorization PeerAuthentications
	AuthorizationPolicies = SecurityGroupVersionV1.WithKind(AuthorizationPoliciesType)

	// Peer Authentications
	PeerAuthentications = SecurityGroupVersionV1.WithKind(PeerAuthenticationsType)

	// Request Authentications
	RequestAuthentications = SecurityGroupVersionV1.WithKind(RequestAuthenticationsType)

	// Kubernetes Controllers
	ConfigMaps             = CoreGroupVersionV1.WithKind(ConfigMapType)
	CronJobs               = BatchGroupVersionV1.WithKind(CronJobType)
	DaemonSets             = AppsGroupVersionV1.WithKind(DaemonSetType)
	Deployments            = AppsGroupVersionV1.WithKind(DeploymentType)
	DeploymentConfigs      = AppsOpenShiftGroupVersionV1.WithKind(DeploymentConfigType)
	Endpoints              = CoreGroupVersionV1.WithKind(EndpointsType)
	Jobs                   = BatchGroupVersionV1.WithKind(JobType)
	Pods                   = CoreGroupVersionV1.WithKind(PodType)
	ReplicationControllers = CoreGroupVersionV1.WithKind(ReplicationControllerType)
	ReplicaSets            = AppsGroupVersionV1.WithKind(ReplicaSetType)
	Services               = CoreGroupVersionV1.WithKind(ServiceType)
	StatefulSets           = AppsGroupVersionV1.WithKind(StatefulSetType)

	// Group Versions
	CoreGroupVersionV1 = schema.GroupVersion{
		Group:   "",
		Version: "v1",
	}

	BatchGroupVersionV1 = schema.GroupVersion{
		Group:   "batch",
		Version: "v1",
	}

	AppsGroupVersionV1 = schema.GroupVersion{
		Group:   "apps",
		Version: "v1",
	}

	AppsOpenShiftGroupVersionV1 = schema.GroupVersion{
		Group:   "apps.openshift.io",
		Version: "v1",
	}

	NetworkingGroupVersionV1Alpha3 = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1alpha3",
	}

	NetworkingGroupVersionV1 = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1",
	}

	K8sNetworkingGroupVersionV1Alpha2 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1alpha2",
	}

	K8sNetworkingGroupVersionV1Beta1 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1beta1",
	}

	K8sNetworkingGroupVersionV1 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1",
	}

	SecurityGroupVersionV1 = schema.GroupVersion{
		Group:   "security.istio.io",
		Version: "v1",
	}

	ExtensionGroupVersionV1Alpha1 = schema.GroupVersion{
		Group:   "extensions.istio.io",
		Version: "v1alpha1",
	}

	TelemetryGroupV1 = schema.GroupVersion{
		Group:   "telemetry.istio.io",
		Version: "v1",
	}

	// Resources
	ResourceTypesToAPI = map[string]schema.GroupVersionKind{
		DestinationRules.String(): DestinationRules,
		EnvoyFilters.String():     EnvoyFilters,
		Gateways.String():         Gateways,
		ServiceEntries.String():   ServiceEntries,
		Sidecars.String():         Sidecars,
		VirtualServices.String():  VirtualServices,
		WorkloadEntries.String():  WorkloadEntries,
		WorkloadGroups.String():   WorkloadGroups,
		WasmPlugins.String():      WasmPlugins,
		Telemetries.String():      Telemetries,

		K8sGateways.String():        K8sGateways,
		K8sGRPCRoutes.String():      K8sGRPCRoutes,
		K8sHTTPRoutes.String():      K8sHTTPRoutes,
		K8sReferenceGrants.String(): K8sReferenceGrants,
		K8sTCPRoutes.String():       K8sTCPRoutes,
		K8sTLSRoutes.String():       K8sTLSRoutes,

		AuthorizationPolicies.String():  AuthorizationPolicies,
		PeerAuthentications.String():    PeerAuthentications,
		RequestAuthentications.String(): RequestAuthentications,
	}
)

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules        []*networking_v1.DestinationRule  `json:"destinationrules"`
	MeshPeerAuthentications []*security_v1.PeerAuthentication `json:"meshpeerauthentications"`
	PeerAuthentications     []*security_v1.PeerAuthentication `json:"peerauthentications"`
	EnabledAutoMtls         bool                              `json:"enabledautomtls"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	AuthorizationPolicies []*security_v1.AuthorizationPolicy `json:"authorizationpolicies"`
}

type ProxyStatus struct {
	Pilot string
	SyncStatus
}

// SyncStatus is the synchronization status between Pilot and a given Envoy
type SyncStatus struct {
	ClusterID     string `json:"cluster_id,omitempty"`
	ProxyID       string `json:"proxy,omitempty"`
	ProxyVersion  string `json:"proxy_version,omitempty"`
	IstioVersion  string `json:"istio_version,omitempty"`
	ClusterSent   string `json:"cluster_sent,omitempty"`
	ClusterAcked  string `json:"cluster_acked,omitempty"`
	ListenerSent  string `json:"listener_sent,omitempty"`
	ListenerAcked string `json:"listener_acked,omitempty"`
	RouteSent     string `json:"route_sent,omitempty"`
	RouteAcked    string `json:"route_acked,omitempty"`
	EndpointSent  string `json:"endpoint_sent,omitempty"`
	EndpointAcked string `json:"endpoint_acked,omitempty"`
}

type RegistryService struct {
	Pilot string
	IstioService
}

// Mapped from https://github.com/istio/istio/blob/master/pilot/pkg/model/service.go
// It's a helper to fetch the /debug/registryz results before to parse it to the Kiali's Service model
// Not all fields from /debug/registryz are mapped, only those needed by Kiali
// There may be differences between Istio 1.11.x and 1.12.x to be addressed case by case in the mapping
type IstioService struct {
	Attributes struct {
		// ServiceRegistry values:
		// Kubernetes: 	is a service registry backed by k8s API server
		// External: 	is a service registry for externally provided ServiceEntries
		// Federation:  special case when registry is provided from a federated environment
		ServiceRegistry string            `json:"ServiceRegistry,omitempty"`
		Name            string            `json:"Name,omitempty"`
		Namespace       string            `json:"Namespace,omitempty"`
		Labels          map[string]string `json:"Labels,omitempty"`
		// ExportTo key values:
		// ".":		Private implies namespace local config
		// "*":		Public implies config is visible to all
		// "~":		None implies service is visible to no one. Used for services only
		ExportTo       map[string]struct{} `json:"ExportTo,omitempty"`
		LabelSelectors map[string]string   `json:"LabelSelectors,omitempty"`
		// ClusterExternalAddresses and ClusterExternalPorts are not mapped into the model
		// Kiali won't use it yet and these attributes changes between Istio 1.11.x and Istio 1.12.x and may bring conflicts
	} `json:"Attributes,omitempty"`
	Ports []struct {
		Name     string `json:"name,omitempty"`
		Port     int    `json:"port"`
		Protocol string `json:"protocol,omitempty"`
	} `json:"ports"`
	Hostname        string `json:"hostname"`
	ResourceVersion string `json:"ResourceVersion"`
	// ClusterVIPs defined in Istio 1.11.x
	ClusterVIPs11 map[string]string `json:"cluster-vips,omitempty"`
	// ClusterVIPs defined in Istio 1.12.x
	ClusterVIPs12 struct {
		Addresses map[string][]string `json:"Addresses,omitempty"`
	} `json:"clusterVIPs,omitempty"`
}

type RegistryStatus struct {
	Services []*RegistryService
}

func GetPatchType(patchType string) types.PatchType {
	switch patchType {
	case "json":
		return types.JSONPatchType
	case "strategic":
		return types.StrategicMergePatchType
	case "apply":
		return types.ApplyPatchType
	case "merge":
		return types.MergePatchType
	default:
		return types.MergePatchType
	}
}
