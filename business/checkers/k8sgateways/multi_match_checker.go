package k8sgateways

import (
	"fmt"

	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	K8sGateways []*k8s_networking_v1alpha2.Gateway
}

const (
	K8sGatewayCheckerType = "k8sgateway"
)

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, g := range m.K8sGateways {
		gatewayRuleName := g.Name
		gatewayNamespace := g.Namespace

		// With addresses
		for _, address := range g.Spec.Addresses {
			duplicate, _ := m.findMatchIP(address, g.Name)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, "k8sgateways.multimatch.ip", gatewayNamespace, "spec/addresses/value")
				validations = validations.MergeValidations(currentHostValidation)
			}
		}

		// With listeners
		for index, listener := range g.Spec.Listeners {
			duplicate, _ := m.findMatch(listener, g.Name)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, "k8sgateways.multimatch.listener", gatewayNamespace, fmt.Sprintf("speclisteners[%d]/hostname", index))
				validations = validations.MergeValidations(currentHostValidation)
			}
		}
	}

	return validations
}

// Create validation error for k8sgateway object
func createError(gatewayRuleName string, ruleCode string, namespace string, path string) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectType: K8sGatewayCheckerType}
	checks := models.Build(ruleCode, path)
	rrValidation := &models.IstioValidation{
		Name:       gatewayRuleName,
		ObjectType: K8sGatewayCheckerType,
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	return models.IstioValidations{key: rrValidation}
}

// findMatch uses a linear search with regexp to check for matching gateway host + port combinations. If this becomes a bottleneck for performance, replace with a graph or trie algorithm.
func (m MultiMatchChecker) findMatch(listener k8s_networking_v1alpha2.Listener, gwName string) (bool, []k8s_networking_v1alpha2.Listener) {
	duplicates := make([]k8s_networking_v1alpha2.Listener, 0)
	for _, gw := range m.K8sGateways {
		if gw.Name == gwName {
			continue
		}
		for _, l := range gw.Spec.Listeners {
			if l.Hostname != nil && listener.Hostname != nil && *l.Hostname == *listener.Hostname && l.Port == listener.Port && l.Protocol == listener.Protocol {
				duplicates = append(duplicates, listener)
			}
		}

	}
	return len(duplicates) > 0, duplicates
}

// Check duplicates IP
func (m MultiMatchChecker) findMatchIP(address k8s_networking_v1alpha2.GatewayAddress, gwName string) (bool, []k8s_networking_v1alpha2.GatewayAddress) {
	duplicates := make([]k8s_networking_v1alpha2.GatewayAddress, 0)
	for _, aa := range m.K8sGateways {
		if aa.Name == gwName {
			continue
		}
		for _, a := range aa.Spec.Addresses {
			if a.Type != nil && address.Type != nil && *a.Type == *address.Type && a.Value == address.Value {
				duplicates = append(duplicates, address)
			}
		}
	}
	return len(duplicates) > 0, duplicates
}
