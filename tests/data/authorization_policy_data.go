package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateAuthorizationPolicy(sourceNamespaces []interface{}) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "auth-policy",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"selector": []interface{}{
				map[string]interface{}{
					"app": "ratings",
				},
			},
			"rules": []interface{}{
				map[string]interface{}{
					"from": []interface{}{
						map[string]interface{}{
							"source": map[string]interface{}{
								"namespaces": sourceNamespaces,
							},
						},
					},
					"to":   "http-example",
					"when": "HTTP",
				},
			},
		},
	}).DeepCopyIstioObject()
}
