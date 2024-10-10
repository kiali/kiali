package k8sgateways

import (
	"fmt"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	Cluster     string
	K8sGateways []*k8s_networking_v1.Gateway
}

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, g := range m.K8sGateways {
		gatewayRuleName := g.Name
		gatewayNamespace := g.Namespace

		// With addresses
		for _, address := range g.Spec.Addresses {
			duplicate, collidingGateways := m.findMatchIP(address, g.Name)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, "k8sgateways.multimatch.ip", gatewayNamespace, m.Cluster, "spec/addresses/value", collidingGateways)
				validations = validations.MergeValidations(currentHostValidation)
			}
		}

		// With listeners
		for index, listener := range g.Spec.Listeners {
			duplicate, collidingGateways := m.findMatch(listener, g.Name)
			// Find in a different k8s GW
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, "k8sgateways.multimatch.listener", gatewayNamespace, m.Cluster, fmt.Sprintf("spec/listeners[%d]/hostname", index), collidingGateways)
				validations = validations.MergeValidations(currentHostValidation)
			}
			// Check for unique listeners in the GW
			for i, l := range g.Spec.Listeners {
				if listener.Name != l.Name && l.Hostname != nil && listener.Hostname != nil && *listener.Hostname == *l.Hostname && listener.Port == l.Port && listener.Protocol == l.Protocol {
					currentHostValidation := createError(gatewayRuleName, "k8sgateways.unique.listener", gatewayNamespace, m.Cluster, fmt.Sprintf("spec/listeners[%d]/name", i), nil)
					validations = validations.MergeValidations(currentHostValidation)
				}
			}
		}
	}

	return validations
}

// Create validation error for k8sgateway object
func createError(gatewayRuleName string, ruleCode string, namespace string, cluster string, path string, references []models.IstioValidationKey) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectGVK: kubernetes.K8sGateways, Cluster: cluster}
	checks := models.Build(ruleCode, path)
	rrValidation := &models.IstioValidation{
		Cluster:   cluster,
		Name:      gatewayRuleName,
		ObjectGVK: kubernetes.K8sGateways,
		Valid:     true,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: references,
	}

	return models.IstioValidations{key: rrValidation}
}

// findMatch uses a linear search with regexp to check for matching gateway host + port combinations. If this becomes a bottleneck for performance, replace with a graph or trie algorithm.
func (m MultiMatchChecker) findMatch(listener k8s_networking_v1.Listener, gwName string) (bool, []models.IstioValidationKey) {
	collidingGateways := make([]models.IstioValidationKey, 0)

	for _, gw := range m.K8sGateways {
		if gw.Name == gwName {
			continue
		}
		for _, l := range gw.Spec.Listeners {
			if l.Hostname != nil && listener.Hostname != nil && *l.Hostname == *listener.Hostname && l.Port == listener.Port && l.Protocol == listener.Protocol {
				key := models.IstioValidationKey{Name: gw.Name, Namespace: gw.Namespace, ObjectGVK: kubernetes.K8sGateways}
				collidingGateways = append(collidingGateways, key)
			}
		}

	}
	return len(collidingGateways) > 0, collidingGateways
}

// Check duplicates IP
func (m MultiMatchChecker) findMatchIP(address k8s_networking_v1.GatewayAddress, gwName string) (bool, []models.IstioValidationKey) {
	collidingGateways := make([]models.IstioValidationKey, 0)

	for _, aa := range m.K8sGateways {
		if aa.Name == gwName {
			continue
		}

		for _, a := range aa.Spec.Addresses {
			if a.Type != nil && address.Type != nil && *a.Type == *address.Type && a.Value == address.Value {
				key := models.IstioValidationKey{Name: aa.Name, Namespace: aa.Namespace, ObjectGVK: kubernetes.K8sGateways}
				collidingGateways = append(collidingGateways, key)
			}
		}
	}
	return len(collidingGateways) > 0, collidingGateways
}
