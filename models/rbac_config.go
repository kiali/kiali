package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type RbacConfigs []RbacConfig
type RbacConfig struct {
	IstioBase
	Spec struct {
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
	rc.IstioBase.Parse(rbacConfig)
	rc.Spec.Mode = rbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = rbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = rbacConfig.GetSpec()["exclusion"]
}
