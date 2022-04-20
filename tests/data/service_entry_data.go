package data

import (
	api_networking_v1beta1 "istio.io/api/networking/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
)

func CreateExternalServiceEntry() networking_v1beta1.ServiceEntry {
	se := networking_v1beta1.ServiceEntry{}
	se.Name = "external-svc-wikipedia"
	se.Namespace = "wikipedia"
	se.Spec.Hosts = []string{"wikipedia.org"}
	se.Spec.Location = api_networking_v1beta1.ServiceEntry_MESH_EXTERNAL
	se.Spec.Ports = []*api_networking_v1beta1.Port{
		{
			Number:   80,
			Name:     "http-example",
			Protocol: "HTTP",
		},
	}
	return se
}

func CreateEmptyMeshExternalServiceEntry(name, namespace string, hosts []string) *networking_v1beta1.ServiceEntry {
	se := networking_v1beta1.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.Location = api_networking_v1beta1.ServiceEntry_MESH_EXTERNAL
	se.Spec.Resolution = api_networking_v1beta1.ServiceEntry_DNS
	return &se
}

func CreateEmptyMeshInternalServiceEntry(name, namespace string, hosts []string) *networking_v1beta1.ServiceEntry {
	se := networking_v1beta1.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.Location = api_networking_v1beta1.ServiceEntry_MESH_INTERNAL
	se.Spec.Resolution = api_networking_v1beta1.ServiceEntry_NONE
	return &se
}

func AddPortDefinitionToServiceEntry(portDef *api_networking_v1beta1.Port, se *networking_v1beta1.ServiceEntry) *networking_v1beta1.ServiceEntry {
	se.Spec.Ports = append(se.Spec.Ports, portDef)
	return se
}

func CreateEmptyPortDefinition(port uint32, portName, protocolName string) *api_networking_v1beta1.Port {
	p := api_networking_v1beta1.Port{
		Number:   port,
		Name:     portName,
		Protocol: protocolName,
	}
	return &p
}
