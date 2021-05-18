package models

import (
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// WorkloadGroups workloadGroups
//
// This is used for returning an array of WorkloadGroup
//
// swagger:model workloadGroups
// An array of workloadGroup
// swagger:allOf
type WorkloadGroups []WorkloadGroup

// WorkloadGroup workloadGroup
//
// This is used for returning a WorkloadGroup
//
// swagger:model workloadGroup
type WorkloadGroup struct {
	IstioBase
	Spec struct {
		Metadata meta_v1.ObjectMeta     `json:"metadata"`
		Template WorkloadEntry          `json:"template"`
		Probe interface{}               `json:"probe"`
	} `json:"spec"`
}

func (wgs *WorkloadGroups) Parse(workloadGroups []kubernetes.IstioObject) {
	for _, wg := range workloadGroups {
		workloadGroup := WorkloadGroup{}
		workloadGroup.Parse(wg)
		*wgs = append(*wgs, workloadGroup)
	}
}

func (wg *WorkloadGroup) Parse(workloadGroup kubernetes.IstioObject) {
	wg.IstioBase.Parse(workloadGroup)
	workloadGroup.SetSpec(workloadGroup.GetSpec())
}
