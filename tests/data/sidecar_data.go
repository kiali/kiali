package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateSidecar(name string) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{},
	}).DeepCopyIstioObject()
}

func AddSelectorToSidecar(selector map[string]interface{}, gw kubernetes.IstioObject) kubernetes.IstioObject {
	gw.GetSpec()["workloadSelector"] = selector
	return gw
}
