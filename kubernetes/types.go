package kubernetes

import (
	"time"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"k8s.io/apimachinery/pkg/runtime/schema"
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
	NetworkingGroupVersion = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1alpha3",
	}
	ApiNetworkingVersion = NetworkingGroupVersion.Group + "/" + NetworkingGroupVersion.Version

	SecurityGroupVersion = schema.GroupVersion{
		Group:   "security.istio.io",
		Version: "v1beta1",
	}
	ApiSecurityVersion = SecurityGroupVersion.Group + "/" + SecurityGroupVersion.Version

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

		// Security
		AuthorizationPolicies:  AuthorizationPoliciesType,
		PeerAuthentications:    PeerAuthenticationsType,
		RequestAuthentications: RequestAuthenticationsType,
	}

	ResourceTypesToAPI = map[string]string{
		DestinationRules:       NetworkingGroupVersion.Group,
		EnvoyFilters:           NetworkingGroupVersion.Group,
		Gateways:               NetworkingGroupVersion.Group,
		ServiceEntries:         NetworkingGroupVersion.Group,
		Sidecars:               NetworkingGroupVersion.Group,
		VirtualServices:        NetworkingGroupVersion.Group,
		WorkloadEntries:        NetworkingGroupVersion.Group,
		WorkloadGroups:         NetworkingGroupVersion.Group,
		AuthorizationPolicies:  SecurityGroupVersion.Group,
		PeerAuthentications:    SecurityGroupVersion.Group,
		RequestAuthentications: SecurityGroupVersion.Group,
	}

	ApiToVersion = map[string]string{
		NetworkingGroupVersion.Group: ApiNetworkingVersion,
		SecurityGroupVersion.Group:   ApiSecurityVersion,
	}
)

type IstioMeshConfig struct {
	DisableMixerHttpReports bool  `yaml:"disableMixerHttpReports,omitempty"`
	EnableAutoMtls          *bool `yaml:"enableAutoMtls,omitempty"`
}

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules        []networking_v1alpha3.DestinationRule `json:"destinationrules"`
	MeshPeerAuthentications []security_v1beta.PeerAuthentication  `json:"meshpeerauthentications"`
	PeerAuthentications     []security_v1beta.PeerAuthentication  `json:"peerauthentications"`
	EnabledAutoMtls         bool                                  `json:"enabledautomtls"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	AuthorizationPolicies []security_v1beta.AuthorizationPolicy `json:"authorizationpolicies"`
}

type ProxyStatus struct {
	pilot string
	SyncStatus
}

// SyncStatus is the synchronization status between Pilot and a given Envoy
type SyncStatus struct {
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
	DestinationRules []networking_v1alpha3.DestinationRule
	EnvoyFilters     []networking_v1alpha3.EnvoyFilter
	Gateways         []networking_v1alpha3.Gateway
	ServiceEntries   []networking_v1alpha3.ServiceEntry
	Sidecars         []networking_v1alpha3.Sidecar
	VirtualServices  []networking_v1alpha3.VirtualService
	WorkloadEntries  []networking_v1alpha3.WorkloadEntry
	WorkloadGroups   []networking_v1alpha3.WorkloadGroup
	// Security
	AuthorizationPolicies  []security_v1beta.AuthorizationPolicy
	PeerAuthentications    []security_v1beta.PeerAuthentication
	RequestAuthentications []security_v1beta.RequestAuthentication
}

type RegistryEndpoint struct {
	pilot string
	IstioEndpoint
}

type IstioEndpoint struct {
	Service   string `json:"svc"`
	Endpoints []struct {
		Service     IstioService `json:"service,omitempty"`
		ServicePort struct {
			Name     string `json:"name,omitempty"`
			Port     uint32 `json:"port,omitempty"`
			Protocol string `json:"protocol,omitempty"`
		} `json:"servicePort,omitempty"`
		Endpoint struct {
			Labels          map[string]string `json:"Labels,omitempty"`
			Address         string            `json:"Address,omitempty"`
			ServicePortName string            `json:"ServicePortName,omitempty"`
			// EnvoyEndpoint is not mapped into the model
			ServiceAccount string `json:"ServiceAccount,omitempty"`
			Network        string `json:"Network,omitempty"`
			Locality       struct {
				Label     string `json:"Label,omitempty"`
				ClusterID string `json:"ClusterID,omitempty"`
			} `json:"Locality,omitempty"`
			EndpointPort uint32 `json:"EndpointPort,omitempty"`
			LbWeight     uint32 `json:"LbWeight,omitempty"`
			TLSMode      string `json:"TLSMode,omitempty"`
			Namespace    string `json:"Namespace,omitempty"`
			WorkloadName string `json:"WorkloadName,omitempty"`
			HostName     string `json:"HostName,omitempty"`
			SubDomain    string `json:"SubDomain,omitempty"`
			// TunnelAbility and DiscoverabilityPolicy are not mapped into the model
		} `json:"endpoint"`
	} `json:"ep"`
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
		// UID is present in Istio 1.11.x but not in 1.12.x
		UID string `json:"UID,omitempty"`
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
	ServiceAccounts []string  `json:"serviceAccounts,omitempty"`
	CreationTime    time.Time `json:"creationTime,omitempty"`
	Hostname        string    `json:"hostname"`
	// Address is present in Istio 1.11.x but not in 1.12.x
	Address              string `json:"address,omitempty"`
	AutoAllocatedAddress string `json:"autoAllocatedAddress,omitempty"`
	// ClusterVIPs defined in Istio 1.11.x
	ClusterVIPs11 map[string]string `json:"cluster-vips,omitempty"`
	// ClusterVIPs defined in Istio 1.12.x
	ClusterVIPs12 struct {
		Addresses map[string][]string `json:"Addresses,omitempty"`
	} `json:"clusterVIPs,omitempty"`
	// Resolution values, as the debug endpoint doesn't perform a conversion
	// 0:	ClientSideLB
	// 1:   DNSLB
	// 2:   Passthrough
	Resolution   int  `json:"Resolution,omitempty"`
	MeshExternal bool `json:"MeshExternal,omitempty"`
	// ResourceVersion attribute is not mapped into the model
	// Kiali won't use it yet and it is only present on Istio 1.12.x
}

type RegistryStatus struct {
	Configuration *RegistryConfiguration
	Endpoints     []*RegistryEndpoint
	Services      []*RegistryService
}

func (imc IstioMeshConfig) GetEnableAutoMtls() bool {
	if imc.EnableAutoMtls == nil {
		return true
	}
	return *imc.EnableAutoMtls
}
