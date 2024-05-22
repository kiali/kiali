package kubernetes

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

const (
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

	// Networking

	DestinationRules    = "destinationrules"
	DestinationRuleType = "DestinationRule"

	Gateways    = "gateways"
	GatewayType = "Gateway"

	EnvoyFilters    = "envoyfilters"
	EnvoyFilterType = "EnvoyFilter"

	Sidecars    = "sidecars"
	SidecarType = "Sidecar"

	ServiceEntries   = "serviceentries"
	ServiceEntryType = "ServiceEntry"

	VirtualServices    = "virtualservices"
	VirtualServiceType = "VirtualService"

	WorkloadEntries   = "workloadentries"
	WorkloadEntryType = "WorkloadEntry"

	WorkloadGroups    = "workloadgroups"
	WorkloadGroupType = "WorkloadGroup"

	WasmPlugins    = "wasmplugins"
	WasmPluginType = "WasmPlugin"

	Telemetries   = "telemetries"
	TelemetryType = "Telemetry"

	// K8s Networking

	K8sGateways    = "k8sgateways"
	K8sGatewayType = "K8sGateway"
	// K8sActualGatewayType There is a naming conflict between Istio and K8s Gateways, keeping here an actual type to show in YAML editor
	K8sActualGatewayType = "Gateway"
	K8sActualGateways    = "gateways"

	K8sGatewayClasses       = "k8sgatewayclasses"
	K8sGatewayClassType     = "GatewayClass"
	K8sActualGatewayClasses = "gatewayclasses"

	K8sGRPCRoutes          = "k8sgrpcroutes"
	K8sGRPCRouteType       = "K8sGRPCRoute"
	K8sActualGRPCRouteType = "GRPCRoute"
	K8sActualGRPCRoutes    = "grpcroutes"

	K8sHTTPRoutes    = "k8shttproutes"
	K8sHTTPRouteType = "K8sHTTPRoute"
	// K8sActualHTTPRouteType There is a naming conflict between Istio and K8s Gateways, keeping here an actual type to show in YAML editor
	K8sActualHTTPRouteType = "HTTPRoute"
	K8sActualHTTPRoutes    = "httproutes"

	K8sReferenceGrants          = "k8sreferencegrants"
	K8sReferenceGrantType       = "K8sReferenceGrant"
	K8sActualReferenceGrantType = "ReferenceGrant"
	K8sActualReferenceGrants    = "referencegrants"

	K8sTCPRoutes          = "k8stcproutes"
	K8sTCPRouteType       = "K8sTCPRoute"
	K8sActualTCPRouteType = "TCPRoute"
	K8sActualTCPRoutes    = "tcproutes"

	K8sTLSRoutes          = "k8stlsroutes"
	K8sTLSRouteType       = "K8sTLSRoute"
	K8sActualTLSRouteType = "TLSRoute"
	K8sActualTLSRoutes    = "tlsroutes"

	// Authorization PeerAuthentications
	AuthorizationPolicies     = "authorizationpolicies"
	AuthorizationPoliciesType = "AuthorizationPolicy"

	// Peer Authentications
	PeerAuthentications     = "peerauthentications"
	PeerAuthenticationsType = "PeerAuthentication"

	// Request Authentications
	RequestAuthentications     = "requestauthentications"
	RequestAuthenticationsType = "RequestAuthentication"
)

var (
	NetworkingGroupVersionV1Alpha3 = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1alpha3",
	}
	ApiNetworkingVersionV1Alpha3 = NetworkingGroupVersionV1Alpha3.Group + "/" + NetworkingGroupVersionV1Alpha3.Version

	K8sNetworkingGroupVersionV1Alpha2 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1alpha2",
	}
	K8sApiNetworkingVersionV1Alpha2 = K8sNetworkingGroupVersionV1Alpha2.Group + "/" + K8sNetworkingGroupVersionV1Alpha2.Version

	K8sNetworkingGroupVersionV1Beta1 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1beta1",
	}
	K8sApiNetworkingVersionV1Beta1 = K8sNetworkingGroupVersionV1Beta1.Group + "/" + K8sNetworkingGroupVersionV1Beta1.Version

	K8sNetworkingGroupVersionV1 = schema.GroupVersion{
		Group:   "gateway.networking.k8s.io",
		Version: "v1",
	}
	K8sApiNetworkingVersionV1 = K8sNetworkingGroupVersionV1.Group + "/" + K8sNetworkingGroupVersionV1.Version

	NetworkingGroupVersionV1Beta1 = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1beta1",
	}
	ApiNetworkingVersionV1Beta1 = NetworkingGroupVersionV1Beta1.Group + "/" + NetworkingGroupVersionV1Beta1.Version

	SecurityGroupVersion = schema.GroupVersion{
		Group:   "security.istio.io",
		Version: "v1beta1",
	}
	ApiSecurityVersion = SecurityGroupVersion.Group + "/" + SecurityGroupVersion.Version

	ExtensionGroupVersionV1Alpha1 = schema.GroupVersion{
		Group:   "extensions.istio.io",
		Version: "v1alpha1",
	}
	ApiExtensionV1Alpha1 = ExtensionGroupVersionV1Alpha1.Group + "/" + ExtensionGroupVersionV1Alpha1.Version

	TelemetryGroupV1Alpha1 = schema.GroupVersion{
		Group:   "telemetry.istio.io",
		Version: "v1alpha1",
	}
	ApiTelemetryV1Alpha1 = TelemetryGroupV1Alpha1.Group + "/" + TelemetryGroupV1Alpha1.Version

	PluralType = map[string]string{
		// Networking
		Gateways:         GatewayType,
		VirtualServices:  VirtualServiceType,
		DestinationRules: DestinationRuleType,
		ServiceEntries:   ServiceEntryType,
		Sidecars:         SidecarType,
		WorkloadEntries:  WorkloadEntryType,
		WorkloadGroups:   WorkloadGroupType,
		EnvoyFilters:     EnvoyFilterType,
		WasmPlugins:      WasmPluginType,
		Telemetries:      TelemetryType,

		// K8s Networking Gateways
		K8sGateways:        K8sGatewayType,
		K8sGRPCRoutes:      K8sGRPCRouteType,
		K8sHTTPRoutes:      K8sHTTPRouteType,
		K8sReferenceGrants: K8sReferenceGrantType,
		K8sTCPRoutes:       K8sTCPRouteType,
		K8sTLSRoutes:       K8sTLSRouteType,

		// Security
		AuthorizationPolicies:  AuthorizationPoliciesType,
		PeerAuthentications:    PeerAuthenticationsType,
		RequestAuthentications: RequestAuthenticationsType,
	}

	ResourceTypesToAPI = map[string]string{
		DestinationRules: NetworkingGroupVersionV1Beta1.Group,
		EnvoyFilters:     NetworkingGroupVersionV1Alpha3.Group,
		Gateways:         NetworkingGroupVersionV1Beta1.Group,
		ServiceEntries:   NetworkingGroupVersionV1Beta1.Group,
		Sidecars:         NetworkingGroupVersionV1Beta1.Group,
		VirtualServices:  NetworkingGroupVersionV1Beta1.Group,
		WorkloadEntries:  NetworkingGroupVersionV1Beta1.Group,
		WorkloadGroups:   NetworkingGroupVersionV1Beta1.Group,
		WasmPlugins:      ExtensionGroupVersionV1Alpha1.Group,
		Telemetries:      TelemetryGroupV1Alpha1.Group,

		K8sGateways:        K8sNetworkingGroupVersionV1.Group,
		K8sGRPCRoutes:      K8sNetworkingGroupVersionV1.Group,
		K8sHTTPRoutes:      K8sNetworkingGroupVersionV1.Group,
		K8sReferenceGrants: K8sNetworkingGroupVersionV1.Group,
		K8sTCPRoutes:       K8sNetworkingGroupVersionV1Alpha2.Group,
		K8sTLSRoutes:       K8sNetworkingGroupVersionV1Alpha2.Group,

		AuthorizationPolicies:  SecurityGroupVersion.Group,
		PeerAuthentications:    SecurityGroupVersion.Group,
		RequestAuthentications: SecurityGroupVersion.Group,
	}
)

type IstioMeshConfig struct {
	DisableMixerHttpReports bool                    `yaml:"disableMixerHttpReports,omitempty"`
	DiscoverySelectors      []*metav1.LabelSelector `yaml:"discoverySelectors,omitempty"`
	EnableAutoMtls          *bool                   `yaml:"enableAutoMtls,omitempty"`
	MeshMTLS                struct {
		MinProtocolVersion string `yaml:"minProtocolVersion"`
	} `yaml:"meshMtls"`
	DefaultConfig struct {
		MeshId string `yaml:"meshId"`
	} `yaml:"defaultConfig" json:"defaultConfig"`
}

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules        []*networking_v1beta1.DestinationRule `json:"destinationrules"`
	MeshPeerAuthentications []*security_v1beta.PeerAuthentication `json:"meshpeerauthentications"`
	PeerAuthentications     []*security_v1beta.PeerAuthentication `json:"peerauthentications"`
	EnabledAutoMtls         bool                                  `json:"enabledautomtls"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	AuthorizationPolicies []*security_v1beta.AuthorizationPolicy `json:"authorizationpolicies"`
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
	Hostname string `json:"hostname"`
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

func (imc IstioMeshConfig) GetEnableAutoMtls() bool {
	if imc.EnableAutoMtls == nil {
		return true
	}
	return *imc.EnableAutoMtls
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
