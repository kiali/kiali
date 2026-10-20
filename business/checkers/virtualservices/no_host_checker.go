package virtualservices

import (
	"fmt"
	"strings"

	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Conf                *config.Config
	IdentityDomain      string
	KubeServiceHosts    kubernetes.KubeServiceHosts
	Namespaces          []string
	PolicyAllowAny      bool
	ServiceEntryHosts   map[string][]string
	ValidatingNamespace string
	VirtualService      *networking_v1.VirtualService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true
	namespace := n.VirtualService.Namespace

	for k, httpRoute := range n.VirtualService.Spec.Http {
		if httpRoute == nil {
			continue
		}
		matchGateways := make([][]string, 0, len(httpRoute.Match))
		for _, match := range httpRoute.Match {
			var gateways []string
			if match != nil {
				gateways = match.Gateways
			}
			matchGateways = append(matchGateways, gateways)
		}
		if applies, viewer := n.routeBlockScope(matchGateways); applies {
			for i, dest := range httpRoute.Route {
				if dest != nil && !n.checkRouteDestination(dest.Destination, viewer, namespace, fmt.Sprintf("spec/http[%d]/route[%d]/destination/host", k, i), &validations) {
					valid = false
				}
			}
		}
	}

	for k, tcpRoute := range n.VirtualService.Spec.Tcp {
		if tcpRoute == nil {
			continue
		}
		matchGateways := make([][]string, 0, len(tcpRoute.Match))
		for _, match := range tcpRoute.Match {
			var gateways []string
			if match != nil {
				gateways = match.Gateways
			}
			matchGateways = append(matchGateways, gateways)
		}
		if applies, viewer := n.routeBlockScope(matchGateways); applies {
			for i, dest := range tcpRoute.Route {
				if dest != nil && !n.checkRouteDestination(dest.Destination, viewer, namespace, fmt.Sprintf("spec/tcp[%d]/route[%d]/destination/host", k, i), &validations) {
					valid = false
				}
			}
		}
	}

	for k, tlsRoute := range n.VirtualService.Spec.Tls {
		if tlsRoute == nil {
			continue
		}
		matchGateways := make([][]string, 0, len(tlsRoute.Match))
		for _, match := range tlsRoute.Match {
			var gateways []string
			if match != nil {
				gateways = match.Gateways
			}
			matchGateways = append(matchGateways, gateways)
		}
		if applies, viewer := n.routeBlockScope(matchGateways); applies {
			for i, dest := range tlsRoute.Route {
				if dest != nil && !n.checkRouteDestination(dest.Destination, viewer, namespace, fmt.Sprintf("spec/tls[%d]/route[%d]/destination/host", k, i), &validations) {
					valid = false
				}
			}
		}
	}

	return validations, valid
}

// routeBlockScope reports whether the destinations of a route block must be
// validated from the current perspective, and the namespace whose exportTo
// visibility the destinations are resolved against. Per the VirtualService API,
// per-match gateways override the top-level spec.gateways for that match, and an
// empty gateway list defaults to the mesh. A block scoped only to named gateways
// is applied by the gateway proxies alone, so its destinations are validated only
// from the perspective of a gateway's namespace; every other block can also be
// applied by sidecars in any namespace the VirtualService is exported to, and is
// validated as before from the VirtualService's own namespace. An unset
// ValidatingNamespace keeps the legacy behavior of validating every block.
func (n NoHostChecker) routeBlockScope(matchGateways [][]string) (applies bool, viewer string) {
	namespace := n.VirtualService.Namespace
	meshApplicable := false
	gatewayNamespaces := make(map[string]struct{})

	scopes := matchGateways
	if len(scopes) == 0 {
		// A block without matches inherits the top-level gateway scope.
		scopes = [][]string{nil}
	}
	for _, scope := range scopes {
		gateways := scope
		if len(gateways) == 0 {
			gateways = n.VirtualService.Spec.Gateways
		}
		if len(gateways) == 0 {
			meshApplicable = true
			continue
		}
		for _, gateway := range gateways {
			if gateway == "mesh" {
				meshApplicable = true
				continue
			}
			gatewayNamespaces[kubernetes.ParseGatewayAsHost(gateway, namespace, n.IdentityDomain).Namespace] = struct{}{}
		}
	}

	if meshApplicable || n.ValidatingNamespace == "" {
		return true, namespace
	}
	if _, ok := gatewayNamespaces[n.ValidatingNamespace]; ok {
		return true, n.ValidatingNamespace
	}
	return false, ""
}

// checkRouteDestination validates a single route destination host and appends a
// KIA1101 validation when it does not resolve. namespace is the VirtualService
// namespace used to interpret the host; viewer is the namespace whose exportTo
// visibility the host is resolved against. It returns false when the check fails.
func (n NoHostChecker) checkRouteDestination(destination *api_networking_v1.Destination, viewer, namespace, path string, validations *[]*models.IstioCheck) bool {
	if destination == nil || destination.Host == "" {
		return true
	}
	fqdn := kubernetes.GetHost(destination.Host, namespace, n.Namespaces, n.IdentityDomain)
	if n.checkDestination(fqdn.String(), viewer) {
		return true
	}
	validation := models.Build("virtualservices.nohost.hostnotfound", path)
	if n.PolicyAllowAny {
		validation.Severity = models.WarningSeverity
	}
	*validations = append(*validations, &validation)
	return false
}

func (n NoHostChecker) checkDestination(sHost string, itemNamespace string) bool {
	// Check ServiceEntries
	for k := range n.ServiceEntryHosts {
		hostKey := k
		if i := strings.Index(k, "*"); i > -1 {
			hostKey = k[i+1:]
		}
		if strings.HasSuffix(sHost, hostKey) {
			return true
		}
	}

	// Check K8s Services via FQDN map
	if n.KubeServiceHosts.IsValidForNamespace(sHost, itemNamespace) {
		return true
	}

	return false
}
