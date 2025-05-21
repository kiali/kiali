package models

import core_v1 "k8s.io/api/core/v1"

type Endpoints []Endpoint
type Endpoint struct {
	Addresses Addresses `json:"addresses"`
	Ports     Ports     `json:"ports"`
}

// GetEndpointsFromPods gets IP addresses from Pods
func GetEndpointsFromPods(pods []core_v1.Pod) *Endpoints {
	endpointPodAddresses := Endpoints{}
	for _, pod := range pods {
		ep := Endpoint{
			Addresses: make(Addresses, 0),
			Ports:     make(Ports, 0),
		}
		if pod.Status.PodIP != "" { // make sure Pod's IP address is not empty
			ep.Addresses = append(ep.Addresses, Address{
				Kind: pod.Kind,
				Name: pod.Name,
				IP:   pod.Status.PodIP,
			})
		}
		endpointPodAddresses = append(endpointPodAddresses, ep)
	}

	return &endpointPodAddresses
}
