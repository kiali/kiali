package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type QuotaSpecs []QuotaSpec
type QuotaSpec struct {
	IstioBase
	Spec struct {
		Rules interface{} `json:"rules"`
	} `json:"spec"`
}

func (qss *QuotaSpecs) Parse(quotaSpecs []kubernetes.IstioObject) {
	for _, qs := range quotaSpecs {
		quotaSpec := QuotaSpec{}
		quotaSpec.Parse(qs)
		*qss = append(*qss, quotaSpec)
	}
}

func (qs *QuotaSpec) Parse(quotaSpec kubernetes.IstioObject) {
	qs.IstioBase.Parse(quotaSpec)
	qs.Spec.Rules = quotaSpec.GetSpec()["rules"]
}
