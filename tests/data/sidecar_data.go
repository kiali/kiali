package data

import (
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
)

func CreateSidecar(name string, namespace string) *networking_v1.Sidecar {
	sc := networking_v1.Sidecar{}
	sc.Name = name
	sc.Namespace = namespace
	return &sc
}

func AddSelectorToSidecar(selector map[string]string, sc *networking_v1.Sidecar) *networking_v1.Sidecar {
	sc.Spec.WorkloadSelector = &api_networking_v1.WorkloadSelector{
		Labels: selector,
	}
	return sc
}

func AddHostsToSidecar(hl []string, sc *networking_v1.Sidecar) *networking_v1.Sidecar {
	sc.Spec.Egress = []*api_networking_v1.IstioEgressListener{
		{
			Hosts: hl,
		},
	}
	return sc
}
