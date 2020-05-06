package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyPolicy(name, namespace string, mtls interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"mtls": mtls,
		},
	}).DeepCopyIstioObject()
}

func CreateEmptyMeshPeerAuthentication(name string, mtls interface{}) kubernetes.IstioObject {
	return CreateEmptyPolicy(name, "istio-system", mtls)
}

func CreateEmptyPolicyWithTargets(name, namespace string, selector interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"selector": selector,
		},
	}).DeepCopyIstioObject()
}

func AddSelectorToPolicy(selector map[string]interface{}, mp kubernetes.IstioObject) kubernetes.IstioObject {
	mp.GetSpec()["selector"] = selector
	return mp
}

func CreateMTLS(mode string) interface{} {
	return map[string]interface{}{
		"mode": mode,
	}
}

func CreateOneLabelSelector(value string) map[string]interface{} {
	return map[string]interface{}{
		"matchLabels": map[string]interface{}{
			"app": value,
		},
	}
}
