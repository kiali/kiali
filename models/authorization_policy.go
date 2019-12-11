package models

import (
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AuthorizationPolicies authorizationPolicies
//
// This is used for returning an array of AuthorizationPolicies
//
// swagger:model authorizationRules
// An array of authorizationPolicy
// swagger:allOf
type AuthorizationPolicies []AuthorizationPolicy

// AuthorizationPolicy authorizationPolicy
//
// This is used for returning an AuthorizationPolicy
//
// swagger:model authorizationPolicy
type AuthorizationPolicy struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Selector interface{} `json:"selector"`
		Rules    interface{} `json:"rules"`
	} `json:"spec"`
}

func (aps *AuthorizationPolicies) Parse(authorizationPolicies []kubernetes.IstioObject) {
	for _, authPol := range authorizationPolicies {
		ap := AuthorizationPolicy{}
		ap.Parse(authPol)
		*aps = append(*aps, ap)
	}
}

func (ap *AuthorizationPolicy) Parse(authorizationPolicy kubernetes.IstioObject) {
	ap.TypeMeta = authorizationPolicy.GetTypeMeta()
	ap.Metadata = authorizationPolicy.GetObjectMeta()
	ap.Spec.Selector = authorizationPolicy.GetSpec()["selector"]
	ap.Spec.Rules = authorizationPolicy.GetSpec()["rules"]
}
