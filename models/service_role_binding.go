package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ServiceRoleBindings []ServiceRoleBinding
type ServiceRoleBinding struct {
	IstioBase
	Spec struct {
		Subjects interface{} `json:"subjects"`
		RoleRef  interface{} `json:"roleRef"`
	} `json:"spec"`
}

func (srbs *ServiceRoleBindings) Parse(serviceRoleBindings []kubernetes.IstioObject) {
	for _, srb := range serviceRoleBindings {
		serviceRoleBinding := ServiceRoleBinding{}
		serviceRoleBinding.Parse(srb)
		*srbs = append(*srbs, serviceRoleBinding)
	}
}

func (srb *ServiceRoleBinding) Parse(serviceRoleBinding kubernetes.IstioObject) {
	srb.IstioBase.Parse(serviceRoleBinding)
	srb.Spec.Subjects = serviceRoleBinding.GetSpec()["subjects"]
	srb.Spec.RoleRef = serviceRoleBinding.GetSpec()["roleRef"]
}
