package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     MeshPolicySpec     `json:"spec"`
}

func (mps *MeshPolicies) Parse(meshPolicies []kubernetes.IstioObject) {
	for _, qs := range meshPolicies {
		meshPolicy := MeshPolicy{}
		meshPolicy.Parse(qs)
		*mps = append(*mps, meshPolicy)
	}
}

func (mp *MeshPolicy) Parse(meshPolicy kubernetes.IstioObject) {
	mp.TypeMeta = meshPolicy.GetTypeMeta()
	mp.Metadata = meshPolicy.GetObjectMeta()
	mp.Spec.Targets = meshPolicy.GetSpec()["targets"]
	mp.Spec.Peers = meshPolicy.GetSpec()["peers"]
	mp.Spec.PeerIsOptional = meshPolicy.GetSpec()["peersIsOptional"]
	mp.Spec.Origins = meshPolicy.GetSpec()["origins"]
	mp.Spec.OriginIsOptional = meshPolicy.GetSpec()["originIsOptinal"]
	mp.Spec.PrincipalBinding = meshPolicy.GetSpec()["principalBinding"]
}

// ServiceMeshPolicy is a clone of MeshPolicy used by Maistra for multitenancy scenarios
// Used in the same file for easy maintenance

type ServiceMeshPolicies []ServiceMeshPolicy
type ServiceMeshPolicy struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     MeshPolicySpec     `json:"spec"`
}

func (mps *ServiceMeshPolicies) Parse(smPolicies []kubernetes.IstioObject) {
	for _, qs := range smPolicies {
		smPolicy := ServiceMeshPolicy{}
		smPolicy.Parse(qs)
		*mps = append(*mps, smPolicy)
	}
}

func (mp *ServiceMeshPolicy) Parse(smPolicy kubernetes.IstioObject) {
	mp.TypeMeta = smPolicy.GetTypeMeta()
	mp.Metadata = smPolicy.GetObjectMeta()
	mp.Spec.Targets = smPolicy.GetSpec()["targets"]
	mp.Spec.Peers = smPolicy.GetSpec()["peers"]
	mp.Spec.PeerIsOptional = smPolicy.GetSpec()["peersIsOptional"]
	mp.Spec.Origins = smPolicy.GetSpec()["origins"]
	mp.Spec.OriginIsOptional = smPolicy.GetSpec()["originIsOptinal"]
	mp.Spec.PrincipalBinding = smPolicy.GetSpec()["principalBinding"]
}
