package models

import (
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
	IstioBase
	Spec struct {
		Selector interface{} `json:"selector,omitempty"`
		Rules    interface{} `json:"rules,omitempty"`
		Action   interface{} `json:"action,omitempty"`
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
	ap.IstioBase.Parse(authorizationPolicy)
	ap.Spec.Selector = authorizationPolicy.GetSpec()["selector"]
	ap.Spec.Rules = authorizationPolicy.GetSpec()["rules"]
	ap.Spec.Action = authorizationPolicy.GetSpec()["action"]
}
