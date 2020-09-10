package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ServiceRoles []ServiceRole
type ServiceRole struct {
	IstioBase
	Spec struct {
		Rules interface{} `json:"rules"`
	} `json:"spec"`
}

func (srs *ServiceRoles) Parse(serviceRoles []kubernetes.IstioObject) {
	for _, sr := range serviceRoles {
		serviceRole := ServiceRole{}
		serviceRole.Parse(sr)
		*srs = append(*srs, serviceRole)
	}
}

func (sr *ServiceRole) Parse(serviceRole kubernetes.IstioObject) {
	sr.IstioBase.Parse(serviceRole)
	sr.Spec.Rules = serviceRole.GetSpec()["rules"]
}
