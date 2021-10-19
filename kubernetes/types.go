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

	DestinationRules        = "destinationrules"
	DestinationRuleType     = "DestinationRule"
	DestinationRuleTypeList = "DestinationRuleList"

	Gateways        = "gateways"
	GatewayType     = "Gateway"
	GatewayTypeList = "GatewayList"

	EnvoyFilters        = "envoyfilters"
	EnvoyFilterType     = "EnvoyFilter"
	EnvoyFilterTypeList = "EnvoyFilterList"

	Sidecars        = "sidecars"
	SidecarType     = "Sidecar"
	SidecarTypeList = "SidecarList"

	ServiceEntries       = "serviceentries"
	ServiceEntryType     = "ServiceEntry"
	ServiceentryTypeList = "ServiceEntryList"

	VirtualServices        = "virtualservices"
	VirtualServiceType     = "VirtualService"
	VirtualServiceTypeList = "VirtualServiceList"

	WorkloadEntries       = "workloadentries"
	WorkloadEntryType     = "WorkloadEntry"
	WorkloadEntryTypeList = "WorkloadEntryList"

	WorkloadGroups        = "workloadgroups"
	WorkloadGroupType     = "WorkloadGroup"
	WorkloadGroupTypeList = "WorkloadGroupList"

	// Authorization PeerAuthentications
	AuthorizationPolicies         = "authorizationpolicies"
	AuthorizationPoliciesType     = "AuthorizationPolicy"
	AuthorizationPoliciesTypeList = "AuthorizationPolicyList"

	// Peer Authentications
	PeerAuthentications         = "peerauthentications"
	PeerAuthenticationsType     = "PeerAuthentication"
	PeerAuthenticationsTypeList = "PeerAuthenticationList"

	// Request Authentications
	RequestAuthentications         = "requestauthentications"
	RequestAuthenticationsType     = "RequestAuthentication"
	RequestAuthenticationsTypeList = "RequestAuthenticationList"

	// Iter8 types

	Iter8Experiments        = "experiments"
	Iter8ExperimentType     = "Experiment"
	Iter8ExperimentTypeList = "ExperimentList"
	Iter8ConfigMap          = "iter8config-metrics"
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

	// We will add a new extesion API in a similar way as we added the Kubernetes + Istio APIs
	Iter8GroupVersion = schema.GroupVersion{
		Group:   "iter8.tools",
		Version: "v1alpha2",
	}
	ApiIter8Version = Iter8GroupVersion.Group + "/" + Iter8GroupVersion.Version

	iter8Types = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     Iter8ExperimentType,
			collectionKind: Iter8ExperimentTypeList,
		},
	}

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

		// Iter8
		Iter8Experiments: Iter8ExperimentType,
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
		// Extensions
		Iter8Experiments: Iter8GroupVersion.Group,
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

// ExportedResources is a wrapper to group all exported Istio objects
// Used to provide exported resources to validation
type ExportedResources struct {
	VirtualServices  []networking_v1alpha3.VirtualService  `json:"virtualservices"`
	DestinationRules []networking_v1alpha3.DestinationRule `json:"destinationrules"`
	ServiceEntries   []networking_v1alpha3.ServiceEntry    `json:"serviceentries"`
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

type RegistryStatus struct {
	pilot string
	RegistryService
}

type RegistryService struct {
	Attributes           map[string]interface{}   `json:"Attributes,omitempty"`
	Ports                []map[string]interface{} `json:"ports"`
	ServiceAccounts      []string                 `json:"serviceAccounts,omitempty"`
	CreationTime         time.Time                `json:"creationTime,omitempty"`
	Hostname             string                   `json:"hostname"`
	Address              string                   `json:"address,omitempty"`
	AutoAllocatedAddress string                   `json:"autoAllocatedAddress,omitempty"`
	ClusterVIPs          map[string]string        `json:"cluster-vips,omitempty"`
	Resolution           int                      `json:"Resolution,omitempty"`
	MeshExternal         bool                     `json:"MeshExternal,omitempty"`
}

func (imc IstioMeshConfig) GetEnableAutoMtls() bool {
	if imc.EnableAutoMtls == nil {
		return true
	}
	return *imc.EnableAutoMtls
}
