package kubernetes

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// Networking
	DestinationRuleType  = "DestinationRule"
	EnvoyFilterType      = "EnvoyFilter"
	GatewayType          = "Gateway"
	ServiceEntryType     = "ServiceEntry"
	SidecarType          = "Sidecar"
	TelemetryType        = "Telemetry"
	TrafficExtensionType = "TrafficExtension"
	VirtualServiceType   = "VirtualService"
	WasmPluginType       = "WasmPlugin"
	WorkloadEntryType    = "WorkloadEntry"
	WorkloadGroupType    = "WorkloadGroup"

	// K8s Networking
	K8sGatewayType        = "Gateway"
	K8sGatewayClassType   = "GatewayClass"
	K8sGRPCRouteType      = "GRPCRoute"
	K8sHTTPRouteType      = "HTTPRoute"
	K8sInferencePoolsType = "InferencePool"
	K8sReferenceGrantType = "ReferenceGrant"
	K8sTCPRouteType       = "TCPRoute"
	K8sTLSRouteType       = "TLSRoute"
	K8sUDPRouteType       = "UDPRoute"

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
	JobType                   = "Job"
	PodType                   = "Pod"
	ReplicationControllerType = "ReplicationController"
	ReplicaSetType            = "ReplicaSet"
	ServiceType               = "Service"
	StatefulSetType           = "StatefulSet"
)

var (
	// Networking
	DestinationRules  = NetworkingGroupVersionV1.WithKind(DestinationRuleType)
	EnvoyFilters      = NetworkingGroupVersionV1Alpha3.WithKind(EnvoyFilterType)
	Gateways          = NetworkingGroupVersionV1.WithKind(GatewayType)
	ServiceEntries    = NetworkingGroupVersionV1.WithKind(ServiceEntryType)
	Sidecars          = NetworkingGroupVersionV1.WithKind(SidecarType)
	Telemetries       = TelemetryGroupV1.WithKind(TelemetryType)
	TrafficExtensions = ExtensionGroupVersionV1Alpha1.WithKind(TrafficExtensionType)
	VirtualServices   = NetworkingGroupVersionV1.WithKind(VirtualServiceType)
	WasmPlugins       = ExtensionGroupVersionV1Alpha1.WithKind(WasmPluginType)
	WorkloadEntries   = NetworkingGroupVersionV1.WithKind(WorkloadEntryType)
	WorkloadGroups    = NetworkingGroupVersionV1.WithKind(WorkloadGroupType)

	// K8s Networking
	K8sGateways        = K8sNetworkingGroupVersionV1.WithKind(K8sGatewayType)
	K8sGatewayClasses  = K8sNetworkingGroupVersionV1.WithKind(K8sGatewayClassType)
	K8sGRPCRoutes      = K8sNetworkingGroupVersionV1.WithKind(K8sGRPCRouteType)
	K8sHTTPRoutes      = K8sNetworkingGroupVersionV1.WithKind(K8sHTTPRouteType)
	K8sInferencePools  = K8sInferenceGroupVersionV1.WithKind(K8sInferencePoolsType)
	K8sReferenceGrants = K8sNetworkingGroupVersionV1Beta1.WithKind(K8sReferenceGrantType)
	K8sTCPRoutes       = K8sNetworkingGroupVersionV1.WithKind(K8sTCPRouteType)
	K8sTLSRoutes       = K8sNetworkingGroupVersionV1.WithKind(K8sTLSRouteType)
	K8sUDPRoutes       = K8sNetworkingGroupVersionV1.WithKind(K8sUDPRouteType)

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

	K8sInferenceGroupVersionV1 = schema.GroupVersion{
		Group:   "inference.networking.k8s.io",
		Version: "v1",
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

	// PluralNames maps Kind to the lowercase plural resource name used in RBAC.
	// Kubernetes SSAR ResourceAttributes.Resource requires the plural form.
	PluralNames = map[string]string{
		K8sGatewayType:        "gateways",
		K8sGatewayClassType:   "gatewayclasses",
		K8sGRPCRouteType:      "grpcroutes",
		K8sHTTPRouteType:      "httproutes",
		K8sInferencePoolsType: "inferencepools",
		K8sReferenceGrantType: "referencegrants",
		K8sTCPRouteType:       "tcproutes",
		K8sTLSRouteType:       "tlsroutes",
		K8sUDPRouteType:       "udproutes",
	}

	// Resources
	ResourceTypesToAPI = map[string]schema.GroupVersionKind{
		DestinationRules.String():  DestinationRules,
		EnvoyFilters.String():      EnvoyFilters,
		Gateways.String():          Gateways,
		ServiceEntries.String():    ServiceEntries,
		Sidecars.String():          Sidecars,
		Telemetries.String():       Telemetries,
		TrafficExtensions.String(): TrafficExtensions,
		VirtualServices.String():   VirtualServices,
		WasmPlugins.String():       WasmPlugins,
		WorkloadEntries.String():   WorkloadEntries,
		WorkloadGroups.String():    WorkloadGroups,

		K8sGateways.String():        K8sGateways,
		K8sGRPCRoutes.String():      K8sGRPCRoutes,
		K8sHTTPRoutes.String():      K8sHTTPRoutes,
		K8sInferencePools.String():  K8sInferencePools,
		K8sReferenceGrants.String(): K8sReferenceGrants,
		K8sTCPRoutes.String():       K8sTCPRoutes,
		K8sTLSRoutes.String():       K8sTLSRoutes,
		K8sUDPRoutes.String():       K8sUDPRoutes,

		AuthorizationPolicies.String():  AuthorizationPolicies,
		PeerAuthentications.String():    PeerAuthentications,
		RequestAuthentications.String(): RequestAuthentications,
	}
)

// PluralResourceName returns the RBAC plural resource name for a Kind.
// Uses the PluralNames map for types with explicit RBAC rules; falls back
// to the Kind itself for types that still use wildcard resources: ["*"].
func PluralResourceName(kind string) string {
	if plural, ok := PluralNames[kind]; ok {
		return plural
	}
	return kind
}

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
