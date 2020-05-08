package kubernetes

import (
	apps_v1 "k8s.io/api/apps/v1"
	autoscaling_v1 "k8s.io/api/autoscaling/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// Kubernetes Controllers
	CronJobType               = "CronJob"
	DeploymentType            = "Deployment"
	DeploymentConfigType      = "DeploymentConfig"
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

	Sidecars        = "sidecars"
	SidecarType     = "Sidecar"
	SidecarTypeList = "SidecarList"

	Serviceentries       = "serviceentries"
	ServiceentryType     = "ServiceEntry"
	ServiceentryTypeList = "ServiceEntryList"

	VirtualServices        = "virtualservices"
	VirtualServiceType     = "VirtualService"
	VirtualServiceTypeList = "VirtualServiceList"

	WorkloadEntries       = "workloadentries"
	WorkloadEntryType     = "WorkloadEntry"
	WorkloadEntryTypeList = "WorkloadEntryList"

	// Quotas

	quotaspecs        = "quotaspecs"
	quotaspecType     = "QuotaSpec"
	quotaspecTypeList = "QuotaSpecList"

	quotaspecbindings        = "quotaspecbindings"
	quotaspecbindingType     = "QuotaSpecBinding"
	quotaspecbindingTypeList = "QuotaSpecBindingList"

	// Policies

	policies       = "policies"
	policyType     = "Policy"
	policyTypeList = "PolicyList"

	//MeshPolicies

	meshPolicies       = "meshpolicies"
	meshPolicyType     = "MeshPolicy"
	meshPolicyTypeList = "MeshPolicyList"

	// ServiceMeshPolicies

	serviceMeshPolicies       = "servicemeshpolicies"
	serviceMeshPolicyType     = "ServiceMeshPolicy"
	serviceMeshPolicyTypeList = "ServiceMeshPolicyList"

	// Rbac
	clusterrbacconfigs        = "clusterrbacconfigs"
	clusterrbacconfigType     = "ClusterRbacConfig"
	clusterrbacconfigTypeList = "ClusterRbacConfigList"

	rbacconfigs        = "rbacconfigs"
	rbacconfigType     = "RbacConfig"
	rbacconfigTypeList = "RbacConfigList"

	serviceroles        = "serviceroles"
	serviceroleType     = "ServiceRole"
	serviceroleTypeList = "ServiceRoleList"

	servicerolebindings        = "servicerolebindings"
	servicerolebindingType     = "ServiceRoleBinding"
	servicerolebindingTypeList = "ServiceRoleBindingList"

	serviceMeshRbacConfigs        = "servicemeshrbacconfigs"
	serviceMeshRbacConfigType     = "ServiceMeshRbacConfig"
	serviceMeshRbacConfigTypeList = "ServiceMeshRbacConfigList"

	// Authorization Policies
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

	// Config - Rules

	rules        = "rules"
	ruleType     = "rule"
	ruleTypeList = "ruleList"

	// Config - Adapters

	adapters        = "adapters"
	adapterType     = "adapter"
	adapterTypeList = "adapterList"

	handlers        = "handlers"
	handlerType     = "handler"
	handlerTypeList = "handlerList"

	// Config - Templates

	instances        = "instances"
	instanceType     = "instance"
	instanceTypeList = "instanceList"

	templates        = "templates"
	templateType     = "template"
	templateTypeList = "templateList"

	// Iter8 types

	iter8experiments        = "experiments"
	iter8experimentType     = "Experiment"
	iter8experimentTypeList = "ExperimentList"
	iter8configMap 			= "iter8config-metrics"
)

var (
	ConfigGroupVersion = schema.GroupVersion{
		Group:   "config.istio.io",
		Version: "v1alpha2",
	}
	ApiConfigVersion = ConfigGroupVersion.Group + "/" + ConfigGroupVersion.Version

	NetworkingGroupVersion = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1alpha3",
	}
	ApiNetworkingVersion = NetworkingGroupVersion.Group + "/" + NetworkingGroupVersion.Version

	AuthenticationGroupVersion = schema.GroupVersion{
		Group:   "authentication.istio.io",
		Version: "v1alpha1",
	}
	ApiAuthenticationVersion = AuthenticationGroupVersion.Group + "/" + AuthenticationGroupVersion.Version

	RbacGroupVersion = schema.GroupVersion{
		Group:   "rbac.istio.io",
		Version: "v1alpha1",
	}
	ApiRbacVersion = RbacGroupVersion.Group + "/" + RbacGroupVersion.Version

	MaistraAuthenticationGroupVersion = schema.GroupVersion{
		Group:   "authentication.maistra.io",
		Version: "v1",
	}
	ApiMaistraAuthenticationVersion = MaistraAuthenticationGroupVersion.Group + "/" + MaistraAuthenticationGroupVersion.Version

	MaistraRbacGroupVersion = schema.GroupVersion{
		Group:   "rbac.maistra.io",
		Version: "v1",
	}
	ApiMaistraRbacVersion = MaistraRbacGroupVersion.Group + "/" + MaistraRbacGroupVersion.Version

	SecurityGroupVersion = schema.GroupVersion{
		Group:   "security.istio.io",
		Version: "v1beta1",
	}
	ApiSecurityVersion = SecurityGroupVersion.Group + "/" + SecurityGroupVersion.Version

	// We will add a new extesion API in a similar way as we added the Kubernetes + Istio APIs
	Iter8GroupVersion = schema.GroupVersion{
		Group:   "iter8.tools",
		Version: "v1alpha1",
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
			objectKind:     ServiceentryType,
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
	}

	configTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     ruleType,
			collectionKind: ruleTypeList,
		},
		// Quota specs depends on Quota template but are not a "template" object itselft
		{
			objectKind:     quotaspecType,
			collectionKind: quotaspecTypeList,
		},
		{
			objectKind:     quotaspecbindingType,
			collectionKind: quotaspecbindingTypeList,
		},
	}

	authenticationTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     policyType,
			collectionKind: policyTypeList,
		},
		{
			objectKind:     meshPolicyType,
			collectionKind: meshPolicyTypeList,
		},
	}

	maistraAuthenticationTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     serviceMeshPolicyType,
			collectionKind: serviceMeshPolicyTypeList,
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

	// TODO Adapters and Templates can be loaded from external config for easy maintenance

	adapterTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     adapterType,
			collectionKind: adapterTypeList,
		},
		{
			objectKind:     handlerType,
			collectionKind: handlerTypeList,
		},
	}

	templateTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     instanceType,
			collectionKind: instanceTypeList,
		},
		{
			objectKind:     templateType,
			collectionKind: templateTypeList,
		},
	}

	rbacTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     clusterrbacconfigType,
			collectionKind: clusterrbacconfigTypeList,
		},
		{
			objectKind:     rbacconfigType,
			collectionKind: rbacconfigTypeList,
		},
		{
			objectKind:     serviceroleType,
			collectionKind: serviceroleTypeList,
		},
		{
			objectKind:     servicerolebindingType,
			collectionKind: servicerolebindingTypeList,
		},
	}

	maistraRbacTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     serviceMeshRbacConfigType,
			collectionKind: serviceMeshRbacConfigTypeList,
		},
	}

	iter8Types = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     iter8experimentType,
			collectionKind: iter8experimentTypeList,
		},
	}

	// A map to get the plural for a Istio type using the singlar type
	// Used for fetch istio actions details, so only applied to handlers (adapters) and instances (templates) types
	// It should be one entry per adapter/template
	adapterPlurals = map[string]string{
		adapterType: adapters,
		handlerType: handlers,
	}

	templatePlurals = map[string]string{
		instanceType: instances,
		templateType: templates,
	}

	PluralType = map[string]string{
		// Networking
		Gateways:         GatewayType,
		VirtualServices:  VirtualServiceType,
		DestinationRules: DestinationRuleType,
		Serviceentries:   ServiceentryType,
		Sidecars:         SidecarType,
		WorkloadEntries:  WorkloadEntryType,

		// Main Config files
		rules:             ruleType,
		quotaspecs:        quotaspecType,
		quotaspecbindings: quotaspecbindingType,

		// Adapters
		adapters: adapterType,
		handlers: handlerType,

		// Templates
		instances: instanceType,
		templates: templateType,

		// Policies
		policies:            policyType,
		meshPolicies:        meshPolicyType,
		serviceMeshPolicies: serviceMeshPolicyType,

		// Rbac
		clusterrbacconfigs:     clusterrbacconfigType,
		rbacconfigs:            rbacconfigType,
		serviceroles:           serviceroleType,
		servicerolebindings:    servicerolebindingType,
		serviceMeshRbacConfigs: serviceMeshRbacConfigType,

		// Security
		AuthorizationPolicies:  AuthorizationPoliciesType,
		PeerAuthentications:    PeerAuthenticationsType,
		RequestAuthentications: RequestAuthenticationsType,

		// Iter8
		iter8experiments: iter8experimentType,
	}
)

// IstioObject is a k8s wrapper interface for config objects.
// Taken from istio.io
type IstioObject interface {
	runtime.Object
	GetSpec() map[string]interface{}
	SetSpec(map[string]interface{})
	GetTypeMeta() meta_v1.TypeMeta
	SetTypeMeta(meta_v1.TypeMeta)
	GetObjectMeta() meta_v1.ObjectMeta
	SetObjectMeta(meta_v1.ObjectMeta)
	DeepCopyIstioObject() IstioObject
	HasWorkloadSelectorLabels() bool
}

// IstioObjectList is a k8s wrapper interface for list config objects.
// Taken from istio.io
type IstioObjectList interface {
	runtime.Object
	GetItems() []IstioObject
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
	Service     *core_v1.Service                            `json:"service"`
	Endpoints   *core_v1.Endpoints                          `json:"endpoints"`
	Deployments *apps_v1.DeploymentList                     `json:"deployments"`
	Autoscalers *autoscaling_v1.HorizontalPodAutoscalerList `json:"autoscalers"`
	Pods        []core_v1.Pod                               `json:"pods"`
}

// IstioDetails is a wrapper to group all Istio objects related to a Service.
// Used to fetch all Istio information in a single operation instead to invoke individual APIs per each group.
type IstioDetails struct {
	VirtualServices  []IstioObject `json:"virtualservices"`
	DestinationRules []IstioObject `json:"destinationrules"`
	ServiceEntries   []IstioObject `json:"serviceentries"`
	Gateways         []IstioObject `json:"gateways"`
	Sidecars         []IstioObject `json:"sidecars"`
}

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules    []IstioObject `json:"destinationrules"`
	MeshPolicies        []IstioObject `json:"meshpolicies"`
	ServiceMeshPolicies []IstioObject `json:"servicemeshpolicies"`
	Policies            []IstioObject `json:"policies"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	ClusterRbacConfigs     []IstioObject `json:"clusterrbacconfigs"`
	ServiceMeshRbacConfigs []IstioObject `json:"servicemeshrbacconfigs"`
	ServiceRoles           []IstioObject `json:"serviceroles"`
	ServiceRoleBindings    []IstioObject `json:"servicerolebindings"`
	AuthorizationPolicies  []IstioObject `json:"authorizationpolicies"`
}

type istioResponse struct {
	results []IstioObject
	err     error
}

// GenericIstioObject is a type to test Istio types defined by Istio as a Kubernetes extension.
type GenericIstioObject struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata"`
	Spec               map[string]interface{} `json:"spec"`
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
