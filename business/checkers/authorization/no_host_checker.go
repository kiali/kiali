package authorization

import (
	"fmt"
	"slices"
	"strings"

	api_security_v1 "istio.io/api/security/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	AuthorizationPolicy *security_v1.AuthorizationPolicy
	Conf                *config.Config
	IdentityDomain      string
	KubeServiceHosts    kubernetes.KubeServiceHosts
	Namespaces          []string
	PolicyAllowAny      bool
	ServiceEntries      map[string][]string
	VirtualServices     []*networking_v1.VirtualService
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

func (n NoHostChecker) validateHost(ruleIdx int, to []*api_security_v1.Rule_To) ([]*models.IstioCheck, bool) {
	if len(to) == 0 {
		return nil, true
	}
	namespace := n.AuthorizationPolicy.Namespace

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
			// Istio matches operation.hosts against the HTTP Host/Authority header
			// (Exact/Prefix/Suffix/Presence), not the service registry. Skip registry
			// checks for wildcards and external DNS Host headers.
			if isHTTPHostHeaderMatcher(h, namespace, n.Namespaces) {
				continue
			}
			fqdn := kubernetes.GetHost(h, namespace, n.Namespaces, n.IdentityDomain)
			if !n.hasMatchingService(fqdn, namespace) {
				path := fmt.Sprintf("spec/rules[%d]/to[%d]/operation/hosts[%d]", ruleIdx, toIdx, hostIdx)
				validation := models.Build("authorizationpolicy.nodest.matchingregistry", path)
				if n.PolicyAllowAny {
					validation.Severity = models.WarningSeverity
				}
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
	if kubernetes.HasMatchingVirtualServices(host, n.VirtualServices, n.IdentityDomain) {
		return true
	}

	// Check K8s Services via FQDN map
	if n.KubeServiceHosts.IsValidForNamespace(host.String(), itemNamespace) {
		return true
	}

	return false
}

// isHTTPHostHeaderMatcher reports whether host is an Istio AuthZ Host-header matcher that
// should not be validated against the service registry.
func isHTTPHostHeaderMatcher(host, policyNamespace string, clusterNamespaces []string) bool {
	h := strings.TrimSpace(host)
	if h == "" {
		return false
	}
	if h == "*" {
		return true
	}
	if strings.HasPrefix(h, "*") || strings.HasSuffix(h, "*") {
		return true
	}
	if strings.Count(h, ".") >= 2 {
		return true
	}
	if strings.Count(h, ".") == 1 {
		parts := strings.SplitN(h, ".", 2)
		// Registry-check only known service.namespace shorthand (namespace is the policy
		// namespace or a cluster namespace). All other single-dot hosts (api.info, app.tech,
		// wrong.org) are treated as HTTP Host headers and are not registry-validated.
		return parts[1] != policyNamespace && !slices.Contains(clusterNamespaces, parts[1])
	}
	return false
}
