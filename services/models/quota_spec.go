package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type QuotaSpecs []QuotaSpec
type QuotaSpec struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"createdAt"`
	ResourceVersion string      `json:"resourceVersion"`
	Rules           interface{} `json:"rules"`
}

func (qss *QuotaSpecs) Parse(quotaSpecs []kubernetes.IstioObject) {
	for _, qs := range quotaSpecs {
		quotaSpec := QuotaSpec{}
		quotaSpec.Parse(qs)
		*qss = append(*qss, quotaSpec)
	}
}

func (qs *QuotaSpec) Parse(quotaSpec kubernetes.IstioObject) {
	qs.Name = quotaSpec.GetObjectMeta().Name
	qs.CreatedAt = formatTime(quotaSpec.GetObjectMeta().CreationTimestamp.Time)
	qs.ResourceVersion = quotaSpec.GetObjectMeta().ResourceVersion
	qs.Rules = quotaSpec.GetSpec()["rules"]
}
