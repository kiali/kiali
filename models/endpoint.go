package models

import (
	"github.com/kiali/kiali/kubernetes"
	core_v1 "k8s.io/api/core/v1"
)

type Endpoints []Endpoint
type Endpoint struct {
	Addresses Addresses `json:"addresses"`
	Ports     Ports     `json:"ports"`
}

func (endpoints *Endpoints) Parse(es *core_v1.Endpoints) {
	if es == nil {
		return
	}

	for _, subset := range es.Subsets {
		endpoint := Endpoint{}
		endpoint.Parse(subset)
		*endpoints = append(*endpoints, endpoint)
	}
}

func (endpoint *Endpoint) Parse(s core_v1.EndpointSubset) {
	(&endpoint.Ports).ParseEndpointPorts(s.Ports)
	(&endpoint.Addresses).Parse(s.Addresses)
}

func filterRegistryEndpointTLSName(rEs []*kubernetes.RegistryEndpoint, portName string, portNumber uint32) (string, string) {
	for _, ep := range rEs {
		for _, iEp := range ep.Endpoints {
			if iEp.ServicePort.Name == portName && iEp.ServicePort.Port == portNumber {
				return iEp.ServicePort.Protocol, iEp.Endpoint.TLSMode
			}
		}
	}
	return "", ""
}
