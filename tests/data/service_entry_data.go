package data

import (
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CreateExternalServiceEntry() kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-svc-wikipedia",
			Namespace: "wikipedia",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"wikipedia.org",
			},
			"location": "MESH_EXTERNAL",
			"ports": []interface{}{
				map[string]interface{}{
					"number":   uint64(80),
					"name":     "http-example",
					"protocol": "HTTP",
				},
			},
			"resolution": "DNS",
		},
	}).DeepCopyIstioObject()
}

func CreateEmptyMeshExternalServiceEntry(name, namespace string, hosts []string) kubernetes.IstioObject {
	return (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"hosts":      hosts,
			"location":   "MESH_EXTERNAL",
			"resolution": "DNS",
		},
	}).DeepCopyIstioObject()
}

func AddPortDefinitionToServiceEntry(portDef map[string]interface{}, se kubernetes.IstioObject) kubernetes.IstioObject {
	if portsSpec, found := se.GetSpec()["ports"]; found {
		if portsSlice, ok := portsSpec.([]interface{}); ok {
			se.GetSpec()["ports"] = append(portsSlice, portDef)
		}
	} else {
		se.GetSpec()["ports"] = []interface{}{portDef}
	}
	return se
}

func CreateEmptyPortDefinition(port uint32, portName, protocolName string) map[string]interface{} {
	return map[string]interface{}{
		"number":   port,
		"name":     portName,
		"protocol": protocolName,
	}
}
