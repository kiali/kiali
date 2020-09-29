package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type MeshPolicySpec struct {
	Targets          interface{} `json:"targets"`
	Peers            interface{} `json:"peers"`
	PeerIsOptional   interface{} `json:"peerIsOptional"`
	Origins          interface{} `json:"origins"`
	OriginIsOptional interface{} `json:"originIsOptional"`
	PrincipalBinding interface{} `json:"principalBinding"`
}

type MeshPolicies []MeshPolicy
type MeshPolicy struct {
	IstioBase
	Spec MeshPolicySpec `json:"spec"`
}

func (mps *MeshPolicies) Parse(meshPolicies []kubernetes.IstioObject) {
	for _, qs := range meshPolicies {
		meshPolicy := MeshPolicy{}
		meshPolicy.Parse(qs)
		*mps = append(*mps, meshPolicy)
	}
}

func (mp *MeshPolicy) Parse(meshPolicy kubernetes.IstioObject) {
	mp.IstioBase.Parse(meshPolicy)
	mp.Spec.Targets = meshPolicy.GetSpec()["targets"]
	mp.Spec.Peers = meshPolicy.GetSpec()["peers"]
	mp.Spec.PeerIsOptional = meshPolicy.GetSpec()["peersIsOptional"]
	mp.Spec.Origins = meshPolicy.GetSpec()["origins"]
	mp.Spec.OriginIsOptional = meshPolicy.GetSpec()["originIsOptinal"]
	mp.Spec.PrincipalBinding = meshPolicy.GetSpec()["principalBinding"]
}
