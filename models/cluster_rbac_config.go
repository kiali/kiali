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
