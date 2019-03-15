package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type RbacConfigs []RbacConfig
type RbacConfig struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Mode      interface{} `json:"mode"`
		Inclusion interface{} `json:"inclusion"`
		Exclusion interface{} `json:"exclusion"`
	} `json:"spec"`
}

func (rcs *RbacConfigs) Parse(rbacConfigs []kubernetes.IstioObject) {
	for _, rc := range rbacConfigs {
		rbacConfig := RbacConfig{}
		rbacConfig.Parse(rc)
		*rcs = append(*rcs, rbacConfig)
	}
}

func (rc *RbacConfig) Parse(rbacConfig kubernetes.IstioObject) {
	rc.TypeMeta = rbacConfig.GetTypeMeta()
	rc.Metadata = rbacConfig.GetObjectMeta()
	rc.Spec.Mode = rbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = rbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = rbacConfig.GetSpec()["exclusion"]
}
