package kubernetes

import (
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

	networkingTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     GatewayType,
			collectionKind: GatewayTypeList,
		},
		{
			objectKind:     VirtualServiceType,
			collectionKind: VirtualServiceTypeList,
		},
		{
			objectKind:     DestinationRuleType,
			collectionKind: DestinationRuleTypeList,
		},
		{
			objectKind:     ServiceEntryType,
			collectionKind: ServiceentryTypeList,
		},
		{
			objectKind:     SidecarType,
			collectionKind: SidecarTypeList,
		},
		{
			objectKind:     WorkloadEntryType,
			collectionKind: WorkloadEntryTypeList,
		},
		{
			objectKind:     EnvoyFilterType,
			collectionKind: EnvoyFilterTypeList,
		},
	}

	securityTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     PeerAuthenticationsType,
			collectionKind: PeerAuthenticationsTypeList,
		},
		{
			objectKind:     AuthorizationPoliciesType,
			collectionKind: AuthorizationPoliciesTypeList,
		},
		{
			objectKind:     RequestAuthenticationsType,
			collectionKind: RequestAuthenticationsTypeList,
		},
	}

	iter8Types = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     Iter8ExperimentType,
			collectionKind: Iter8ExperimentTypeList,
		},
	}

	// A map to get the plural for a Istio type using the singlar type
	PluralType = map[string]string{
		// Networking
		Gateways:         GatewayType,
		VirtualServices:  VirtualServiceType,
		DestinationRules: DestinationRuleType,
		ServiceEntries:   ServiceEntryType,
		Sidecars:         SidecarType,
		WorkloadEntries:  WorkloadEntryType,
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
		VirtualServices:        NetworkingGroupVersion.Group,
		ServiceEntries:         NetworkingGroupVersion.Group,
		Gateways:               NetworkingGroupVersion.Group,
		Sidecars:               NetworkingGroupVersion.Group,
		WorkloadEntries:        NetworkingGroupVersion.Group,
		EnvoyFilters:           NetworkingGroupVersion.Group,
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

// IstioObject is a k8s wrapper interface for config objects.
// Taken from istio.io
type IstioObject interface {
	runtime.Object
	GetSpec() map[string]interface{}
	SetSpec(map[string]interface{})
	GetStatus() map[string]interface{}
	SetStatus(map[string]interface{})
	GetTypeMeta() meta_v1.TypeMeta
	SetTypeMeta(meta_v1.TypeMeta)
	GetObjectMeta() meta_v1.ObjectMeta
	SetObjectMeta(meta_v1.ObjectMeta)
	DeepCopyIstioObject() IstioObject
	HasWorkloadSelectorLabels() bool
	HasMatchLabelsSelector() bool
}

// IstioObjectList is a k8s wrapper interface for list config objects.
// Taken from istio.io
type IstioObjectList interface {
	runtime.Object
	GetItems() []IstioObject
}

type IstioMeshConfig struct {
	DisableMixerHttpReports bool  `yaml:"disableMixerHttpReports,omitempty"`
	EnableAutoMtls          *bool `yaml:"enableAutoMtls,omitempty"`
}

// ServiceList holds list of services, pods and deployments
type ServiceList struct {
	Services    *core_v1.ServiceList
	Pods        *core_v1.PodList
	Deployments *apps_v1.DeploymentList
}

// ServiceDetails is a wrapper to group full Service description, Endpoints and Pods.
// Used to fetch all details in a single operation instead to invoke individual APIs per each group.
type ServiceDetails struct {
	Service     *core_v1.Service        `json:"service"`
	Endpoints   *core_v1.Endpoints      `json:"endpoints"`
	Deployments *apps_v1.DeploymentList `json:"deployments"`
	Pods        []core_v1.Pod           `json:"pods"`
}

// IstioDetails is a wrapper to group all Istio objects related to a Service.
// Used to fetch all Istio information in a single operation instead to invoke individual APIs per each group.
type IstioDetails struct {
	VirtualServices        []IstioObject `json:"virtualservices"`
	DestinationRules       []IstioObject `json:"destinationrules"`
	ServiceEntries         []IstioObject `json:"serviceentries"`
	Gateways               []IstioObject `json:"gateways"`
	Sidecars               []IstioObject `json:"sidecars"`
	RequestAuthentications []IstioObject `json:"requestauthentications"`
}

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules        []IstioObject `json:"destinationrules"`
	MeshPeerAuthentications []IstioObject `json:"meshpeerauthentications"`
	PeerAuthentications     []IstioObject `json:"peerauthentications"`
	EnabledAutoMtls         bool          `json:"enabledautomtls"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	AuthorizationPolicies []IstioObject `json:"authorizationpolicies"`
}

// GenericIstioObject is a type to test Istio types defined by Istio as a Kubernetes extension.
type GenericIstioObject struct {
	meta_v1.TypeMeta   `json:",inline" yaml:",inline"`
	meta_v1.ObjectMeta `json:"metadata" yaml:"metadata"`
	Spec               map[string]interface{} `json:"spec"`
	Status             map[string]interface{} `json:"status"`
}

// GenericIstioObjectList is the generic Kubernetes API list wrapper
type GenericIstioObjectList struct {
	meta_v1.TypeMeta `json:",inline"`
	meta_v1.ListMeta `json:"metadata"`
	Items            []GenericIstioObject `json:"items"`
}

// GetSpec from a wrapper
func (in *GenericIstioObject) GetSpec() map[string]interface{} {
	return in.Spec
}

// SetSpec for a wrapper
func (in *GenericIstioObject) SetSpec(spec map[string]interface{}) {
	in.Spec = spec
}

// GetTypeMeta from a wrapper
func (in *GenericIstioObject) GetTypeMeta() meta_v1.TypeMeta {
	return in.TypeMeta
}

// SetObjectMeta for a wrapper
func (in *GenericIstioObject) SetTypeMeta(typemeta meta_v1.TypeMeta) {
	in.TypeMeta = typemeta
}

// GetObjectMeta from a wrapper
func (in *GenericIstioObject) GetObjectMeta() meta_v1.ObjectMeta {
	return in.ObjectMeta
}

// SetObjectMeta for a wrapper
func (in *GenericIstioObject) SetObjectMeta(metadata meta_v1.ObjectMeta) {
	in.ObjectMeta = metadata
}

// GetStatus from a wrapper
func (in *GenericIstioObject) GetStatus() map[string]interface{} {
	return in.Status
}

// SetStatus for a wrapper
func (in *GenericIstioObject) SetStatus(status map[string]interface{}) {
	in.Status = status
}

func (in *GenericIstioObject) HasWorkloadSelectorLabels() bool {
	hwsl := false

	if ws, found := in.GetSpec()["workloadSelector"]; found {
		if wsCasted, ok := ws.(map[string]interface{}); ok {
			if _, found := wsCasted["labels"]; found {
				hwsl = true
			}
		}
	}

	return hwsl
}

func (in *GenericIstioObject) HasMatchLabelsSelector() bool {
	hwsl := false

	if s, found := in.GetSpec()["selector"]; found {
		if sCasted, ok := s.(map[string]interface{}); ok {
			if ml, found := sCasted["matchLabels"]; found {
				if mlCasted, ok := ml.(map[string]interface{}); ok {
					if len(mlCasted) > 0 {
						hwsl = true
					}
				}
			}
		}
	}

	return hwsl
}

// GetItems from a wrapper
func (in *GenericIstioObjectList) GetItems() []IstioObject {
	out := make([]IstioObject, len(in.Items))
	for i := range in.Items {
		out[i] = &in.Items[i]
	}
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GenericIstioObject) DeepCopyInto(out *GenericIstioObject) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = in.Spec
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GenericIstioObject.
func (in *GenericIstioObject) DeepCopy() *GenericIstioObject {
	if in == nil {
		return nil
	}
	out := new(GenericIstioObject)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *GenericIstioObject) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyIstioObject is an autogenerated deepcopy function, copying the receiver, creating a new IstioObject.
func (in *GenericIstioObject) DeepCopyIstioObject() IstioObject {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GenericIstioObjectList) DeepCopyInto(out *GenericIstioObjectList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	out.ListMeta = in.ListMeta
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]GenericIstioObject, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GenericIstioObjectList.
func (in *GenericIstioObjectList) DeepCopy() *GenericIstioObjectList {
	if in == nil {
		return nil
	}
	out := new(GenericIstioObjectList)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *GenericIstioObjectList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

func (imc IstioMeshConfig) GetEnableAutoMtls() bool {
	if imc.EnableAutoMtls == nil {
		return true
	}
	return *imc.EnableAutoMtls
}
