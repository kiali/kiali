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
		RouteRuleLabel: {
			object: &RouteRule{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       RouteRuleType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &RouteRuleList{},
		},
		DestinationPolicyLabel: {
			object: &DestinationPolicy{
				TypeMeta: meta_v1.TypeMeta{
					Kind:       DestinationPolicyType,
					APIVersion: istioGroupVersion.Group + "/" + istioGroupVersion.Version,
				},
			},
			collection: &DestinationPolicyList{},
		},
	}
	osRouteGroupVersion = schema.GroupVersion{
		Group:   "route.openshift.io",
		Version: "v1",
	}
)

// IstioObject is a k8s wrapper interface for config objects
// Taken from istio.io
type IstioObject interface {
	runtime.Object
	GetSpec() map[string]interface{}
	SetSpec(map[string]interface{})
	GetObjectMeta() meta_v1.ObjectMeta
	SetObjectMeta(meta_v1.ObjectMeta)
}

type IstioObjectList interface {
	runtime.Object
	GetItems() []IstioObject
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
	RouteRules          []*RouteRule         `json:"routerules"`
	DestinationPolicies []*DestinationPolicy `json:"destinationpolicies"`
}
