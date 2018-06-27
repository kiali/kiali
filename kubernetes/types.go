package kubernetes

import (
	"k8s.io/api/apps/v1beta1"
	autoscalingV1 "k8s.io/api/autoscaling/v1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
		object       IstioObject
		collection   IstioObjectList
		groupVersion *schema.GroupVersion
	}{
		gatewayLabel: {
			object: &Gateway{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       gatewayType,
					APIVersion: istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
				},
			},
			collection:   &GatewayList{},
			groupVersion: &istioNetworkingGroupVersion,
		},
		routeRuleLabel: {
			object: &RouteRule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       routeRuleType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &RouteRuleList{},
			groupVersion: &istioConfigGroupVersion,
		},
		virtualServiceLabel: {
			object: &VirtualService{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       virtualServiceType,
					APIVersion: istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
				},
			},
			collection:   &VirtualServiceList{},
			groupVersion: &istioNetworkingGroupVersion,
		},
		destinationPolicyLabel: {
			object: &DestinationPolicy{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       destinationPolicyType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &DestinationPolicyList{},
			groupVersion: &istioConfigGroupVersion,
		},
		destinationRuleLabel: {
			object: &DestinationRule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       destinationRuleType,
					APIVersion: istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
				},
			},
			collection:   &DestinationRuleList{},
			groupVersion: &istioNetworkingGroupVersion,
		},
		serviceentryLabel: {
			object: &ServiceEntry{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       serviceentryType,
					APIVersion: istioNetworkingGroupVersion.Group + "/" + istioNetworkingGroupVersion.Version,
				},
			},
			collection:   &ServiceEntryList{},
			groupVersion: &istioNetworkingGroupVersion,
		},
		ruleLabel: {
			object: &rule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       ruleType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &ruleList{},
			groupVersion: &istioConfigGroupVersion,
		},
		// Adapters
		circonusLabel: {
			object: &circonus{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       circonusType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &circonusList{},
			groupVersion: &istioConfigGroupVersion,
		},
		denierLabel: {
			object: &denier{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       denierType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &denierList{},
			groupVersion: &istioConfigGroupVersion,
		},
		fluentdLabel: {
			object: &fluentd{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       fluentdType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &fluentdList{},
			groupVersion: &istioConfigGroupVersion,
		},
		kubernetesenvLabel: {
			object: &kubernetesenv{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       kubernetesenvType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &kubernetesenvList{},
			groupVersion: &istioConfigGroupVersion,
		},
		listcheckerLabel: {
			object: &listchecker{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       listcheckerType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &listcheckerList{},
			groupVersion: &istioConfigGroupVersion,
		},
		memquotaLabel: {
			object: &memquota{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       memquotaType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &memquotaList{},
			groupVersion: &istioConfigGroupVersion,
		},
		opaLabel: {
			object: &opa{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       opaType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &opaList{},
			groupVersion: &istioConfigGroupVersion,
		},
		prometheusLabel: {
			object: &prometheus{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       prometheusType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &prometheusList{},
			groupVersion: &istioConfigGroupVersion,
		},
		rbacLabel: {
			object: &rbac{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       rbacType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &rbacList{},
			groupVersion: &istioConfigGroupVersion,
		},
		servicecontrolLabel: {
			object: &servicecontrol{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       servicecontrolType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &servicecontrolList{},
			groupVersion: &istioConfigGroupVersion,
		},
		solarwindsLabel: {
			object: &solarwinds{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       solarwindsType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &solarwindsList{},
			groupVersion: &istioConfigGroupVersion,
		},
		stackdriverLabel: {
			object: &stackdriver{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       stackdriverType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &stackdriverList{},
			groupVersion: &istioConfigGroupVersion,
		},
		statsdLabel: {
			object: &statsd{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       statsdType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &statsdList{},
			groupVersion: &istioConfigGroupVersion,
		},
		stdioLabel: {
			object: &stdio{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       stdioType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &stdioList{},
			groupVersion: &istioConfigGroupVersion,
		},
		// Templates
		apikeyLabel: {
			object: &apikey{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       apikeyType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &apikeyList{},
			groupVersion: &istioConfigGroupVersion,
		},
		authorizationLabel: {
			object: &authorization{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       authorizationType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &authorizationList{},
			groupVersion: &istioConfigGroupVersion,
		},
		checknothingLabel: {
			object: &checknothing{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       checknothingType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &checknothingList{},
			groupVersion: &istioConfigGroupVersion,
		},
		kubernetesLabel: {
			object: &kubernetes{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       kubernetesType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &kubernetesList{},
			groupVersion: &istioConfigGroupVersion,
		},
		listEntryLabel: {
			object: &listentry{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       listEntryType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &listentryList{},
			groupVersion: &istioConfigGroupVersion,
		},
		logentryLabel: {
			object: &logentry{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       logentryType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &logentryList{},
			groupVersion: &istioConfigGroupVersion,
		},
		metricLabel: {
			object: &metric{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       metricType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &metricList{},
			groupVersion: &istioConfigGroupVersion,
		},
		quotaLabel: {
			object: &quota{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       quotaType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &quotaList{},
			groupVersion: &istioConfigGroupVersion,
		},
		reportnothingLabel: {
			object: &reportnothing{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       reportnothingType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &reportnothingList{},
			groupVersion: &istioConfigGroupVersion,
		},
		servicecontrolreportLabel: {
			object: &servicecontrolreport{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       servicecontrolreportType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &servicecontrolreportList{},
			groupVersion: &istioConfigGroupVersion,
		},
		// QuotaSpec and QuotaSpecBinding
		quotaspecLabel: {
			object: &QuotaSpec{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       quotaspecType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &QuotaSpecList{},
			groupVersion: &istioConfigGroupVersion,
		},
		quotaspecbindingLabel: {
			object: &QuotaSpecBinding{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       quotaspecbindingType,
					APIVersion: istioConfigGroupVersion.Group + "/" + istioConfigGroupVersion.Version,
				},
			},
			collection:   &QuotaSpecBindingList{},
			groupVersion: &istioConfigGroupVersion,
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
	RouteRules          []IstioObject `json:"routerules"`
	DestinationPolicies []IstioObject `json:"destinationpolicies"`
	VirtualServices     []IstioObject `json:"virtualservices"`
	DestinationRules    []IstioObject `json:"destinationrules"`
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
