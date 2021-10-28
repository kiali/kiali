package data

import (
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
)

func CreateExternalServiceEntry() networking_v1alpha3.ServiceEntry {
	se := networking_v1alpha3.ServiceEntry{}
	se.Name = "external-svc-wikipedia"
	se.Namespace = "wikipedia"
	se.Spec.Hosts = []string{"wikipedia.org"}
	se.Spec.Location = api_networking_v1alpha3.ServiceEntry_MESH_EXTERNAL
	se.Spec.Ports = []*api_networking_v1alpha3.Port{
		{
			Number:   80,
			Name:     "http-example",
			Protocol: "HTTP",
		},
	}
	return se
}

func CreateEmptyMeshExternalServiceEntry(name, namespace string, hosts []string) *networking_v1alpha3.ServiceEntry {
	se := networking_v1alpha3.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.Location = api_networking_v1alpha3.ServiceEntry_MESH_EXTERNAL
	se.Spec.Resolution = api_networking_v1alpha3.ServiceEntry_DNS
	return &se
}

func CreateEmptyMeshInternalServiceEntry(name, namespace string, hosts []string) *networking_v1alpha3.ServiceEntry {
	se := networking_v1alpha3.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.Location = api_networking_v1alpha3.ServiceEntry_MESH_INTERNAL
	se.Spec.Resolution = api_networking_v1alpha3.ServiceEntry_NONE
	return &se
}

func AddPortDefinitionToServiceEntry(portDef *api_networking_v1alpha3.Port, se *networking_v1alpha3.ServiceEntry) *networking_v1alpha3.ServiceEntry {
	se.Spec.Ports = append(se.Spec.Ports, portDef)
	return se
}

func CreateEmptyPortDefinition(port uint32, portName, protocolName string) *api_networking_v1alpha3.Port {
	p := api_networking_v1alpha3.Port{
		Number:   port,
		Name:     portName,
		Protocol: protocolName,
	}
	return &p
}
