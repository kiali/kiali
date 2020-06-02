package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
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
	ef.TypeMeta = envoyFilter.GetTypeMeta()
	ef.Metadata = envoyFilter.GetObjectMeta()
	ef.Spec.WorkloadSelector = envoyFilter.GetSpec()["workloadSelector"]
	ef.Spec.ConfigPatches = envoyFilter.GetSpec()["configPatches"]
}
