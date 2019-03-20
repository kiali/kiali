package data

import (
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CreateEmptyServiceRole(name, namespace string) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{},
	})
}

func AddServicesToServiceRole(services []string, sr kubernetes.IstioObject) kubernetes.IstioObject {
	srs := make([]interface{}, 0, len(services))
	for _, s := range services {
		srs = append(srs, s)
	}
	sr.GetSpec()["rules"] = []interface{}{
		map[string]interface{}{
			"services": srs,
		},
	}
	return sr
}

func CreateEmptyServiceBindingRole(name, namespace string) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{},
	})
}

func AddRoleRefToServiceBindingRole(serviceRoleName string, sbr kubernetes.IstioObject) kubernetes.IstioObject {
	sbr.GetSpec()["roleRef"] = map[string]interface{}{
		"kind": "ServiceRole",
		"name": serviceRoleName,
	}
	return sbr
}
