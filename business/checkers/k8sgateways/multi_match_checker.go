package k8sgateways

import (
	"github.com/kiali/kiali/models"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
)

type MultiMatchChecker struct {
	K8sGateways  []*k8s_networking_v1alpha2.Gateway
	existingList map[string][]k8s_networking_v1alpha2.Listener
	hostList     map[string][]k8s_networking_v1alpha2.GatewayAddress
}

const (
	K8sGatewayCheckerType = "k8sgateway"
)

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	m.existingList = map[string][]k8s_networking_v1alpha2.Listener{}
	m.hostList = map[string][]k8s_networking_v1alpha2.GatewayAddress{}

	for _, g := range m.K8sGateways {
		gatewayRuleName := g.Name
		gatewayNamespace := g.Namespace

		// With addresses
		for _, address := range g.Spec.Addresses {
			duplicate, _ := m.findMatchIP(address)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, gatewayNamespace, address.Value, "addresses/value")
				validations = validations.MergeValidations(currentHostValidation)
			}
			m.hostList[address.Value] = append(m.hostList[address.Value], address)
		}

		// With listeners
		for _, listener := range g.Spec.Listeners {
			duplicate, _ := m.findMatch(listener)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, gatewayNamespace, string(*listener.Hostname), "listeners/hostname")
				validations = validations.MergeValidations(currentHostValidation)
			}
			m.existingList[string(listener.Name)] = append(m.existingList[string(listener.Name)], listener)
		}
	}

	return validations
}

// Create validation error for k8sgateway object
func createError(gatewayRuleName, namespace string, hostname string, path string) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectType: K8sGatewayCheckerType}
	checks := models.Build("gateways.multimatch",
		"spec/"+path+"/"+hostname)
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
func (m MultiMatchChecker) findMatch(listener k8s_networking_v1alpha2.Listener) (bool, []k8s_networking_v1alpha2.Listener) {
	duplicates := make([]k8s_networking_v1alpha2.Listener, 0)
	for _, ll := range m.existingList {
		for _, l := range ll {
			if *l.Hostname == *listener.Hostname && l.Port == listener.Port && l.Protocol == listener.Protocol {
				//TODO: Should we also check AllowedRoutes {
				duplicates = append(duplicates, listener)
			}
		}
	}
	return len(duplicates) > 0, duplicates
}

// Check duplicates IP
func (m MultiMatchChecker) findMatchIP(address k8s_networking_v1alpha2.GatewayAddress) (bool, []k8s_networking_v1alpha2.GatewayAddress) {
	duplicates := make([]k8s_networking_v1alpha2.GatewayAddress, 0)
	for _, aa := range m.hostList {
		for _, a := range aa {
			if *a.Type == *address.Type && a.Value == address.Value {
				duplicates = append(duplicates, address)
			}
		}
	}
	return len(duplicates) > 0, duplicates
}
