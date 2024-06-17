package data

import (
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
)

func CreateExternalServiceEntry() *networking_v1.ServiceEntry {
	se := networking_v1.ServiceEntry{}
	se.Name = "external-svc-wikipedia"
	se.Namespace = "wikipedia"
	se.Spec.Hosts = []string{"wikipedia.org"}
	se.Spec.ExportTo = []string{"*"}
	se.Spec.Location = api_networking_v1.ServiceEntry_MESH_EXTERNAL
	se.Spec.Ports = []*api_networking_v1.ServicePort{
		{
			Number:   80,
			Name:     "http-example",
			Protocol: "HTTP",
		},
	}
	return &se
}

func AddEndpointToServiceEntry(address, labelKey, labelValue string, se *networking_v1.ServiceEntry) *networking_v1.ServiceEntry {
	se.Spec.Endpoints = []*api_networking_v1.WorkloadEntry{
		{
			Address: address,
			Labels: map[string]string{
				labelKey: labelValue,
			},
		},
	}
	return se
}

func CreateEmptyMeshExternalServiceEntry(name, namespace string, hosts []string) *networking_v1.ServiceEntry {
	se := networking_v1.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.ExportTo = []string{"*"}
	se.Spec.Location = api_networking_v1.ServiceEntry_MESH_EXTERNAL
	se.Spec.Resolution = api_networking_v1.ServiceEntry_DNS
	return &se
}

func CreateEmptyMeshInternalServiceEntry(name, namespace string, hosts []string) *networking_v1.ServiceEntry {
	se := networking_v1.ServiceEntry{}
	se.Name = name
	se.Namespace = namespace
	se.Spec.Hosts = hosts
	se.Spec.ExportTo = []string{"*"}
	se.Spec.Location = api_networking_v1.ServiceEntry_MESH_INTERNAL
	se.Spec.Resolution = api_networking_v1.ServiceEntry_NONE
	return &se
}

func AddPortDefinitionToServiceEntry(portDef *api_networking_v1.ServicePort, se *networking_v1.ServiceEntry) *networking_v1.ServiceEntry {
	se.Spec.Ports = append(se.Spec.Ports, portDef)
	return se
}

func CreateEmptyServicePortDefinition(port uint32, portName, protocolName string) *api_networking_v1.ServicePort {
	p := api_networking_v1.ServicePort{
		Number:   port,
		Name:     portName,
		Protocol: protocolName,
	}
	return &p
}
