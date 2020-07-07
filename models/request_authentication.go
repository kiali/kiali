package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

// RequestAuthentications requestAuthentications
//
// This is used for returning an array of RequestAuthentication
//
// swagger:model requestAuthentications
// An array of requestAuthentication
// swagger:allOf
type RequestAuthentications []RequestAuthentication

// RequestAuthentication requestAuthentication
//
// This is used for returning an RequestAuthentication
//
// swagger:model requestAuthentication
type RequestAuthentication struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Selector interface{} `json:"selector"`
		JwtRules interface{} `json:"jwtRules"`
	} `json:"spec"`
}

func (ras *RequestAuthentications) Parse(requestAuthentications []kubernetes.IstioObject) {
	for _, reqAuth := range requestAuthentications {
		ra := RequestAuthentication{}
		ra.Parse(reqAuth)
		*ras = append(*ras, ra)
	}
}

func (ra *RequestAuthentication) Parse(requestAuthentication kubernetes.IstioObject) {
	ra.TypeMeta = requestAuthentication.GetTypeMeta()
	ra.Metadata = requestAuthentication.GetObjectMeta()
	ra.Spec.Selector = requestAuthentication.GetSpec()["selector"]
	ra.Spec.JwtRules = requestAuthentication.GetSpec()["jwtRules"]
}
