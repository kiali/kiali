package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

// HttpApiSpecs httpApiSpecs
//
// This is used for returning an array of HttpApiSpec
//
// swagger:model httpApiSpecs
// An array of httpApiSpec
// swagger:allOf
type HttpApiSpecs []HttpApiSpec

// HttpApiSpec httpApiSpec
//
// This is used for returning an HttpApiSpec
//
// swagger:model httpApiSpec
type HttpApiSpec struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Attributes interface{} `json:"attributes"`
		Patterns   interface{} `json:"patterns"`
		ApiKeys    interface{} `json:"apiKeys"`
	} `json:"spec"`
}

func (has *HttpApiSpecs) Parse(httpApiSpecs []kubernetes.IstioObject) {
	for _, ha := range httpApiSpecs {
		httpApiSpec := HttpApiSpec{}
		httpApiSpec.Parse(ha)
		*has = append(*has, httpApiSpec)
	}
}

func (ef *HttpApiSpec) Parse(httpApiSpec kubernetes.IstioObject) {
	ef.TypeMeta = httpApiSpec.GetTypeMeta()
	ef.Metadata = httpApiSpec.GetObjectMeta()
	ef.Spec.Attributes = httpApiSpec.GetSpec()["attributes"]
	ef.Spec.Patterns = httpApiSpec.GetSpec()["patterns"]
	ef.Spec.ApiKeys = httpApiSpec.GetSpec()["apiKeys"]
}
