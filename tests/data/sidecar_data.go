package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateSidecar(name string) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        name,
			Namespace:   "bookinfo",
			ClusterName: "svc.cluster.local",
		},
		Spec: map[string]interface{}{},
	}).DeepCopyIstioObject()
}

func AddSelectorToSidecar(selector map[string]interface{}, sc kubernetes.IstioObject) kubernetes.IstioObject {
	sc.GetSpec()["workloadSelector"] = selector
	return sc
}

func AddHostsToSidecar(hl []interface{}, sc kubernetes.IstioObject) kubernetes.IstioObject {
	fullEgress := []interface{}{
		map[string]interface{}{
			"hosts": hl,
		},
	}

	sc.GetSpec()["egress"] = fullEgress
	return sc
}
