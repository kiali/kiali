package k8sgateways

import (
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"regexp"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	"strconv"
)

type MultiMatchChecker struct {
	K8sGateways     []*k8s_networking_v1alpha2.Gateway
	existingList    map[string][]k8s_networking_v1alpha2.Listener
	hostRegexpCache map[string]regexp.Regexp
}

const (
	K8sGatewayCheckerType  = "k8sgateway"
	wildCardMatch          = "*"
	targetNamespaceAll     = "*"
	targetNamespaceCurrent = "."
)

type Host struct {
	Port            int
	Hostname        string
	Namespace       string
	ServerIndex     int
	HostIndex       int
	GatewayRuleName string
	TargetNamespace string
}

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	m.existingList = map[string][]k8s_networking_v1alpha2.Listener{}
	m.hostRegexpCache = map[string]regexp.Regexp{}

	for _, g := range m.K8sGateways {
		gatewayRuleName := g.Name
		gatewayNamespace := g.Namespace

		for _, address := range g.Spec.Addresses {
			// TODO
			log.Infof(address.Value)
		}

		for _, listener := range g.Spec.Listeners {
			duplicate, _ := m.findMatch(listener)
			if duplicate {
				// The above is referenced by each one below..
				currentHostValidation := createError(gatewayRuleName, gatewayNamespace, string(listener.Name), int(listener.Port))
				validations = validations.MergeValidations(currentHostValidation)
			}
			m.existingList[string(listener.Name)] = append(m.existingList[string(listener.Name)], listener)
		}
	}

	return validations
}

func createError(gatewayRuleName, namespace string, hostname string, port int) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectType: K8sGatewayCheckerType}
	checks := models.Build("gateways.multimatch",
		"spec/listeners/hostnames["+hostname+"]/port["+strconv.Itoa(port)+"]")
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
				//if l.AllowedRoutes == listener.AllowedRoutes {
				duplicates = append(duplicates, listener)
				//}
			}
		}
	}
	return len(duplicates) > 0, duplicates
}
