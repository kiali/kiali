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
	// Sync these constants with the Istio version, it is uniform but probably it might change on major Istio vesions.
	istioGroupVersion = schema.GroupVersion{
		Group:   "config.istio.io",
		Version: "v1alpha2",
	}
	// This is used to tell Istio REST client which objects are supported for decoding.
	// When adding a new Istio type we should add a new object here.
	istioKnownTypes = map[string]struct {
		object     IstioObject
		collection IstioObjectList
	}{
		routeRuleLabel: {
			object: &RouteRule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       routeRuleType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &RouteRuleList{},
		},
		destinationPolicyLabel: {
			object: &DestinationPolicy{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       destinationPolicyType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &DestinationPolicyList{},
		},
		ruleLabel: {
			object: &rule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       ruleType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &ruleList{},
		},
		// Adapters
		circonusLabel: {
			object: &circonus{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       circonusType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &circonusList{},
		},
		denierLabel: {
			object: &denier{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       denierType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &denierList{},
		},
		fluentdLabel: {
			object: &fluentd{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       fluentdType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &fluentdList{},
		},
		kubernetesenvLabel: {
			object: &kubernetesenv{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       kubernetesenvType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &kubernetesenvList{},
		},
		listcheckerLabel: {
			object: &listchecker{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       listcheckerType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &listcheckerList{},
		},
		memquotaLabel: {
			object: &memquota{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       memquotaType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &memquotaList{},
		},
		opaLabel: {
			object: &opa{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       opaType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &opaList{},
		},
		prometheusLabel: {
			object: &prometheus{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       prometheusType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &prometheusList{},
		},
		rbacLabel: {
			object: &rbac{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       rbacType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &rbacList{},
		},
		servicecontrolLabel: {
			object: &servicecontrol{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       servicecontrolType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &servicecontrolList{},
		},
		solarwindsLabel: {
			object: &solarwinds{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       solarwindsType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &solarwindsList{},
		},
		stackdriverLabel: {
			object: &stackdriver{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       stackdriverType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &stackdriverList{},
		},
		statsdLabel: {
			object: &statsd{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       statsdType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &statsdList{},
		},
		stdioLabel: {
			object: &stdio{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       stdioType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &stdioList{},
		},
		// Templates
		apikeyLabel: {
			object: &apikey{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       apikeyType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &apikeyList{},
		},
		authorizationLabel: {
			object: &authorization{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       authorizationType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &authorizationList{},
		},
		checknothingLabel: {
			object: &checknothing{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       checknothingType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &checknothingList{},
		},
		kubernetesLabel: {
			object: &kubernetes{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       kubernetesType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &kubernetesList{},
		},
		listEntryLabel: {
			object: &listentry{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       listEntryType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &listentryList{},
		},
		logentryLabel: {
			object: &logentry{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       logentryType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &logentryList{},
		},
		metricLabel: {
			object: &metric{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       metricType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &metricList{},
		},
		quotaLabel: {
			object: &quota{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       quotaType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &quotaList{},
		},
		reportnothingLabel: {
			object: &reportnothing{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       reportnothingType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &reportnothingList{},
		},
		servicecontrolreportLabel: {
			object: &servicecontrolreport{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       servicecontrolreportType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &servicecontrolreportList{},
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
	osRouteGroupVersion = schema.GroupVersion{
		Group:   "route.openshift.io",
		Version: "v1",
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
	Deployments *v1beta1.DeploymentList
}

// ServiceDetails is a wrapper to group full Service description, Endpoints and Pods.
// Used to fetch all details in a single operation instead to invoke individual APIs per each group.
type ServiceDetails struct {
	Service     *v1.Service                                `json:"service"`
	Endpoints   *v1.Endpoints                              `json:"endpoints"`
	Deployments *v1beta1.DeploymentList                    `json:"deployments"`
	Autoscalers *autoscalingV1.HorizontalPodAutoscalerList `json:"autoscalers"`
}

// IstioDetails is a wrapper to group all Istio objects related to a Service.
// Used to fetch all Istio information in a single operation instead to invoke individual APIs per each group.
type IstioDetails struct {
	RouteRules          []IstioObject `json:"routerules"`
	DestinationPolicies []IstioObject `json:"destinationpolicies"`
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
