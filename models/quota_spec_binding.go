package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type QuotaSpecBindings []QuotaSpecBinding
type QuotaSpecBinding struct {
	IstioBase
	Spec struct {
		QuotaSpecs interface{} `json:"quotaSpecs"`
		Services   interface{} `json:"services"`
	} `json:"spec"`
}

func (qsbs *QuotaSpecBindings) Parse(quotaSpecBindings []kubernetes.IstioObject) {
	for _, qsb := range quotaSpecBindings {
		quotaSpecBinding := QuotaSpecBinding{}
		quotaSpecBinding.Parse(qsb)
		*qsbs = append(*qsbs, quotaSpecBinding)
	}
}

func (qsb *QuotaSpecBinding) Parse(quotaSpecBinding kubernetes.IstioObject) {
	qsb.IstioBase.Parse(quotaSpecBinding)
	qsb.Spec.QuotaSpecs = quotaSpecBinding.GetSpec()["quotaSpecs"]
	qsb.Spec.Services = quotaSpecBinding.GetSpec()["services"]
}
