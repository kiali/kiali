package authorization

import (
	"fmt"

	api_security_v1beta "istio.io/api/security/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	AuthorizationPolicy security_v1beta.AuthorizationPolicy
	Namespace           string
	Namespaces          models.Namespaces
	ServiceEntries      map[string][]string
	VirtualServices     []networking_v1beta1.VirtualService
	RegistryServices    []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	// Getting rules array. If not present, quitting validation.
	if len(n.AuthorizationPolicy.Spec.Rules) == 0 {
		return checks, valid
	}

	// Getting slice of Rules. Quitting if not an slice.
	for ruleIdx, rule := range n.AuthorizationPolicy.Spec.Rules {
		if rule == nil {
			continue
		}

		if len(rule.To) > 0 {
			fromChecks, fromValid := n.validateHost(ruleIdx, rule.To)
			checks = append(checks, fromChecks...)
			valid = valid && fromValid
		}

	}
	return checks, valid
}

func (n NoHostChecker) validateHost(ruleIdx int, to []*api_security_v1beta.Rule_To) ([]*models.IstioCheck, bool) {
	if len(to) == 0 {
		return nil, true
	}
	namespace, clusterName := n.AuthorizationPolicy.Namespace, n.AuthorizationPolicy.ClusterName
	checks, valid := make([]*models.IstioCheck, 0, len(to)), true
	for toIdx, t := range to {
		if t == nil {
			continue
		}

		if t.Operation == nil {
			continue
		}

		if len(t.Operation.Hosts) == 0 {
			continue
		}

		for hostIdx, h := range t.Operation.Hosts {
			fqdn := kubernetes.GetHost(h, namespace, clusterName, n.Namespaces.GetNames())
			if !n.hasMatchingService(fqdn, namespace) {
				path := fmt.Sprintf("spec/rules[%d]/to[%d]/operation/hosts[%d]", ruleIdx, toIdx, hostIdx)
				validation := models.Build("authorizationpolicy.nodest.matchingregistry", path)
				valid = false
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}

func (n NoHostChecker) hasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	// Covering 'servicename.namespace' host format scenario
	_, localNs := kubernetes.ParseTwoPartHost(host)

	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if host.IsWildcard() && localNs == itemNamespace {
		return true
	}

	// Check ServiceEntries
	if kubernetes.HasMatchingServiceEntries(host.String(), n.ServiceEntries) {
		return true
	}

	// Check VirtualServices
	if kubernetes.HasMatchingVirtualServices(host, n.VirtualServices) {
		return true
	}

	// Use RegistryService to check destinations that may not be covered with previous check
	// i.e. Multi-cluster or Federation validations
	if kubernetes.HasMatchingRegistryService(itemNamespace, host.String(), n.RegistryServices) {
		return true
	}

	return false
}
