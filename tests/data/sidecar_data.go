package data

import (
	api_networking_v1beta1 "istio.io/api/networking/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
)

func CreateSidecar(name string, namespace string) *networking_v1beta1.Sidecar {
	sc := networking_v1beta1.Sidecar{}
	sc.Name = name
	sc.Namespace = namespace
	sc.ClusterName = "svc.cluster.local"
	return &sc
}

func AddSelectorToSidecar(selector map[string]string, sc *networking_v1beta1.Sidecar) *networking_v1beta1.Sidecar {
	sc.Spec.WorkloadSelector = &api_networking_v1beta1.WorkloadSelector{
		Labels: selector,
	}
	return sc
}

func AddHostsToSidecar(hl []string, sc *networking_v1beta1.Sidecar) *networking_v1beta1.Sidecar {
	sc.Spec.Egress = []*api_networking_v1beta1.IstioEgressListener{
		{
			Hosts: hl,
		},
	}
	return sc
}
