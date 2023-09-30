package models

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
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

// TODO MAZZ FIND PROTOCOL AND TLS SETTINGS (used only in ServiceNetwork.tsx on the frontend)
func filterRegistryEndpointTLSName(rEs []*kubernetes.RegistryEndpoint, portName string, portNumber uint32) (string, string) {
	return "mazz-protocol", "istio"
}
