package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// EnvoyFilters envoyFilters
//
// This is used for returning an array of EnvoyFilter
//
// swagger:model envoyFilters
// An array of envoyFilter
// swagger:allOf
type EnvoyFilters []EnvoyFilter

// EnvoyFilter envoyFilter
//
// This is used for returning an EnvoyFilter
//
// swagger:model envoyFilter
type EnvoyFilter struct {
	IstioBase
	Spec struct {
		WorkloadSelector interface{} `json:"workloadSelector"`
		ConfigPatches    interface{} `json:"configPatches"`
	} `json:"spec"`
}

func (efs *EnvoyFilters) Parse(envoyFilters []kubernetes.IstioObject) {
	for _, ef := range envoyFilters {
		envoyFilter := EnvoyFilter{}
		envoyFilter.Parse(ef)
		*efs = append(*efs, envoyFilter)
	}
}

func (ef *EnvoyFilter) Parse(envoyFilter kubernetes.IstioObject) {
	ef.IstioBase.Parse(envoyFilter)
	ef.Spec.WorkloadSelector = envoyFilter.GetSpec()["workloadSelector"]
	ef.Spec.ConfigPatches = envoyFilter.GetSpec()["configPatches"]
}
