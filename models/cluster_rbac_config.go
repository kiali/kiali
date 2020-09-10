package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ClusterRbacConfigSpec struct {
	Mode      interface{} `json:"mode"`
	Inclusion interface{} `json:"inclusion"`
	Exclusion interface{} `json:"exclusion"`
}

type ClusterRbacConfigs []ClusterRbacConfig
type ClusterRbacConfig struct {
	IstioBase
	Spec ClusterRbacConfigSpec `json:"spec"`
}

func (rcs *ClusterRbacConfigs) Parse(clusterRbacConfigs []kubernetes.IstioObject) {
	for _, rc := range clusterRbacConfigs {
		clusterRbacConfig := ClusterRbacConfig{}
		clusterRbacConfig.Parse(rc)
		*rcs = append(*rcs, clusterRbacConfig)
	}
}

func (rc *ClusterRbacConfig) Parse(clusterRbacConfig kubernetes.IstioObject) {
	rc.IstioBase.Parse(clusterRbacConfig)
	rc.Spec.Mode = clusterRbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = clusterRbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = clusterRbacConfig.GetSpec()["exclusion"]
}

// ServiceMeshRbacConfig is a clone of ClusterRbacPolicy used by Maistra for multitenancy scenarios
// Used in the same file for easy maintenance

type ServiceMeshRbacConfigs []ServiceMeshRbacConfig
type ServiceMeshRbacConfig struct {
	IstioBase
	Spec ClusterRbacConfigSpec `json:"spec"`
}

func (rcs *ServiceMeshRbacConfigs) Parse(smRbacConfigs []kubernetes.IstioObject) {
	for _, rc := range smRbacConfigs {
		smRbacConfig := ServiceMeshRbacConfig{}
		smRbacConfig.Parse(rc)
		*rcs = append(*rcs, smRbacConfig)
	}
}

func (rc *ServiceMeshRbacConfig) Parse(smRbacConfig kubernetes.IstioObject) {
	rc.IstioBase.Parse(smRbacConfig)
	rc.Spec.Mode = smRbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = smRbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = smRbacConfig.GetSpec()["exclusion"]
}
