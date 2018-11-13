package kubernetes

import (
	"k8s.io/api/apps/v1beta1"
	autoscalingV1 "k8s.io/api/autoscaling/v1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// Networking

	destinationRules        = "destinationrules"
	destinationRuleType     = "DestinationRule"
	destinationRuleTypeList = "DestinationRuleList"
	destinationRuleLabel    = "destination-rule"

	gateways        = "gateways"
	gatewayType     = "Gateway"
	gatewayTypeList = "GatewayList"
	gatewayLabel    = "gateway"

	serviceentries       = "serviceentries"
	serviceentryType     = "ServiceEntry"
	serviceentryTypeList = "ServiceEntryList"
	serviceentryLabel    = "serviceentry"

	virtualServices        = "virtualservices"
	virtualServiceType     = "VirtualService"
	virtualServiceTypeList = "VirtualServiceList"
	virtualServiceLabel    = "virtual-service"

	// Quotas

	quotaspecs        = "quotaspecs"
	quotaspecType     = "QuotaSpec"
	quotaspecTypeList = "QuotaSpecList"
	quotaspecLabel    = "quotaspec"

	quotaspecbindings        = "quotaspecbindings"
	quotaspecbindingType     = "QuotaSpecBinding"
	quotaspecbindingTypeList = "QuotaSpecBindingList"
	quotaspecbindingLabel    = "quotaspecbinding"

	// Config - Rules

	rules        = "rules"
	ruleType     = "rule"
	ruleTypeList = "ruleList"
	ruleLabel    = "rule"

	// Config - Adapters

	circonuses       = "circonuses"
	circonusType     = "circonus"
	circonusTypeList = "circonusList"
	circonusLabel    = "circonus"

	deniers        = "deniers"
	denierType     = "denier"
	denierTypeList = "denierList"
	denierLabel    = "denier"

	fluentds        = "fluentds"
	fluentdType     = "fluentd"
	fluentdTypeList = "fluentdList"
	fluentdLabel    = "fluentd"

	handlers        = "handlers"
	handlerType     = "handler"
	handlerTypeList = "handlerList"
	handlerLabel    = "handler"

	kubernetesenvs        = "kubernetesenvs"
	kubernetesenvType     = "kubernetesenv"
	kubernetesenvTypeList = "kubernetesenvList"
	kubernetesenvLabel    = "kubernetesenv"

	listcheckers        = "listcheckers"
	listcheckerType     = "listchecker"
	listcheckerTypeList = "listcheckerList"
	listcheckerLabel    = "listchecker"

	memquotas        = "memquotas"
	memquotaType     = "memquota"
	memquotaTypeList = "memquotaList"
	memquotaLabel    = "memquota"

	opas        = "opas"
	opaType     = "opa"
	opaTypeList = "opaList"
	opaLabel    = "opa"

	prometheuses       = "prometheuses"
	prometheusType     = "prometheus"
	prometheusTypeList = "prometheusList"
	prometheusLabel    = "prometheus"

	rbacs        = "rbacs"
	rbacType     = "rbac"
	rbacTypeList = "rbacList"
	rbacLabel    = "rbac"

	servicecontrols        = "servicecontrols"
	servicecontrolType     = "servicecontrol"
	servicecontrolTypeList = "servicecontrolList"
	servicecontrolLabel    = "servicecontrol"

	solarwindses       = "solarwindses"
	solarwindsType     = "solarwinds"
	solarwindsTypeList = "solarwindsList"
	solarwindsLabel    = "solarwinds"

	stackdrivers        = "stackdrivers"
	stackdriverType     = "stackdriver"
	stackdriverTypeList = "stackdriverList"
	stackdriverLabel    = "stackdriver"

	statsds        = "statsds"
	statsdType     = "statsd"
	statsdTypeList = "statsdList"
	statsdLabel    = "statsd"

	stdios        = "stdios"
	stdioType     = "stdio"
	stdioTypeList = "stdioList"
	stdioLabel    = "stdio"

	// Config - Templates

	apikeys        = "apikeys"
	apikeyType     = "apikey"
	apikeyTypeList = "apikeyList"
	apikeyLabel    = "apikey"

	authorizations        = "authorizations"
	authorizationType     = "authorization"
	authorizationTypeList = "authorizationList"
	authorizationLabel    = "authorization"

	checknothings        = "checknothings"
	checknothingType     = "checknothing"
	checknothingTypeList = "checknothingList"
	checknothingLabel    = "checknothing"

	kuberneteses       = "kuberneteses"
	kubernetesType     = "kubernetes"
	kubernetesTypeList = "kubernetesList"
	kubernetesLabel    = "kubernetes"

	listEntries       = "listentries"
	listEntryType     = "listentry"
	listEntryTypeList = "listentryList"
	listEntryLabel    = "listentry"

	logentries       = "logentries"
	logentryType     = "logentry"
	logentryTypeList = "logentryList"
	logentryLabel    = "logentry"

	metrics        = "metrics"
	metricType     = "metric"
	metricTypeList = "metricList"
	metricLabel    = "metric"

	quotas        = "quotas"
	quotaType     = "quota"
	quotaTypeList = "quotaList"
	quotaLabel    = "quota"

	reportnothings        = "reportnothings"
	reportnothingType     = "reportnothing"
	reportnothingTypeList = "reportnothingList"
	reportnothingLabel    = "reportnothing"

	servicecontrolreports        = "servicecontrolreports"
	servicecontrolreportType     = "servicecontrolreport"
	servicecontrolreportTypeList = "servicecontrolreportList"
	servicecontrolreportLabel    = "servicecontrolreport"
)

var (
	istioConfigGroupVersion = schema.GroupVersion{
		Group:   "config.istio.io",
		Version: "v1alpha2",
	}
	istioNetworkingGroupVersion = schema.GroupVersion{
		Group:   "networking.istio.io",
		Version: "v1alpha3",
	}
	osRouteGroupVersion = schema.GroupVersion{
		Group:   "route.openshift.io",
		Version: "v1",
	}

	// This is used to tell Istio REST client which objects are supported for decoding.
	// When adding a new Istio type we should add a new object here.
	istioKnownTypes = map[string]struct {
		objectKind     string
		collectionKind string
		apiVersion     string
		groupVersion   *schema.GroupVersion
	}{
		gatewayLabel: {
			objectKind:     gatewayType,
			collectionKind: gatewayTypeList,
			apiVersion:     istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
			groupVersion:   &istioNetworkingGroupVersion,
		},
		virtualServiceLabel: {
			objectKind:     virtualServiceType,
			collectionKind: virtualServiceTypeList,
			apiVersion:     istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
			groupVersion:   &istioNetworkingGroupVersion,
		},
		destinationRuleLabel: {
			objectKind:     destinationRuleType,
			collectionKind: destinationRuleTypeList,
			apiVersion:     istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
			groupVersion:   &istioNetworkingGroupVersion,
		},
		serviceentryLabel: {
			objectKind:     serviceentryType,
			collectionKind: serviceentryTypeList,
			apiVersion:     istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
			groupVersion:   &istioNetworkingGroupVersion,
		},
		ruleLabel: {
			objectKind:     ruleType,
			collectionKind: ruleTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		// Adapters
		circonusLabel: {
			objectKind:     circonusType,
			collectionKind: circonusTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		denierLabel: {
			objectKind:     denierType,
			collectionKind: denierTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		fluentdLabel: {
			objectKind:     fluentdType,
			collectionKind: fluentdTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		kubernetesenvLabel: {
			objectKind:     kubernetesenvType,
			collectionKind: kubernetesenvTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		listcheckerLabel: {
			objectKind:     listcheckerType,
			collectionKind: listcheckerTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		memquotaLabel: {
			objectKind:     memquotaType,
			collectionKind: memquotaTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		opaLabel: {
			objectKind:     opaType,
			collectionKind: opaTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		prometheusLabel: {
			objectKind:     prometheusType,
			collectionKind: prometheusTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		rbacLabel: {
			objectKind:     rbacType,
			collectionKind: rbacTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		servicecontrolLabel: {
			objectKind:     servicecontrolType,
			collectionKind: serviceentryTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		solarwindsLabel: {
			objectKind:     solarwindsType,
			collectionKind: solarwindsTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		stackdriverLabel: {
			objectKind:     stackdriverType,
			collectionKind: stackdriverTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		statsdLabel: {
			objectKind:     statsdType,
			collectionKind: stackdriverTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		stdioLabel: {
			objectKind:     stdioType,
			collectionKind: stdioTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		handlerLabel: {
			objectKind:     handlerType,
			collectionKind: handlerTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		// Templates
		apikeyLabel: {
			objectKind:     apikeyType,
			collectionKind: apikeyTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		authorizationLabel: {
			objectKind:     authorizationType,
			collectionKind: authorizationTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		checknothingLabel: {
			objectKind:     checknothingType,
			collectionKind: checknothingTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		kubernetesLabel: {
			objectKind:     kubernetesType,
			collectionKind: kubernetesTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		listEntryLabel: {
			objectKind:     listEntryType,
			collectionKind: listcheckerTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		logentryLabel: {
			objectKind:     logentryType,
			collectionKind: logentryTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		metricLabel: {
			objectKind:     metricType,
			collectionKind: metricTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		quotaLabel: {
			objectKind:     quotaType,
			collectionKind: quotaTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		reportnothingLabel: {
			objectKind:     reportnothingType,
			collectionKind: reportnothingTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		servicecontrolreportLabel: {
			objectKind:     servicecontrolreportType,
			collectionKind: servicecontrolreportTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		// QuotaSpec and QuotaSpecBinding
		quotaspecLabel: {
			objectKind:     quotaspecType,
			collectionKind: quotaspecTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
		quotaspecbindingLabel: {
			objectKind:     quotaspecbindingType,
			collectionKind: quotaspecbindingTypeList,
			apiVersion:     istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
			groupVersion:   &istioConfigGroupVersion,
		},
	}
	// A map to get the plural for a Istio type using the singlar type
	// Used for fetch istio actions details, so only applied to handlers (adapters) and instances (templates) types
	istioTypePlurals = map[string]string{
		// Adapters
		circonusType:       circonuses,
		denierType:         deniers,
		fluentdType:        fluentds,
		kubernetesenvType:  kubernetesenvs,
		listcheckerType:    listcheckers,
		memquotaType:       memquotas,
		opaType:            opas,
		prometheusType:     prometheuses,
		rbacType:           rbacs,
		servicecontrolType: servicecontrols,
		solarwindsType:     solarwindses,
		stackdriverType:    stackdrivers,
		statsdType:         statsds,
		stdioType:          stdios,
		handlerType:        handlers,
		// Templates
		apikeyType:               apikeys,
		authorizationType:        authorizations,
		checknothingType:         checknothings,
		kubernetesType:           kuberneteses,
		listEntryType:            listEntries,
		logentryType:             logentries,
		metricType:               metrics,
		quotaType:                quotas,
		reportnothingType:        reportnothings,
		servicecontrolreportType: servicecontrolreports,
	}
)

// IstioObject is a k8s wrapper interface for config objects.
// Taken from istio.io
type IstioObject interface {
	runtime.Object
	GetSpec() map[string]interface{}
	SetSpec(map[string]interface{})
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
	Services    *v1.ServiceList
	Pods        *v1.PodList
	Deployments *v1beta1.DeploymentList
}

// ServiceDetails is a wrapper to group full Service description, Endpoints and Pods.
// Used to fetch all details in a single operation instead to invoke individual APIs per each group.
type ServiceDetails struct {
	Service     *v1.Service                                `json:"service"`
	Endpoints   *v1.Endpoints                              `json:"endpoints"`
	Deployments *v1beta1.DeploymentList                    `json:"deployments"`
	Autoscalers *autoscalingV1.HorizontalPodAutoscalerList `json:"autoscalers"`
	Pods        []v1.Pod                                   `json:"pods"`
}

// IstioDetails is a wrapper to group all Istio objects related to a Service.
// Used to fetch all Istio information in a single operation instead to invoke individual APIs per each group.
type IstioDetails struct {
	VirtualServices  []IstioObject `json:"virtualservices"`
	DestinationRules []IstioObject `json:"destinationrules"`
	ServiceEntries   []IstioObject `json:"serviceentries"`
	Gateways         []IstioObject `json:"gateways"`
}

// IstioRules is a wrapper to group all mixer rules related to a Namespace.
// Rules can have match expressions that may dynamically affect to several services.
type IstioRules struct {
	Rules []IstioObject `json:"rules"`
}

// IstioRuleAction is a wrapper to group a handler object and a list of instances per a specific action.
type IstioRuleAction struct {
	Handler   IstioObject   `json:"handler"`
	Instances []IstioObject `json:"instances"`
}

// IstioRuleDetails is a wrapper to group a mixer rule with its actions.
type IstioRuleDetails struct {
	Rule    IstioObject        `json:"rule"`
	Actions []*IstioRuleAction `json:"actions"`
}

type istioResponse struct {
	result  IstioObject
	results []IstioObject
	err     error
}

type actionsType = []interface{}
type actionType = map[string]interface{}
type instancesType = []interface{}

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
