package kubernetes

import (
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Sync these constants with the Istio version, it is uniform but probably it might change on major Istio vesions.
const IstioAPIGroup = "config.istio.io"
const IstioAPIVersion = "v1alpha2"

var IstioGroupVersion = schema.GroupVersion{
	Group: IstioAPIGroup,
	Version: IstioAPIVersion,
}

// This is used to tell Istio REST client which objects are supported for decoding.
// When adding a new Istio type we should add a new object here.
var KnownTypes = map[string]struct {
	object     IstioObject
	collection IstioObjectList
}{
	RouteRuleLabel: {
		object: &RouteRule{
			TypeMeta: meta_v1.TypeMeta{
				Kind:       RouteRuleType,
				APIVersion: IstioGroupVersion.Group + "/" + IstioGroupVersion.Version,
			},
		},
		collection: &RouteRuleList{},
	},
}

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
	Service *v1.Service `json:"service"`
	Endpoints *v1.Endpoints `json:"endpoints"`
	Pods []*v1.Pod `json:pods`
}

// IstioDetails is a wrapper to group all Istio objects related to a Service.
// Used to fetch all Istio information in a single operation instead to invoke individual APIs per each group.
type IstioDetails struct {
	RouteRules []*RouteRule `json:"routerules"`
}