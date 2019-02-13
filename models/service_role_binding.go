package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type ServiceRoleBindings []ServiceRoleBinding
type ServiceRoleBinding struct {
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Subjects interface{} `json:"subjects"`
		RoleRef  interface{} `json:"roleRef"`
	} `json:"spec"`
}

func (srbs *ServiceRoleBindings) Parse(serviceRoles []kubernetes.IstioObject) {
	for _, srb := range serviceRoles {
		serviceRoleBinding := ServiceRoleBinding{}
		serviceRoleBinding.Parse(srb)
		*srbs = append(*srbs, serviceRoleBinding)
	}
}

func (srb *ServiceRoleBinding) Parse(serviceRole kubernetes.IstioObject) {
	srb.Metadata = serviceRole.GetObjectMeta()
	srb.Spec.Subjects = serviceRole.GetSpec()["subjects"]
	srb.Spec.RoleRef = serviceRole.GetSpec()["roleRef"]
}
