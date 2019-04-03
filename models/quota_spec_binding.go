package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type QuotaSpecBindings []QuotaSpecBinding
type QuotaSpecBinding struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
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
	qsb.TypeMeta = quotaSpecBinding.GetTypeMeta()
	qsb.Metadata = quotaSpecBinding.GetObjectMeta()
	qsb.Spec.QuotaSpecs = quotaSpecBinding.GetSpec()["quotaSpecs"]
	qsb.Spec.Services = quotaSpecBinding.GetSpec()["services"]
}
