package data

import (
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
)

func CreateSidecar(name string, namespace string) *networking_v1alpha3.Sidecar {
	sc := networking_v1alpha3.Sidecar{}
	sc.Name = name
	sc.Namespace = namespace
	sc.ClusterName = "svc.cluster.local"
	return &sc
}

func AddSelectorToSidecar(selector map[string]string, sc *networking_v1alpha3.Sidecar) *networking_v1alpha3.Sidecar {
	sc.Spec.WorkloadSelector = &api_networking_v1alpha3.WorkloadSelector{
		Labels: selector,
	}
	return sc
}

func AddHostsToSidecar(hl []string, sc *networking_v1alpha3.Sidecar) *networking_v1alpha3.Sidecar {
	sc.Spec.Egress = []*api_networking_v1alpha3.IstioEgressListener{
		{
			Hosts: hl,
		},
	}
	return sc
}
