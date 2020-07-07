package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

// AuthorizationPolicies authorizationPolicies
//
// This is used for returning an array of AuthorizationPolicies
//
// swagger:model authorizationPolicies
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
		Action   interface{} `json:"action"`
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
	ap.Spec.Action = authorizationPolicy.GetSpec()["action"]
}
