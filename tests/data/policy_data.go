package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyPolicy(name, namespace string, peers []interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"peers": peers,
		},
	}).DeepCopyIstioObject()
}

func CreateEmptyPolicyWithTargets(name, namespace string, targets []interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"targets": targets,
		},
	}).DeepCopyIstioObject()
}
