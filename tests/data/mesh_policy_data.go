package data

import (
	"github.com/kiali/kiali/kubernetes"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CreateEmptyMeshPolicy(name string, peers []interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        name,
			ClusterName: "svc.cluster.local",
		},
		Spec: map[string]interface{}{
			"peers": peers,
		},
	}).DeepCopyIstioObject()
}

func AddTargetsToMeshPolicy(targets []interface{}, mp kubernetes.IstioObject) kubernetes.IstioObject {
	mp.GetSpec()["targets"] = targets
	return mp
}
