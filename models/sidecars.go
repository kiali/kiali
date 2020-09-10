package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type Sidecars []Sidecar
type Sidecar struct {
	IstioBase
	Spec struct {
		WorkloadSelector      interface{} `json:"workloadSelector"`
		Ingress               interface{} `json:"ingress"`
		Egress                interface{} `json:"egress"`
		OutboundTrafficPolicy interface{} `json:"outboundTrafficPolicy"`
		Localhost             interface{} `json:"localhost"`
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
	sc.IstioBase.Parse(sidecar)
	sc.Spec.WorkloadSelector = sidecar.GetSpec()["workloadSelector"]
	sc.Spec.Ingress = sidecar.GetSpec()["ingress"]
	sc.Spec.Egress = sidecar.GetSpec()["egress"]
	sc.Spec.OutboundTrafficPolicy = sidecar.GetSpec()["outboundTrafficPolicy"]
	sc.Spec.Localhost = sidecar.GetSpec()["localhost"]
}
