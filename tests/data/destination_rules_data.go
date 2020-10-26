package data

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyDestinationRule(namespace string, name string, host string) kubernetes.IstioObject {
	destinationRule := (&kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        name,
			Namespace:   namespace,
			ClusterName: "svc.cluster.local",
		},
		Spec: map[string]interface{}{
			"host": host,
		},
	}).DeepCopyIstioObject()
	return destinationRule
}

func CreateTestDestinationRule(namespace string, name string, host string) kubernetes.IstioObject {
	destinationRule := AddSubsetToDestinationRule(CreateSubset("v1", "v1"),
		AddSubsetToDestinationRule(CreateSubset("v2", "v2"), CreateEmptyDestinationRule(namespace, name, host)))
	return destinationRule
}

func CreateNoLabelsDestinationRule(namespace string, name string, host string) kubernetes.IstioObject {
	destinationRule := AddSubsetToDestinationRule(CreateSubset("v1", "v1"),
		AddSubsetToDestinationRule(CreateNoLabelsSubset("v2"), CreateEmptyDestinationRule(namespace, name, host)))
	return destinationRule
}

func CreateSubset(name string, versionLabel string) map[string]interface{} {
	return map[string]interface{}{
		"name": name,
		"labels": map[string]interface{}{
			"version": versionLabel,
		},
	}
}

func CreateNoLabelsSubset(name string) map[string]interface{} {
	return map[string]interface{}{
		"name": name,
	}
}

func AddSubsetToDestinationRule(subset map[string]interface{}, dr kubernetes.IstioObject) kubernetes.IstioObject {
	if subsetTypeExists, found := dr.GetSpec()["subsets"]; found {
		if subsetTypeCasted, ok := subsetTypeExists.([]interface{}); ok {
			subsetTypeCasted = append(subsetTypeCasted, subset)
			dr.GetSpec()["subsets"] = subsetTypeCasted
		}
	} else {
		dr.GetSpec()["subsets"] = []interface{}{subset}
	}
	return dr
}

func AddTrafficPolicyToDestinationRule(trafficPolicy map[string]interface{}, dr kubernetes.IstioObject) kubernetes.IstioObject {
	dr.GetSpec()["trafficPolicy"] = trafficPolicy
	return dr
}

func CreateMTLSTrafficPolicyForDestinationRules() map[string]interface{} {
	return CreateTrafficPolicyForDestinationRules("ISTIO_MUTUAL")
}

func CreateDisabledMTLSTrafficPolicyForDestinationRules() map[string]interface{} {
	return CreateTrafficPolicyForDestinationRules("DISABLE")
}

func CreateSimpleTLSTrafficPolicyForDestinationRules() map[string]interface{} {
	return CreateTrafficPolicyForDestinationRules("SIMPLE")
}

func CreateTrafficPolicyForDestinationRules(mode string) map[string]interface{} {
	return map[string]interface{}{
		"tls": map[string]interface{}{
			"mode": mode,
		},
	}
}

func CreateLoadBalancerTrafficPolicyForDestinationRules() map[string]interface{} {
	return map[string]interface{}{
		"loadBalancer": map[string]interface{}{
			"simple": "ROUND_ROBIN",
		},
	}
}

func CreatePortLevelTrafficPolicyForDestinationRules() map[string]interface{} {
	return map[string]interface{}{
		"portLevelSettings": []interface{}{
			map[string]interface{}{
				"port": map[string]interface{}{
					"number": 9080,
				},
				"loadBalancer": map[string]interface{}{
					"simple": "ROUND_ROBIN",
				},
			},
		},
	}
}

func CreateTLSPortLevelTrafficPolicyForDestinationRules() map[string]interface{} {
	return map[string]interface{}{
		"portLevelSettings": []interface{}{
			map[string]interface{}{
				"port": map[string]interface{}{
					"number": 9080,
				},
				"tls": map[string]interface{}{
					"mode": "SIMPLE",
				},
			},
		},
	}
}
