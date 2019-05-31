package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type Sidecars []Sidecar
type Sidecar struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		WorkloadSelector interface{} `json:"workloadSelector"`
		Ingress          interface{} `json:"ingress"`
		Egress           interface{} `json:"egress"`
	} `json:"spec"`
}

func (scs *Sidecars) Parse(sidecars []kubernetes.IstioObject) {
	for _, sc := range sidecars {
		sidecar := Sidecar{}
		sidecar.Parse(sc)
		*scs = append(*scs, sidecar)
	}
}

func (sc *Sidecar) Parse(sidecar kubernetes.IstioObject) {
	sc.TypeMeta = sidecar.GetTypeMeta()
	sc.Metadata = sidecar.GetObjectMeta()
	sc.Spec.WorkloadSelector = sidecar.GetSpec()["workloadSelector"]
	sc.Spec.Ingress = sidecar.GetSpec()["ingress"]
	sc.Spec.Egress = sidecar.GetSpec()["egress"]
}
