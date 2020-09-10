package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// PeerAuthentications peerAuthentications
//
// This is used for returning an array of PeerAuthentication
//
// swagger:model peerAuthentications
// An array of peerAuthentication
// swagger:allOf
type PeerAuthentications []PeerAuthentication

// PeerAuthentication peerAuthentication
//
// This is used for returning an PeerAuthentication
//
// swagger:model peerAuthentication
type PeerAuthentication struct {
	IstioBase
	Spec struct {
		Selector      interface{} `json:"selector"`
		Mtls          interface{} `json:"mtls"`
		PortLevelMtls interface{} `json:"portLevelMtls"`
	} `json:"spec"`
}

func (pas *PeerAuthentications) Parse(peerAuthentications []kubernetes.IstioObject) {
	for _, peerAuth := range peerAuthentications {
		pa := PeerAuthentication{}
		pa.Parse(peerAuth)
		*pas = append(*pas, pa)
	}
}

func (pa *PeerAuthentication) Parse(peerAuthentication kubernetes.IstioObject) {
	pa.IstioBase.Parse(peerAuthentication)
	pa.Spec.Selector = peerAuthentication.GetSpec()["selector"]
	pa.Spec.Mtls = peerAuthentication.GetSpec()["mtls"]
	pa.Spec.PortLevelMtls = peerAuthentication.GetSpec()["portLevelMtls"]
}
