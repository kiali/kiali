package data

import (
	api_networking_v1beta1 "istio.io/api/networking/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
)

func CreateEmptyDestinationRule(namespace string, name string, host string) *networking_v1beta1.DestinationRule {
	dr := networking_v1beta1.DestinationRule{}
	dr.Name = name
	dr.Namespace = namespace
	dr.ClusterName = "svc.cluster.local"
	dr.Spec.Host = host
	return &dr
}

func CreateTestDestinationRule(namespace string, name string, host string) *networking_v1beta1.DestinationRule {
	destinationRule := AddSubsetToDestinationRule(CreateSubset("v1", "v1"),
		AddSubsetToDestinationRule(CreateSubset("v2", "v2"), CreateEmptyDestinationRule(namespace, name, host)))
	return destinationRule
}

func CreateNoLabelsDestinationRule(namespace string, name string, host string) *networking_v1beta1.DestinationRule {
	destinationRule := AddSubsetToDestinationRule(CreateSubset("v1", "v1"),
		AddSubsetToDestinationRule(CreateNoLabelsSubset("v2"), CreateEmptyDestinationRule(namespace, name, host)))
	return destinationRule
}

func CreateSubset(name string, versionLabel string) *api_networking_v1beta1.Subset {
	s := api_networking_v1beta1.Subset{
		Name: name,
		Labels: map[string]string{
			"version": versionLabel,
		},
	}
	return &s
}

func CreateNoLabelsSubset(name string) *api_networking_v1beta1.Subset {
	s := api_networking_v1beta1.Subset{
		Name: name,
	}
	return &s
}

func AddSubsetToDestinationRule(subset *api_networking_v1beta1.Subset, dr *networking_v1beta1.DestinationRule) *networking_v1beta1.DestinationRule {
	dr.Spec.Subsets = append(dr.Spec.Subsets, subset)
	return dr
}

func AddTrafficPolicyToDestinationRule(trafficPolicy *api_networking_v1beta1.TrafficPolicy, dr *networking_v1beta1.DestinationRule) *networking_v1beta1.DestinationRule {
	dr.Spec.TrafficPolicy = trafficPolicy
	return dr
}

func CreateMTLSTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	return CreateTrafficPolicyForDestinationRules("ISTIO_MUTUAL")
}

func CreateDisabledMTLSTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	return CreateTrafficPolicyForDestinationRules("DISABLE")
}

func CreateSimpleTLSTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	return CreateTrafficPolicyForDestinationRules("SIMPLE")
}

func CreateTrafficPolicyForDestinationRules(mode string) *api_networking_v1beta1.TrafficPolicy {
	tp := api_networking_v1beta1.TrafficPolicy{}
	tp.Tls = &api_networking_v1beta1.ClientTLSSettings{}
	if m, ok := api_networking_v1beta1.ClientTLSSettings_TLSmode_value[mode]; ok {
		tp.Tls.Mode = api_networking_v1beta1.ClientTLSSettings_TLSmode(m)
	}
	return &tp
}

func CreateLoadBalancerTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	tp := api_networking_v1beta1.TrafficPolicy{}
	tp.LoadBalancer = &api_networking_v1beta1.LoadBalancerSettings{
		LbPolicy: &api_networking_v1beta1.LoadBalancerSettings_Simple{
			Simple: api_networking_v1beta1.LoadBalancerSettings_ROUND_ROBIN,
		},
	}
	return &tp
}

func CreatePortLevelTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	tp := api_networking_v1beta1.TrafficPolicy{}
	tp.PortLevelSettings = []*api_networking_v1beta1.TrafficPolicy_PortTrafficPolicy{
		{
			Port: &api_networking_v1beta1.PortSelector{
				Number: 9080,
			},
			LoadBalancer: &api_networking_v1beta1.LoadBalancerSettings{
				LbPolicy: &api_networking_v1beta1.LoadBalancerSettings_Simple{
					Simple: api_networking_v1beta1.LoadBalancerSettings_ROUND_ROBIN,
				},
			},
		},
	}
	return &tp
}

func CreateTLSPortLevelTrafficPolicyForDestinationRules() *api_networking_v1beta1.TrafficPolicy {
	tp := api_networking_v1beta1.TrafficPolicy{}
	tp.PortLevelSettings = []*api_networking_v1beta1.TrafficPolicy_PortTrafficPolicy{
		{
			Port: &api_networking_v1beta1.PortSelector{
				Number: 9080,
			},
			Tls: &api_networking_v1beta1.ClientTLSSettings{
				Mode: api_networking_v1beta1.ClientTLSSettings_SIMPLE,
			},
		},
	}
	return &tp
}
