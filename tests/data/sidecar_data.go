package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateSidecar(selector map[string]interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "auth-policy",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"workloadSelector": map[string]interface{}{
				"labels": selector,
			},
		},
	}).DeepCopyIstioObject()
}
