package models

import (
	"github.com/kiali/kiali/kubernetes"
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
		// This is not an error, the WorkloadGroup has a Metadata inside the Spec
		// https://istio.io/latest/docs/reference/config/networking/workload-group/#WorkloadGroup
		Metadata interface{}     		`json:"metadata"`
		Template interface{}          	`json:"template"`
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
	wg.Spec.Metadata = workloadGroup.GetSpec()["metadata"]
	wg.Spec.Template = workloadGroup.GetSpec()["template"]
	wg.Spec.Probe = workloadGroup.GetSpec()["probe"]
}
