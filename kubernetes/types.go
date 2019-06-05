package kubernetes

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/config"
	apps_v1 "k8s.io/api/apps/v1"
	autoscaling_v1 "k8s.io/api/autoscaling/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// Networking

	destinationRules        = "destinationrules"
	destinationRuleType     = "DestinationRule"
	destinationRuleTypeList = "DestinationRuleList"

	gateways        = "gateways"
	gatewayType     = "Gateway"
	gatewayTypeList = "GatewayList"

	sidecars        = "sidecars"
	sidecarType     = "Sidecar"
	sidecarTypeList = "SidecarList"

	serviceentries       = "serviceentries"
	serviceentryType     = "ServiceEntry"
	serviceentryTypeList = "ServiceEntryList"

	virtualServices        = "virtualservices"
	virtualServiceType     = "VirtualService"
	virtualServiceTypeList = "VirtualServiceList"

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

	// Config - Rules

	rules        = "rules"
	ruleType     = "rule"
	ruleTypeList = "ruleList"

	// Config - Adapters

	adapters        = "adapters"
	adapterType     = "adapter"
	adapterTypeList = "adapterList"

	bypasses       = "bypasses"
	bypassType     = "bypass"
	bypassTypeList = "bypassList"

	circonuses       = "circonuses"
	circonusType     = "circonus"
	circonusTypeList = "circonusList"

	cloudwatches       = "cloudwatches"
	cloudwatchType     = "cloudwatch"
	cloudwatchTypeList = "cloudwatchList"

	deniers        = "deniers"
	denierType     = "denier"
	denierTypeList = "denierList"

	dogstatsds        = "dogstatsds"
	dogstatsdType     = "dogstatsd"
	dogstatsdTypeList = "dogstatsdList"

	fluentds        = "fluentds"
	fluentdType     = "fluentd"
	fluentdTypeList = "fluentdList"

	handlers        = "handlers"
	handlerType     = "handler"
	handlerTypeList = "handlerList"

	kubernetesenvs        = "kubernetesenvs"
	kubernetesenvType     = "kubernetesenv"
	kubernetesenvTypeList = "kubernetesenvList"

	listcheckers        = "listcheckers"
	listcheckerType     = "listchecker"
	listcheckerTypeList = "listcheckerList"

	memquotas        = "memquotas"
	memquotaType     = "memquota"
	memquotaTypeList = "memquotaList"

	noops        = "noops"
	noopType     = "noop"
	noopTypeList = "noopList"

	opas        = "opas"
	opaType     = "opa"
	opaTypeList = "opaList"

	prometheuses       = "prometheuses"
	prometheusType     = "prometheus"
	prometheusTypeList = "prometheusList"

	rbacs        = "rbacs"
	rbacType     = "rbac"
	rbacTypeList = "rbacList"

	redisquotas        = "redisquotas"
	redisquotaType     = "redisquota"
	redisquotaTypeList = "redisquotaList"

	signalfxs        = "signalfxs"
	signalfxType     = "signalfx"
	signalfxTypeList = "signalfxList"

	solarwindses       = "solarwindses"
	solarwindsType     = "solarwinds"
	solarwindsTypeList = "solarwindsList"

	stackdrivers        = "stackdrivers"
	stackdriverType     = "stackdriver"
	stackdriverTypeList = "stackdriverList"

	statsds        = "statsds"
	statsdType     = "statsd"
	statsdTypeList = "statsdList"

	stdios        = "stdios"
	stdioType     = "stdio"
	stdioTypeList = "stdioList"

	zipkins        = "zipkins"
	zipkinType     = "zipkin"
	zipkinTypeList = "zipkinList"

	// Config - Templates

	apikeys        = "apikeys"
	apikeyType     = "apikey"
	apikeyTypeList = "apikeyList"

	authorizations        = "authorizations"
	authorizationType     = "authorization"
	authorizationTypeList = "authorizationList"

	checknothings        = "checknothings"
	checknothingType     = "checknothing"
	checknothingTypeList = "checknothingList"

	edges        = "edges"
	edgeType     = "edge"
	edgeTypeList = "edgeList"

	instances        = "instances"
	instanceType     = "instance"
	instanceTypeList = "instanceList"

	kuberneteses       = "kuberneteses"
	kubernetesType     = "kubernetes"
	kubernetesTypeList = "kubernetesList"

	listEntries       = "listentries"
	listEntryType     = "listentry"
	listEntryTypeList = "listentryList"

	logentries       = "logentries"
	logentryType     = "logentry"
	logentryTypeList = "logentryList"

	metrics        = "metrics"
	metricType     = "metric"
	metricTypeList = "metricList"

	quotas        = "quotas"
	quotaType     = "quota"
	quotaTypeList = "quotaList"

	reportnothings        = "reportnothings"
	reportnothingType     = "reportnothing"
	reportnothingTypeList = "reportnothingList"

	templates        = "templates"
	templateType     = "template"
	templateTypeList = "templateList"

	tracespans        = "tracespans"
	tracespanType     = "tracespan"
	tracespanTypeList = "tracespanList"
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

	networkingTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     gatewayType,
			collectionKind: gatewayTypeList,
		},
		{
			objectKind:     virtualServiceType,
			collectionKind: virtualServiceTypeList,
		},
		{
			objectKind:     destinationRuleType,
			collectionKind: destinationRuleTypeList,
		},
		{
			objectKind:     serviceentryType,
			collectionKind: serviceentryTypeList,
		},
		{
			objectKind:     sidecarType,
			collectionKind: sidecarTypeList,
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
			objectKind:     bypassType,
			collectionKind: bypassTypeList,
		},
		{
			objectKind:     circonusType,
			collectionKind: circonusTypeList,
		},
		{
			objectKind:     cloudwatchType,
			collectionKind: cloudwatchTypeList,
		},
		{
			objectKind:     denierType,
			collectionKind: denierTypeList,
		},
		{
			objectKind:     dogstatsdType,
			collectionKind: dogstatsdTypeList,
		},
		{
			objectKind:     fluentdType,
			collectionKind: fluentdTypeList,
		},
		{
			objectKind:     handlerType,
			collectionKind: handlerTypeList,
		},
		{
			objectKind:     kubernetesenvType,
			collectionKind: kubernetesenvTypeList,
		},
		{
			objectKind:     listcheckerType,
			collectionKind: listcheckerTypeList,
		},
		{
			objectKind:     memquotaType,
			collectionKind: memquotaTypeList,
		},
		{
			objectKind:     noopType,
			collectionKind: noopTypeList,
		},
		{
			objectKind:     opaType,
			collectionKind: opaTypeList,
		},
		{
			objectKind:     prometheusType,
			collectionKind: prometheusTypeList,
		},
		{
			objectKind:     rbacType,
			collectionKind: rbacTypeList,
		},
		{
			objectKind:     redisquotaType,
			collectionKind: redisquotaTypeList,
		},
		{
			objectKind:     signalfxType,
			collectionKind: signalfxTypeList,
		},
		{
			objectKind:     solarwindsType,
			collectionKind: solarwindsTypeList,
		},
		{
			objectKind:     stackdriverType,
			collectionKind: stackdriverTypeList,
		},
		{
			objectKind:     statsdType,
			collectionKind: statsdTypeList,
		},
		{
			objectKind:     stdioType,
			collectionKind: stdioTypeList,
		},
		{
			objectKind:     zipkinType,
			collectionKind: zipkinTypeList,
		},
	}

	templateTypes = []struct {
		objectKind     string
		collectionKind string
	}{
		{
			objectKind:     apikeyType,
			collectionKind: apikeyTypeList,
		},
		{
			objectKind:     authorizationType,
			collectionKind: authorizationTypeList,
		},
		{
			objectKind:     checknothingType,
			collectionKind: checknothingTypeList,
		},
		{
			objectKind:     edgeType,
			collectionKind: edgeTypeList,
		},
		{
			objectKind:     kubernetesType,
			collectionKind: kubernetesTypeList,
		},
		{
			objectKind:     instanceType,
			collectionKind: instanceTypeList,
		},
		{
			objectKind:     listEntryType,
			collectionKind: listEntryTypeList,
		},
		{
			objectKind:     logentryType,
			collectionKind: logentryTypeList,
		},
		{
			objectKind:     metricType,
			collectionKind: metricTypeList,
		},
		{
			objectKind:     quotaType,
			collectionKind: quotaTypeList,
		},
		{
			objectKind:     reportnothingType,
			collectionKind: reportnothingTypeList,
		},
		{
			objectKind:     templateType,
			collectionKind: templateTypeList,
		},
		{
			objectKind:     tracespanType,
			collectionKind: tracespanTypeList,
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

	// A map to get the plural for a Istio type using the singlar type
	// Used for fetch istio actions details, so only applied to handlers (adapters) and instances (templates) types
	// It should be one entry per adapter/template
	adapterPlurals = map[string]string{
		adapterType:       adapters,
		bypassType:        bypasses,
		circonusType:      circonuses,
		cloudwatchType:    cloudwatches,
		denierType:        deniers,
		dogstatsdType:     dogstatsds,
		fluentdType:       fluentds,
		handlerType:       handlers,
		kubernetesenvType: kubernetesenvs,
		listcheckerType:   listcheckers,
		memquotaType:      memquotas,
		noopType:          noops,
		opaType:           opas,
		prometheusType:    prometheuses,
		rbacType:          rbacs,
		redisquotaType:    redisquotas,
		signalfxType:      signalfxs,
		solarwindsType:    solarwindses,
		stackdriverType:   stackdrivers,
		statsdType:        statsds,
		stdioType:         stdios,
		zipkinType:        zipkins,
	}

	templatePlurals = map[string]string{
		apikeyType:        apikeys,
		authorizationType: authorizations,
		checknothingType:  checknothings,
		edgeType:          edges,
		instanceType:      instances,
		kubernetesType:    kuberneteses,
		listEntryType:     listEntries,
		logentryType:      logentries,
		metricType:        metrics,
		quotaType:         quotas,
		reportnothingType: reportnothings,
		templateType:      templates,
		tracespanType:     tracespans,
	}

	PluralType = map[string]string{
		// Networking
		gateways:         gatewayType,
		virtualServices:  virtualServiceType,
		destinationRules: destinationRuleType,
		serviceentries:   serviceentryType,
		sidecars:         sidecarType,

		// Main Config files
		rules:             ruleType,
		quotaspecs:        quotaspecType,
		quotaspecbindings: quotaspecbindingType,

		// Adapters
		adapters:       adapterType,
		bypasses:       bypassType,
		circonuses:     circonusType,
		cloudwatches:   cloudwatchType,
		deniers:        denierType,
		dogstatsds:     dogstatsdType,
		fluentds:       fluentdType,
		handlers:       handlerType,
		kubernetesenvs: kubernetesenvType,
		listcheckers:   listcheckerType,
		memquotas:      memquotaType,
		noops:          noopType,
		opas:           opaType,
		prometheuses:   prometheusType,
		rbacs:          rbacType,
		redisquotas:    redisquotaType,
		signalfxs:      signalfxType,
		solarwindses:   solarwindsType,
		stackdrivers:   stackdriverType,
		statsds:        statsdType,
		stdios:         stdioType,
		zipkins:        zipkinType,

		// Templates
		apikeys:        apikeyType,
		authorizations: authorizationType,
		checknothings:  checknothingType,
		edges:          edgeType,
		instances:      instanceType,
		kuberneteses:   kubernetesType,
		listEntries:    listEntryType,
		logentries:     logentryType,
		metrics:        metricType,
		quotas:         quotaType,
		reportnothings: reportnothingType,
		templates:      templateType,
		tracespans:     tracespanType,

		// Policies
		policies:     policyType,
		meshPolicies: meshPolicyType,

		// Rbac
		clusterrbacconfigs:  clusterrbacconfigType,
		rbacconfigs:         rbacconfigType,
		serviceroles:        serviceroleType,
		servicerolebindings: servicerolebindingType,
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
}

// MTLSDetails is a wrapper to group all Istio objects related to non-local mTLS configurations
type MTLSDetails struct {
	DestinationRules []IstioObject `json:"destinationrules"`
	MeshPolicies     []IstioObject `json:"meshpolicies"`
	Policies         []IstioObject `json:"policies"`
}

// RBACDetails is a wrapper for objects related to Istio RBAC (Role Based Access Control)
type RBACDetails struct {
	ClusterRbacConfigs  []IstioObject `json:"clusterrbacconfigs"`
	ServiceRoles        []IstioObject `json:"serviceroles"`
	ServiceRoleBindings []IstioObject `json:"servicerolebindings"`
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

// Host represents the FQDN format for Istio hostnames
type Host struct {
	Service       string
	Namespace     string
	Cluster       string
	CompleteInput bool
}

// ParseHost takes as an input a hostname (simple or full FQDN), namespace and clusterName and returns a parsed Host struct
func ParseHost(hostName, namespace, cluster string) Host {
	if cluster == "" {
		cluster = config.Get().ExternalServices.Istio.IstioIdentityDomain
	}

	domainParts := strings.Split(hostName, ".")
	host := Host{
		Service: domainParts[0],
	}
	if len(domainParts) > 1 {
		if len(domainParts) > 2 {
			parsedClusterName := strings.Join(domainParts[2:], ".")
			if parsedClusterName == cluster {
				// FQDN input
				host.Cluster = cluster
				host.CompleteInput = true
			}
		}

		if host.CompleteInput {
			host.Namespace = domainParts[1]
		} else {
			// ServiceEntry or broken hostname
			host.Service = hostName
		}
	} else {
		// Simple format
		host.Namespace = namespace
		host.Cluster = cluster
		host.CompleteInput = true
	}

	return host
}

// String outputs a full FQDN version of the Host
func (h Host) String() string {
	return fmt.Sprintf("%s.%s.%s", h.Service, h.Namespace, h.Cluster)
}
