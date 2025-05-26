package models

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
)

type Ports []Port
type Port struct {
	Name     string `json:"name"`
	Protocol string `json:"protocol"`
	Port     int32  `json:"port"`
}

func (ports *Ports) Parse(ps []core_v1.ServicePort) {
	for _, servicePort := range ps {
		port := Port{}
		port.Parse(servicePort)
		*ports = append(*ports, port)
	}
}

func (port *Port) Parse(p core_v1.ServicePort) {
	port.Name = p.Name
	port.Protocol = string(p.Protocol)
	port.Port = p.Port
}

func (ports *Ports) ParseEndpointPorts(ps []core_v1.EndpointPort) {
	for _, endpointPort := range ps {
		port := Port{}
		port.ParseEndpointPort(endpointPort)
		*ports = append(*ports, port)
	}
}

func (port *Port) ParseEndpointPort(p core_v1.EndpointPort) {
	port.Name = p.Name
	port.Protocol = string(p.Protocol)
	port.Port = p.Port
}

func (ports *Ports) ParseServiceRegistryPorts(rs *kubernetes.RegistryService) {
	if rs == nil {
		return
	}
	for _, rsPort := range rs.Ports {
		port := Port{
			Name:     rsPort.Name,
			Port:     int32(rsPort.Port),
			Protocol: rsPort.Protocol,
		}
		*ports = append(*ports, port)
	}
}
