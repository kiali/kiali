package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// HttpApiSpecBindings httpApiSpecBindings
//
// This is used for returning an array of HttpApiSpecBinding
//
// swagger:model httpApiSpecBindings
// An array of httpApiSpecBinding
// swagger:allOf
type HttpApiSpecBindings []HttpApiSpecBinding

// HttpApiSpecBinding httpApiSpecBinding
//
// This is used for returning an HttpApiSpecBinding
//
// swagger:model httpApiSpecBinding
type HttpApiSpecBinding struct {
	IstioBase
	Spec struct {
		Services interface{} `json:"services"`
		ApiSpecs interface{} `json:"apiSpecs"`
	} `json:"spec"`
}

func (has *HttpApiSpecBindings) Parse(httpApiSpecBindings []kubernetes.IstioObject) {
	for _, ha := range httpApiSpecBindings {
		httpApiSpecBinding := HttpApiSpecBinding{}
		httpApiSpecBinding.Parse(ha)
		*has = append(*has, httpApiSpecBinding)
	}
}

func (ha *HttpApiSpecBinding) Parse(httpApiSpecBinding kubernetes.IstioObject) {
	ha.IstioBase.Parse(httpApiSpecBinding)
	ha.Spec.Services = httpApiSpecBinding.GetSpec()["services"]
	ha.Spec.ApiSpecs = httpApiSpecBinding.GetSpec()["apiSpecs"]
}
