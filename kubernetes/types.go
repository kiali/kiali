package kubernetes

import (
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	"istio.io/client-go/pkg/apis/telemetry/v1alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"
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

	K8sHTTPRoutes    = "k8shttproutes"
	K8sHTTPRouteType = "K8sHTTPRoute"
	// K8sActualHTTPRouteType There is a naming conflict between Istio and K8s Gateways, keeping here an actual type to show in YAML editor
	K8sActualHTTPRouteType = "HTTPRoute"

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
		K8sGateways:   K8sGatewayType,
		K8sHTTPRoutes: K8sHTTPRouteType,

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

		K8sGateways:   K8sNetworkingGroupVersionV1Beta1.Group,
		K8sHTTPRoutes: K8sNetworkingGroupVersionV1Beta1.Group,

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
	pilot string
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

// RegistryConfiguration will hold the Istio configuration required for Kiali validations
// Resources not used (i.e. EnvoyFilters) are not added, those will require update them in the future
type RegistryConfiguration struct {
	// Networking
	DestinationRules []*networking_v1beta1.DestinationRule
	EnvoyFilters     []*networking_v1alpha3.EnvoyFilter
	Gateways         []*networking_v1beta1.Gateway
	ServiceEntries   []*networking_v1beta1.ServiceEntry
	Sidecars         []*networking_v1beta1.Sidecar
	VirtualServices  []*networking_v1beta1.VirtualService
	WorkloadEntries  []*networking_v1beta1.WorkloadEntry
	WorkloadGroups   []*networking_v1beta1.WorkloadGroup
	WasmPlugins      []*extentions_v1alpha1.WasmPlugin
	Telemetries      []*v1alpha1.Telemetry

	// K8s Networking Gateways
	K8sGateways   []*k8s_networking_v1beta1.Gateway
	K8sHTTPRoutes []*k8s_networking_v1beta1.HTTPRoute

	// Security
	AuthorizationPolicies  []*security_v1beta.AuthorizationPolicy
	PeerAuthentications    []*security_v1beta.PeerAuthentication
	RequestAuthentications []*security_v1beta.RequestAuthentication
}

type RegistryService struct {
	pilot string
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
		ExportTo       map[string]bool   `json:"ExportTo,omitempty"`
		LabelSelectors map[string]string `json:"LabelSelectors,omitempty"`
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
	Configuration *RegistryConfiguration
	Services      []*RegistryService
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
