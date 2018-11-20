package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type QuotaSpecBindings []QuotaSpecBinding
type QuotaSpecBinding struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"createdAt"`
	ResourceVersion string      `json:"resourceVersion"`
	QuotaSpecs      interface{} `json:"quotaSpecs"`
	Services        interface{} `json:"services"`
}

func (qsbs *QuotaSpecBindings) Parse(quotaSpecBindings []kubernetes.IstioObject) {
	for _, qsb := range quotaSpecBindings {
		quotaSpecBinding := QuotaSpecBinding{}
		quotaSpecBinding.Parse(qsb)
		*qsbs = append(*qsbs, quotaSpecBinding)
	}
}

func (qsb *QuotaSpecBinding) Parse(quotaSpecBinding kubernetes.IstioObject) {
	qsb.Name = quotaSpecBinding.GetObjectMeta().Name
	qsb.CreatedAt = formatTime(quotaSpecBinding.GetObjectMeta().CreationTimestamp.Time)
	qsb.ResourceVersion = quotaSpecBinding.GetObjectMeta().ResourceVersion
	qsb.QuotaSpecs = quotaSpecBinding.GetSpec()["quotaSpecs"]
	qsb.Services = quotaSpecBinding.GetSpec()["services"]
}
