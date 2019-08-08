package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type ClusterRbacConfigSpec struct {
	Mode      interface{} `json:"mode"`
	Inclusion interface{} `json:"inclusion"`
	Exclusion interface{} `json:"exclusion"`
}

type ClusterRbacConfigs []ClusterRbacConfig
type ClusterRbacConfig struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta    `json:"metadata"`
	Spec     ClusterRbacConfigSpec `json:"spec"`
}

func (rcs *ClusterRbacConfigs) Parse(clusterRbacConfigs []kubernetes.IstioObject) {
	for _, rc := range clusterRbacConfigs {
		clusterRbacConfig := ClusterRbacConfig{}
		clusterRbacConfig.Parse(rc)
		*rcs = append(*rcs, clusterRbacConfig)
	}
}

func (rc *ClusterRbacConfig) Parse(clusterRbacConfig kubernetes.IstioObject) {
	rc.TypeMeta = clusterRbacConfig.GetTypeMeta()
	rc.Metadata = clusterRbacConfig.GetObjectMeta()
	rc.Spec.Mode = clusterRbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = clusterRbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = clusterRbacConfig.GetSpec()["exclusion"]
}

// ServiceMeshRbacConfig is a clone of ClusterRbacPolicy used by Maistra for multitenancy scenarios
// Used in the same file for easy maintenance

type ServiceMeshRbacConfigs []ServiceMeshRbacConfig
type ServiceMeshRbacConfig struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta    `json:"metadata"`
	Spec     ClusterRbacConfigSpec `json:"spec"`
}

func (rcs *ServiceMeshRbacConfigs) Parse(smRbacConfigs []kubernetes.IstioObject) {
	for _, rc := range smRbacConfigs {
		smRbacConfig := ServiceMeshRbacConfig{}
		smRbacConfig.Parse(rc)
		*rcs = append(*rcs, smRbacConfig)
	}
}

func (rc *ServiceMeshRbacConfig) Parse(smRbacConfig kubernetes.IstioObject) {
	rc.TypeMeta = smRbacConfig.GetTypeMeta()
	rc.Metadata = smRbacConfig.GetObjectMeta()
	rc.Spec.Mode = smRbacConfig.GetSpec()["mode"]
	rc.Spec.Inclusion = smRbacConfig.GetSpec()["inclusion"]
	rc.Spec.Exclusion = smRbacConfig.GetSpec()["exclusion"]
}
